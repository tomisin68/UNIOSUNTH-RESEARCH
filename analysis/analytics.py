"""Statistics for the workload / IPC-compliance study.

Everything here is nonparametric or distribution-free where the measurement
level demands it: Likert-derived scores are ordinal, sample sizes in a single
teaching hospital are modest, and normality should not be assumed. Effect sizes
accompany every test, because with a few hundred nurses a p-value alone says
very little.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats


# ── Descriptives ──────────────────────────────────────────────────────────

def descriptives(df: pd.DataFrame, columns: Sequence[str]) -> pd.DataFrame:
    rows = []
    for col in columns:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.empty:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        rows.append({
            "Measure": col,
            "n": int(s.size),
            "Mean": round(s.mean(), 2),
            "SD": round(s.std(ddof=1), 2) if s.size > 1 else np.nan,
            "Median": round(s.median(), 2),
            "IQR": f"{q1:.1f}–{q3:.1f}",
            "Min": round(s.min(), 2),
            "Max": round(s.max(), 2),
            "Skew": round(float(stats.skew(s)), 2) if s.size > 2 else np.nan,
        })
    return pd.DataFrame(rows)


def frequency_table(series: pd.Series, label: str = "Category") -> pd.DataFrame:
    counts = series.value_counts(dropna=False, sort=False)
    if isinstance(series.dtype, pd.CategoricalDtype):
        counts = counts.reindex(series.cat.categories, fill_value=0)
    else:
        counts = counts.sort_values(ascending=False)
    total = int(counts.sum())
    return pd.DataFrame({
        label: counts.index.astype(str),
        "n": counts.to_numpy(dtype=int),
        "%": [round(c / total * 100, 1) if total else 0.0 for c in counts],
    }).reset_index(drop=True)


# ── Reliability ───────────────────────────────────────────────────────────

@dataclass
class Reliability:
    alpha: float
    ci_low: float
    ci_high: float
    n_items: int
    n_cases: int

    def interpret(self) -> str:
        a = self.alpha
        if a >= 0.9:
            return "excellent"
        if a >= 0.8:
            return "good"
        if a >= 0.7:
            return "acceptable"
        if a >= 0.6:
            return "questionable"
        if a >= 0.5:
            return "poor"
        return "unacceptable"


def cronbach_alpha(matrix: pd.DataFrame, conf: float = 0.95) -> Reliability | None:
    """Cronbach's alpha with a Feldt confidence interval.

    `matrix` is cases x items, already reverse-corrected.
    """
    data = matrix.dropna(axis=0, how="any")
    n_cases, n_items = data.shape
    if n_cases < 3 or n_items < 2:
        return None

    item_var = data.var(axis=0, ddof=1).sum()
    total_var = data.sum(axis=1).var(ddof=1)
    if total_var == 0:
        return None
    alpha = (n_items / (n_items - 1)) * (1 - item_var / total_var)

    # Feldt (1965): (1-alpha) * F ratios give the interval.
    df1, df2 = n_cases - 1, (n_cases - 1) * (n_items - 1)
    tail = (1 - conf) / 2
    ci_low = 1 - (1 - alpha) * stats.f.ppf(1 - tail, df1, df2)
    ci_high = 1 - (1 - alpha) * stats.f.ppf(tail, df1, df2)
    return Reliability(round(float(alpha), 3), round(float(ci_low), 3),
                       round(float(ci_high), 3), n_items, n_cases)


def item_analysis(matrix: pd.DataFrame, item_labels: dict[int, str]) -> pd.DataFrame:
    """Corrected item-total correlation and alpha-if-item-deleted."""
    data = matrix.dropna(axis=0, how="any")
    if data.shape[0] < 3 or data.shape[1] < 3:
        return pd.DataFrame()

    rows = []
    for item in data.columns:
        rest = data.drop(columns=[item]).sum(axis=1)
        if data[item].std(ddof=1) == 0 or rest.std(ddof=1) == 0:
            r = np.nan
        else:
            r = float(stats.spearmanr(data[item], rest).statistic)
        dropped = cronbach_alpha(data.drop(columns=[item]))
        rows.append({
            "Item": item,
            "Statement": item_labels.get(item, ""),
            "Mean": round(float(data[item].mean()), 2),
            "SD": round(float(data[item].std(ddof=1)), 2),
            "Item-total r": round(r, 3) if not np.isnan(r) else np.nan,
            "Alpha if dropped": dropped.alpha if dropped else np.nan,
        })
    return pd.DataFrame(rows)


# ── Correlation ───────────────────────────────────────────────────────────

@dataclass
class Correlation:
    rho: float
    p: float
    n: int
    ci_low: float
    ci_high: float

    def interpret(self) -> str:
        a = abs(self.rho)
        strength = ("negligible" if a < 0.10 else "weak" if a < 0.30 else
                    "moderate" if a < 0.50 else "strong" if a < 0.70 else "very strong")
        if a < 0.10:
            return strength
        return f"{strength} {'negative' if self.rho < 0 else 'positive'}"

    @property
    def significant(self) -> bool:
        return self.p < 0.05


def spearman(x: Sequence[float], y: Sequence[float], conf: float = 0.95
             ) -> Correlation | None:
    """Spearman's rho with a Bonett-Wright confidence interval."""
    frame = pd.DataFrame({"x": pd.to_numeric(pd.Series(list(x)), errors="coerce"),
                          "y": pd.to_numeric(pd.Series(list(y)), errors="coerce")}).dropna()
    n = len(frame)
    if n < 4 or frame["x"].nunique() < 2 or frame["y"].nunique() < 2:
        return None

    result = stats.spearmanr(frame["x"], frame["y"])
    rho = float(result.statistic)
    p = float(result.pvalue)

    # Fisher z with the Bonett-Wright standard error for rank correlations.
    rho_c = np.clip(rho, -0.9999, 0.9999)
    z = np.arctanh(rho_c)
    se = np.sqrt((1 + rho_c ** 2 / 2) / (n - 3))
    crit = stats.norm.ppf(1 - (1 - conf) / 2)
    return Correlation(round(rho, 3), p, n,
                       round(float(np.tanh(z - crit * se)), 3),
                       round(float(np.tanh(z + crit * se)), 3))


