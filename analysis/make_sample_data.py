"""Generate a synthetic dataset for testing the analysis pipeline.

This writes a LOCAL JSON FILE ONLY. It never touches Firestore — the real study
database must never contain fabricated records. Use it to exercise the charts
and statistics before real data collection begins, then delete the file.

    python make_sample_data.py --n 120 --out output/sample_records.json
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import config
from instruments import ipc_items, workload_items

# Mirrors src/data/wards.ts — the clinical areas of UNIOSUNTH.
WARDS = [
    "Male Medical Ward", "Female Medical Ward", "Renal Unit",
    "Male Surgical Ward", "Female Surgical Ward", "Orthopaedic Ward", "Burns Unit",
    "Paediatric Medical Ward 1", "Paediatric Medical Ward 2",
    "Paediatric Surgical Ward", "Special Care Baby Unit (SCBU)",
    "Intensive Care Unit (ICU)", "Theatre",
    "Labour Ward", "Post-Natal Ward", "Gynaecology Ward",
    "Accident & Emergency (A&E)", "Children Emergency Unit (CEU)",
]
SHIFTS = ["Morning", "Afternoon", "Night"]
QUALIFICATIONS = ["RN", "BNSc", "RN+BNSc", "MSc", "PhD"]
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# Ward-level workload pressure (latent, arbitrary units) so group tests have
# something real to find rather than pure noise.
WARD_PRESSURE = {
    "Male Medical Ward": 0.35, "Female Medical Ward": 0.30, "Renal Unit": 0.20,
    "Male Surgical Ward": 0.40, "Female Surgical Ward": 0.35,
    "Orthopaedic Ward": 0.45, "Burns Unit": 0.55,
    "Paediatric Medical Ward 1": 0.25, "Paediatric Medical Ward 2": 0.25,
    "Paediatric Surgical Ward": 0.35, "Special Care Baby Unit (SCBU)": 0.50,
    "Intensive Care Unit (ICU)": 0.75, "Theatre": 0.45,
    "Labour Ward": 0.70, "Post-Natal Ward": 0.30, "Gynaecology Ward": 0.20,
    "Accident & Emergency (A&E)": 0.80, "Children Emergency Unit (CEU)": 0.65,
}
SHIFT_PRESSURE = {"Morning": 0.25, "Afternoon": 0.00, "Night": 0.40}


def _nurse_code(rng: random.Random) -> str:
    return "NRS-" + "".join(rng.choice(CODE_ALPHABET) for _ in range(6))


def _likert(latent: float, scale_max: int, rng: np.random.Generator,
            noise: float = 0.8) -> int:
    """Draw a Likert response from a latent trait, clipped to the scale."""
    value = latent + rng.normal(0, noise)
    lo, hi = 1, scale_max
    midpoint = (lo + hi) / 2
    spread = (hi - lo) / 4
    return int(np.clip(round(midpoint + value * spread), lo, hi))


def _normalise(total: float, n_items: int, scale_max: int) -> int:
    lo, hi = n_items, n_items * scale_max
    return round((total - lo) / (hi - lo) * 100)


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


def generate(n: int = 120, seed: int = 20260822,
             true_rho: float = -0.45) -> list[dict]:
    """Build n synthetic assessments with a genuine workload -> IPC relationship."""
    rng = np.random.default_rng(seed)
    pyrng = random.Random(seed)
    wl_items, ip_items = workload_items(), ipc_items()
    wl_subscales = sorted({i.subscale for i in wl_items})
    ip_subscales = sorted({i.subscale for i in ip_items})

    records = []
    start = datetime.now(timezone.utc) - timedelta(days=45)

    for k in range(n):
        ward = pyrng.choice(WARDS)
        shift = pyrng.choice(SHIFTS)
        qualification = pyrng.choices(
            QUALIFICATIONS, weights=[38, 30, 20, 9, 3])[0]
        years = max(0, int(rng.gamma(2.2, 3.4)))
        experience_relief = -min(years, 25) / 40.0

        # Latent workload, and a latent IPC trait correlated with it.
        w_latent = (rng.normal(0, 1) * 0.75
                    + WARD_PRESSURE[ward] + SHIFT_PRESSURE[shift])
        independent = rng.normal(0, 1)
        i_latent = (true_rho * w_latent
                    + np.sqrt(max(0.0, 1 - true_rho ** 2)) * independent
                    - experience_relief * 0.8
                    + 0.55)

        patient_load = int(np.clip(round(7 + w_latent * 3.4 + rng.normal(0, 1.6)), 1, 30))

        workload_responses, ipc_responses = {}, {}
        for item in wl_items:
            workload_responses[str(item.id)] = _likert(
                w_latent, config.WORKLOAD_MAX, rng)
        for item in ip_items:
            score = _likert(i_latent, config.IPC_MAX, rng)
            # Store the RAW answer: reverse-keyed items are inverted on the way in.
            ipc_responses[str(item.id)] = (
                config.IPC_MAX + 1 - score if item.reversed else score)

        wl_total = sum(workload_responses.values())
        ipc_total = sum(
            (config.IPC_MAX + 1 - v) if next(i for i in ip_items if i.id == int(k2)).reversed else v
            for k2, v in ipc_responses.items()
        )
        wl_score = _normalise(wl_total, len(wl_items), config.WORKLOAD_MAX)
        ipc_score = _normalise(ipc_total, len(ip_items), config.IPC_MAX)

        def subscore(items, responses, names, scale_max):
            out = {}
            for name in names:
                ids = [i.id for i in items if i.subscale == name]
                total = sum(
                    (scale_max + 1 - responses[str(i.id)])
                    if next(x for x in items if x.id == i.id).reversed
                    else responses[str(i.id)]
                    for i in items if i.id in ids
                )
                out[name] = _normalise(total, len(ids), scale_max)
            return out

        submitted = start + timedelta(
            days=pyrng.uniform(0, 45), hours=pyrng.uniform(0, 24))

        records.append({
            "id": f"sample-{k:04d}",
            "nurseCode": _nurse_code(pyrng),
            "ward": ward,
            "shift": shift,
            "qualification": qualification,
            "yearsExperience": str(years),
            "patientLoad": str(patient_load),
            "assessmentDate": submitted.date().isoformat(),
            "timestamp": submitted.strftime("%m/%d/%Y, %I:%M:%S %p"),
            "workloadScore": wl_score,
            "ipcScore": ipc_score,
            "workloadCategory": _workload_category(wl_score),
            "ipcCategory": _ipc_category(ipc_score),
            "subscoreWorkload": subscore(wl_items, workload_responses,
                                         wl_subscales, config.WORKLOAD_MAX),
            "subscoreIPC": subscore(ip_items, ipc_responses,
                                    ip_subscales, config.IPC_MAX),
            "workloadResponses": workload_responses,
            "ipcResponses": ipc_responses,
            "submittedAt": submitted.isoformat().replace("+00:00", "Z"),
        })
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=120, help="number of records")
    parser.add_argument("--seed", type=int, default=20260822)
    parser.add_argument("--rho", type=float, default=-0.45,
                        help="target workload/IPC association")
    parser.add_argument("--out", type=Path,
                        default=config.OUTPUT_DIR / "sample_records.json")
    args = parser.parse_args()

    records = generate(args.n, args.seed, args.rho)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} synthetic records to {args.out}")
    print("This file is LOCAL ONLY — nothing was written to Firestore.")


if __name__ == "__main__":
    main()
