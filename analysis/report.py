"""Assemble the statistical tables and a written summary of the findings."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd

import analytics as A
import config
from dataset import Dataset
from instruments import short_label, subscales


def _write_table(df: pd.DataFrame, path: Path) -> None:
    if df is None or df.empty:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8-sig")


def _cell(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "—"
    if isinstance(value, float):
        text = f"{value:.3f}".rstrip("0").rstrip(".")
        return text or "0"
    return str(value).replace("|", "\\|")


def _md(df: pd.DataFrame) -> str:
    """Render a markdown table without pulling in `tabulate`."""
    if df is None or df.empty:
        return "_No data._\n"
    headers = [str(c) for c in df.columns]
    rows = [[_cell(v) for v in row] for row in df.itertuples(index=False, name=None)]
    widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h)
              for i, h in enumerate(headers)]
    out = ["| " + " | ".join(h.ljust(w) for h, w in zip(headers, widths)) + " |",
           "| " + " | ".join("-" * w for w in widths) + " |"]
    out += ["| " + " | ".join(c.ljust(w) for c, w in zip(row, widths)) + " |"
            for row in rows]
    return "\n".join(out) + "\n"


def build_tables(ds: Dataset, table_dir: Path) -> dict[str, pd.DataFrame]:
    p = ds.participants
    tables: dict[str, pd.DataFrame] = {}

    numeric = ["workloadScore", "ipcScore", "yearsExperience", "patientLoad"]
    numeric += [f"WL: {s}" for s in subscales(ds.workload_items)]
    numeric += [f"IPC: {s}" for s in subscales(ds.ipc_items)]
    tables["descriptives"] = A.descriptives(p, [c for c in numeric if c in p.columns])

    for col, label in (("ward", "Ward"), ("shift", "Shift"),
                       ("qualification", "Qualification"),
                       ("workloadCategory", "Workload category"),
                       ("ipcCategory", "IPC category")):
        if col in p.columns and not p.empty:
            tables[f"frequency_{col}"] = A.frequency_table(p[col], label)

    for col in ("ward", "shift", "qualification"):
        if col in p.columns and not p.empty:
            for measure in ("workloadScore", "ipcScore"):
                key = f"group_{col}_{measure}"
                tables[key] = A.group_summary(p, measure, col)

    if not ds.workload_matrix.empty:
        tables["item_analysis_workload"] = A.item_analysis(
            ds.workload_matrix,
            {i.id: short_label(i.text, 90) for i in ds.workload_items})
    if not ds.ipc_matrix.empty:
        tables["item_analysis_ipc"] = A.item_analysis(
            ds.ipc_matrix,
            {i.id: short_label(i.text, 90) for i in ds.ipc_items})

    subscale_cols = ([f"WL: {s}" for s in subscales(ds.workload_items)]
                     + [f"IPC: {s}" for s in subscales(ds.ipc_items)])
    subscale_cols = [c for c in subscale_cols if c in p.columns]
    if len(p) >= 4 and len(subscale_cols) >= 2:
        rho, pvals = A.correlation_matrix(p, subscale_cols)
        tables["subscale_correlations"] = rho.round(3).reset_index(names="Subscale")
        tables["subscale_correlation_pvalues"] = pvals.round(4).reset_index(names="Subscale")

    if not p.empty:
        crosstab, _ = A.category_association(p)
        tables["category_crosstab"] = crosstab.reset_index()
        tables["participants"] = p

    for name, table in tables.items():
        _write_table(table, table_dir / f"{name}.csv")
    return tables


def write_report(ds: Dataset, tables: dict[str, pd.DataFrame], figure_dir: Path,
                 path: Path, source_label: str) -> Path:
    p = ds.participants
    n = len(p)
    lines: list[str] = []
    add = lines.append

    add("# UNIOSUNTH Nursing Workload & IPC Compliance — Analysis Report")
    add("")
    add(f"_Generated {datetime.now().strftime('%d %B %Y, %H:%M')} · source: {source_label}_")
    add("")

    if n == 0:
        add("## No records yet")
        add("")
        add("The `assessment_records` collection is empty, so there is nothing to "
            "analyse. Once nurses begin submitting assessments, re-run:")
        add("")
        add("```\npython run_analysis.py\n```")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(lines), encoding="utf-8")
        return path

    # ── Headline ──────────────────────────────────────────────────────────
    corr = A.spearman(p["workloadScore"], p["ipcScore"])
    add("## 1. Headline finding")
    add("")
    if corr is None:
        add(f"With only {n} record(s) there is not yet enough data to estimate the "
            "workload–compliance relationship.")
    else:
        direction = "falls as workload rises" if corr.rho < 0 else "rises with workload"
        verdict = ("statistically significant" if corr.significant
                   else "not statistically significant at the .05 level")
        add(f"Across **{corr.n} assessments**, IPC compliance {direction}: "
            f"**Spearman ρ = {corr.rho:+.3f}** "
            f"(95% CI {corr.ci_low:+.3f} to {corr.ci_high:+.3f}), "
            f"p {A.fmt_p(corr.p)} — a **{corr.interpret()}** association, {verdict}.")
        add("")
        add(f"Mean workload score was **{p['workloadScore'].mean():.1f}** "
            f"(SD {p['workloadScore'].std(ddof=1):.1f}) and mean IPC compliance "
            f"**{p['ipcScore'].mean():.1f}** (SD {p['ipcScore'].std(ddof=1):.1f}), "
            "both on a 0–100 scale.")
    add("")
    add("![Workload vs IPC compliance](figures/04_workload_vs_ipc.png)")
    add("")

    # ── Sample ────────────────────────────────────────────────────────────
    add("## 2. Sample")
    add("")
    add(f"**n = {n} completed assessments.**")
    add("")
    for col, heading in (("ward", "Ward"), ("shift", "Shift"),
                         ("qualification", "Qualification")):
        key = f"frequency_{col}"
        if key in tables:
            add(f"**By {heading.lower()}**")
            add("")
            add(_md(tables[key]))
    add("![Sample composition](figures/01_sample_composition.png)")
    add("")

    # ── Descriptives ──────────────────────────────────────────────────────
    add("## 3. Descriptive statistics")
    add("")
    add(_md(tables.get("descriptives")))
    add("![Score distributions](figures/02_score_distributions.png)")
    add("")
    add("![Category distribution](figures/03_category_pies.png)")
    add("")

    # ── Reliability ───────────────────────────────────────────────────────
    add("## 4. Internal consistency (reliability)")
    add("")
    rows = []
    for label, matrix, items in (("Workload scale (12 items)", ds.workload_matrix, ds.workload_items),
                                 ("CSPS IPC scale (20 items)", ds.ipc_matrix, ds.ipc_items)):
        rel = A.cronbach_alpha(matrix)
        if rel:
            rows.append({"Scale": label, "Items": rel.n_items, "n": rel.n_cases,
                         "Cronbach α": rel.alpha,
                         "95% CI": f"{rel.ci_low}–{rel.ci_high}",
                         "Interpretation": rel.interpret()})
        for sub in subscales(items):
            ids = [i.id for i in items if i.subscale == sub]
            sub_rel = A.cronbach_alpha(matrix[ids]) if len(ids) > 1 and not matrix.empty else None
            if sub_rel:
                rows.append({"Scale": f"  └ {sub}", "Items": sub_rel.n_items,
                             "n": sub_rel.n_cases, "Cronbach α": sub_rel.alpha,
                             "95% CI": f"{sub_rel.ci_low}–{sub_rel.ci_high}",
                             "Interpretation": sub_rel.interpret()})
    reliability = pd.DataFrame(rows)
    add(_md(reliability))
    if not reliability.empty:
        _write_table(reliability, config.TABLE_DIR / "reliability.csv")
        tables["reliability"] = reliability
    add("Values of α ≥ .70 are conventionally treated as acceptable for group-level "
        "research use. Item-level detail, including alpha-if-deleted, is in "
        "`tables/item_analysis_workload.csv` and `tables/item_analysis_ipc.csv`.")
    add("")

    # ── Group comparisons ─────────────────────────────────────────────────
    add("## 5. Group comparisons")
    add("")
    comparisons = []
    for col, label in (("ward", "Ward"), ("shift", "Shift"),
                       ("qualification", "Qualification"),
                       ("workloadCategory", "Workload band")):
        for measure, measure_label in (("workloadScore", "Workload"),
                                       ("ipcScore", "IPC compliance")):
            if col == "workloadCategory" and measure == "workloadScore":
                continue  # circular
            test = A.compare_groups(p, measure, col)
            if test:
                comparisons.append({
                    "Grouping": label, "Outcome": measure_label, "Test": test.test,
                    "Statistic": round(test.statistic, 3), "p": A.fmt_p(test.p),
                    "Effect": f"{test.effect} ({test.effect_name})",
                    "Magnitude": test.interpret_effect(),
                    "Significant": "yes" if test.significant else "no",
                })
    comparison_table = pd.DataFrame(comparisons)
    add(_md(comparison_table))
    if not comparison_table.empty:
        _write_table(comparison_table, config.TABLE_DIR / "group_comparisons.csv")
        tables["group_comparisons"] = comparison_table
    add("")
    add("![IPC by workload band](figures/05_ipc_by_workload_band.png)")
    add("")
    add("![Scores by ward](figures/06_scores_by_ward.png)")
    add("")
    add("![Scores by shift](figures/07_scores_by_shift.png)")
    add("")
    add("![Scores by qualification](figures/08_scores_by_qualification.png)")
    add("")

    # ── Subscales ─────────────────────────────────────────────────────────
    add("## 6. Subscale analysis")
    add("")
    add("![Subscale profiles](figures/09_subscale_profiles.png)")
    add("")
    add("![Subscale correlations](figures/10_subscale_heatmap.png)")
    add("")

    # ── Item level ────────────────────────────────────────────────────────
    add("## 7. Item-level compliance")
    add("")
    ipc_long = ds.items_long[ds.items_long["scale"] == "IPC"]
    if not ipc_long.empty:
        means = ipc_long.groupby("item_id")["scored"].mean().sort_values()
        meta = {i.id: i for i in ds.ipc_items}
        add("The five weakest standard precautions in this sample:")
        add("")
        weakest = pd.DataFrame([
            {"Item": int(i), "Mean (1–4)": round(float(v), 2),
             "Statement": short_label(meta[int(i)].text, 95)}
            for i, v in means.head(5).items()
        ])
        add(_md(weakest))
        _write_table(weakest, config.TABLE_DIR / "weakest_practices.csv")
        tables["weakest_practices"] = weakest
    add("![IPC item ranking](figures/11_ipc_item_ranking.png)")
    add("")
    add("![IPC Likert profile](figures/12_ipc_likert.png)")
    add("")
    add("![Workload Likert profile](figures/13_workload_likert.png)")
    add("")
    add("![Ward compliance mix](figures/14_ward_compliance_mix.png)")
    add("")
    add("![Patient load](figures/15_patient_load.png)")
    add("")

    # ── Data integrity ────────────────────────────────────────────────────
    add("## 8. Data integrity")
    add("")
    integrity = ds.integrity
    add(f"- Records read: **{integrity['n_records']}**")
    mismatches = integrity["score_mismatches"]
    if mismatches:
        add(f"- ⚠ **{len(mismatches)} record(s) whose stored score disagrees with the "
            "score recomputed from the raw item responses.** The recomputed value is "
            "used throughout this report. See `tables/score_mismatches.csv`.")
        _write_table(pd.DataFrame(mismatches), config.TABLE_DIR / "score_mismatches.csv")
    else:
        add("- Every stored score matches the score recomputed from raw item "
            "responses. The app's scoring and this analysis agree exactly.")
    add(f"- Unanswered workload items treated as 1: **{integrity['missing_workload_answers']}**")
    add(f"- Unanswered IPC items treated as 1: **{integrity['missing_ipc_answers']}**")
    duplicates = integrity["duplicate_nurse_codes"]
    add(f"- Repeated nurse codes: **{len(duplicates)}**"
        + (f" ({', '.join(duplicates[:8])})" if duplicates else
           " — every assessment carries a distinct code"))
    add("")

    add("## 9. Notes on method")
    add("")
    add("- Scores are normalised to 0–100 using the instrument's own minimum and "
        "maximum, exactly as the data-collection app does.")
    add("- Reverse-keyed CSPS items (3, 8, 10, 11) are inverted before scoring, so a "
        "higher score always means better compliance.")
    add("- Nonparametric tests throughout (Spearman, Mann-Whitney, Kruskal-Wallis): "
        "Likert-derived scores are ordinal and normality is not assumed.")
    add("- Effect sizes accompany every test — with a single-site sample, the size of "
        "a difference matters more than its p-value.")
    add("- Groups with fewer than 3 nurses are excluded from group tests.")
    add("")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
    return path
