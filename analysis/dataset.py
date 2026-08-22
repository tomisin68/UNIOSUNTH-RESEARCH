"""Turn raw Firestore documents into tidy pandas frames.

Scoring here deliberately mirrors `src/utils/scoring.ts` item for item, then
cross-checks the result against the score the app stored. Any disagreement is
surfaced rather than silently accepted — a mismatch would mean the app and the
analysis disagree about what the data means, which matters more than the chart.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

import config
from instruments import Item, ipc_items, subscales, workload_items


@dataclass
class Dataset:
    participants: pd.DataFrame           # one row per assessment
    workload_matrix: pd.DataFrame        # participants x 12 scored items
    ipc_matrix: pd.DataFrame             # participants x 20 scored items
    items_long: pd.DataFrame             # tidy participant x item
    workload_items: list[Item]
    ipc_items: list[Item]
    integrity: dict[str, Any] = field(default_factory=dict)

    @property
    def n(self) -> int:
        return len(self.participants)


def _score_item(raw: float, item: Item, scale_max: int) -> float:
    """Apply reverse scoring exactly as the app does (6-raw / 5-raw)."""
    return (scale_max + 1 - raw) if item.reversed else raw


def _responses_to_series(responses: dict, items: list[Item], scale_max: int
                         ) -> tuple[dict[int, float], int]:
    """Map a raw response dict to scored values; returns (scores, n_missing).

    Firestore map keys arrive as strings; the app defaults a missing answer to 1,
    so we mirror that and count how often it happens.
    """
    normalised: dict[int, float] = {}
    for key, value in (responses or {}).items():
        try:
            normalised[int(key)] = float(value)
        except (TypeError, ValueError):
            continue

    scored: dict[int, float] = {}
    missing = 0
    for item in items:
        if item.id in normalised:
            raw = normalised[item.id]
        else:
            raw = 1.0
            missing += 1
        scored[item.id] = _score_item(raw, item, scale_max)
    return scored, missing


def _normalise(total: float, n_items: int, scale_max: int) -> float:
    lo, hi = n_items, n_items * scale_max
    return round((total - lo) / (hi - lo) * 100)


def _to_number(value: Any) -> float:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return np.nan


def build(records: list[dict[str, Any]]) -> Dataset:
    wl_items, ip_items = workload_items(), ipc_items()

    # Records the coordinator flagged out of the study in the app carry
    # excluded=True. They are dropped here too, so this report and the in-app
    # analysis are never computed over different sets of participants.
    n_excluded = sum(1 for r in records if r.get("excluded") is True)
    records = [r for r in records if r.get("excluded") is not True]

    rows: list[dict[str, Any]] = []
    wl_scores: list[dict[int, float]] = []
    ip_scores: list[dict[int, float]] = []
    score_mismatches: list[dict[str, Any]] = []
    total_missing_wl = total_missing_ipc = 0

    for record in records:
        wl_scored, wl_missing = _responses_to_series(
            record.get("workloadResponses", {}), wl_items, config.WORKLOAD_MAX)
        ip_scored, ip_missing = _responses_to_series(
            record.get("ipcResponses", {}), ip_items, config.IPC_MAX)
        total_missing_wl += wl_missing
        total_missing_ipc += ip_missing

        wl_computed = _normalise(sum(wl_scored.values()), len(wl_items), config.WORKLOAD_MAX)
        ip_computed = _normalise(sum(ip_scored.values()), len(ip_items), config.IPC_MAX)

        wl_stored = _to_number(record.get("workloadScore"))
        ip_stored = _to_number(record.get("ipcScore"))
        for label, computed, stored in (("workload", wl_computed, wl_stored),
                                        ("ipc", ip_computed, ip_stored)):
            if not np.isnan(stored) and abs(computed - stored) > 1:
                score_mismatches.append({
                    "id": record.get("id"), "scale": label,
                    "stored": stored, "recomputed": computed,
                })

        rows.append({
            "id": record.get("id"),
            "nurseCode": record.get("nurseCode"),
            "ward": record.get("ward"),
            "shift": record.get("shift"),
            "qualification": record.get("qualification"),
            "yearsExperience": _to_number(record.get("yearsExperience")),
            "patientLoad": _to_number(record.get("patientLoad")),
            "submittedAt": record.get("submittedAt"),
            "workloadScore": wl_computed,
            "ipcScore": ip_computed,
            "workloadCategory": record.get("workloadCategory"),
            "ipcCategory": record.get("ipcCategory"),
            "workloadMissing": wl_missing,
            "ipcMissing": ip_missing,
        })
        wl_scores.append(wl_scored)
        ip_scores.append(ip_scored)

    participants = pd.DataFrame(rows)

    if not participants.empty:
        # Recompute categories from the recomputed scores so charts, tables and
        # tests all agree even if an old record carries a stale label.
        participants["workloadCategory"] = participants["workloadScore"].map(_workload_category)
        participants["ipcCategory"] = participants["ipcScore"].map(_ipc_category)
        participants["submittedAt"] = pd.to_datetime(
            participants["submittedAt"], format="ISO8601", utc=True, errors="coerce")
        for col, order in (("workloadCategory", config.WORKLOAD_CATEGORIES),
                           ("ipcCategory", config.IPC_CATEGORIES)):
            participants[col] = pd.Categorical(participants[col], categories=order, ordered=True)

    index = participants["id"] if not participants.empty else pd.Index([], name="id")
    wl_matrix = pd.DataFrame(wl_scores, index=index).reindex(
        columns=[i.id for i in wl_items])
    ip_matrix = pd.DataFrame(ip_scores, index=index).reindex(
        columns=[i.id for i in ip_items])

    # Subscale means, expressed 0-100 like the app's subscores.
    for items, matrix, scale_max, prefix in (
        (wl_items, wl_matrix, config.WORKLOAD_MAX, "WL"),
        (ip_items, ip_matrix, config.IPC_MAX, "IPC"),
    ):
        for name in subscales(items):
            ids = [i.id for i in items if i.subscale == name]
            if not ids or matrix.empty:
                participants[f"{prefix}: {name}"] = np.nan
                continue
            total = matrix[ids].sum(axis=1).to_numpy()
            participants[f"{prefix}: {name}"] = [
                _normalise(t, len(ids), scale_max) for t in total
            ]

    items_long = _build_items_long(wl_matrix, ip_matrix, wl_items, ip_items, records)

    integrity = {
        "n_records": len(records),
        "n_excluded": n_excluded,
        "score_mismatches": score_mismatches,
        "missing_workload_answers": total_missing_wl,
        "missing_ipc_answers": total_missing_ipc,
        "duplicate_nurse_codes": _duplicate_codes(participants),
    }
    return Dataset(participants, wl_matrix, ip_matrix, items_long,
                   wl_items, ip_items, integrity)


def _build_items_long(wl_matrix, ip_matrix, wl_items, ip_items, records) -> pd.DataFrame:
    """One row per participant x item, carrying both the raw and scored value."""
    raw_lookup = {
        r.get("id"): (r.get("workloadResponses", {}) or {}, r.get("ipcResponses", {}) or {})
        for r in records
    }
    frames = []
    for matrix, items, scale, which in ((wl_matrix, wl_items, "Workload", 0),
                                        (ip_matrix, ip_items, "IPC", 1)):
        if matrix.empty:
            continue
        meta = {i.id: i for i in items}
        stacked = matrix.stack().reset_index()
        stacked.columns = ["id", "item_id", "scored"]
        stacked["scale"] = scale
        stacked["subscale"] = stacked["item_id"].map(lambda i: meta[i].subscale)
        stacked["reversed"] = stacked["item_id"].map(lambda i: meta[i].reversed)
        stacked["text"] = stacked["item_id"].map(lambda i: meta[i].text)
        stacked["raw"] = [
            _to_number(raw_lookup.get(pid, ({}, {}))[which].get(str(iid),
                       raw_lookup.get(pid, ({}, {}))[which].get(iid, np.nan)))
            for pid, iid in zip(stacked["id"], stacked["item_id"])
        ]
        frames.append(stacked)
    if not frames:
        return pd.DataFrame(columns=["id", "item_id", "scored", "scale",
                                     "subscale", "reversed", "text", "raw"])
    return pd.concat(frames, ignore_index=True)


def _duplicate_codes(participants: pd.DataFrame) -> list[str]:
    if participants.empty or "nurseCode" not in participants:
        return []
    counts = participants["nurseCode"].value_counts()
    return counts[counts > 1].index.tolist()


def _workload_category(score: float) -> str:
    if score < 25:
        return "Low"
    if score < 50:
        return "Moderate"
    if score < 75:
        return "High"
    return "Very High"


def _ipc_category(score: float) -> str:
    if score < 50:
        return "Poor"
    if score < 70:
        return "Suboptimal"
    if score < 90:
        return "Satisfactory"
    return "Optimal"