def correlation_matrix(df: pd.DataFrame, columns: Sequence[str]
                       ) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Spearman rho matrix and matching p-value matrix."""
    cols = [c for c in columns if c in df.columns]
    data = df[cols].apply(pd.to_numeric, errors="coerce")
    rho = pd.DataFrame(np.eye(len(cols)), index=cols, columns=cols)
    pvals = pd.DataFrame(np.zeros((len(cols), len(cols))), index=cols, columns=cols)
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            pair = data[[a, b]].dropna()
            if len(pair) < 4:
                r = p = np.nan
            else:
                res = stats.spearmanr(pair[a], pair[b])
                r, p = float(res.statistic), float(res.pvalue)
            rho.loc[a, b] = rho.loc[b, a] = r
            pvals.loc[a, b] = pvals.loc[b, a] = p
    return rho, pvals


# ── Group comparisons ─────────────────────────────────────────────────────

@dataclass
class GroupTest:
    test: str
    statistic: float
    p: float
    effect_name: str
    effect: float
    groups: int
    n: int

    def interpret_effect(self) -> str:
        e = abs(self.effect)
        if self.effect_name == "epsilon-squared":
            return "large" if e >= 0.14 else "medium" if e >= 0.06 else "small" if e >= 0.01 else "negligible"
        return "large" if e >= 0.5 else "medium" if e >= 0.3 else "small" if e >= 0.1 else "negligible"

    @property
    def significant(self) -> bool:
        return self.p < 0.05


def compare_groups(df: pd.DataFrame, value_col: str, group_col: str,
                   min_group: int = 3) -> GroupTest | None:
    """Kruskal-Wallis across 3+ groups, Mann-Whitney U for exactly 2."""
    frame = df[[value_col, group_col]].copy()
    frame[value_col] = pd.to_numeric(frame[value_col], errors="coerce")
    frame = frame.dropna()
    if frame.empty:
        return None

    groups = [g[value_col].to_numpy() for _, g in frame.groupby(group_col, observed=True)
              if len(g) >= min_group]
    if len(groups) < 2:
        return None
    n = int(sum(len(g) for g in groups))

    if len(groups) == 2:
        a, b = groups
        result = stats.mannwhitneyu(a, b, alternative="two-sided")
        u = float(result.statistic)
        # Rank-biserial: +1 means every value in group A exceeds group B.
        effect = (2 * u) / (len(a) * len(b)) - 1
        return GroupTest("Mann-Whitney U", u, float(result.pvalue),
                         "rank-biserial r", round(effect, 3), 2, n)

    result = stats.kruskal(*groups)
    h = float(result.statistic)
    epsilon_sq = h / (n - 1) if n > 1 else np.nan
    return GroupTest("Kruskal-Wallis H", round(h, 3), float(result.pvalue),
                     "epsilon-squared", round(epsilon_sq, 3), len(groups), n)


def group_summary(df: pd.DataFrame, value_col: str, group_col: str) -> pd.DataFrame:
    frame = df[[value_col, group_col]].copy()
    frame[value_col] = pd.to_numeric(frame[value_col], errors="coerce")
    frame = frame.dropna()
    if frame.empty:
        return pd.DataFrame()
    out = (frame.groupby(group_col, observed=True)[value_col]
           .agg(n="size", Mean="mean", SD=lambda s: s.std(ddof=1), Median="median")
           .reset_index())
    out["Mean"] = out["Mean"].round(1)
    out["SD"] = out["SD"].round(1)
    out["Median"] = out["Median"].round(1)
    return out.rename(columns={group_col: group_col.title()})


def category_association(df: pd.DataFrame, a: str = "workloadCategory",
                         b: str = "ipcCategory") -> tuple[pd.DataFrame, dict]:
    """Cross-tabulate the two outcome categories and test for association."""
    table = pd.crosstab(df[a], df[b], dropna=False)
    stat: dict = {"test": "Chi-square", "valid": False}
    if table.to_numpy().sum() > 0 and table.shape[0] > 1 and table.shape[1] > 1:
        chi2, p, dof, expected = stats.chi2_contingency(table)
        n = int(table.to_numpy().sum())
        min_dim = min(table.shape) - 1
        stat = {
            "test": "Chi-square", "valid": True, "chi2": round(float(chi2), 3),
            "p": float(p), "dof": int(dof), "n": n,
            # Cramer's V for effect size.
            "cramers_v": round(float(np.sqrt(chi2 / (n * min_dim))), 3) if min_dim else np.nan,
            "min_expected": round(float(expected.min()), 2),
        }
    return table, stat


# ── Formatting helpers ────────────────────────────────────────────────────

def fmt_p(p: float) -> str:
    if p != p:  # NaN
        return "n/a"
    if p < 0.001:
        return "< .001"
    return f"= {p:.3f}".replace("0.", ".")
