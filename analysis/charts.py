"""Publication-quality figures for the workload / IPC study.

Colour choices are not free-hand. The palette in `config` was checked with the
data-viz validator against this light surface; the obvious green-amber-red risk
ramp fails colour-vision separation badly (red vs green ΔE 4.1 under
deuteranopia), so ordered categories use a single-hue ordinal ramp and always
carry their names as text. Workload is always blue and IPC always orange, in
every figure, so a reader who learns the mapping once keeps it.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

import analytics as A
import config
from dataset import Dataset
from instruments import short_label, subscales

# ── Global style ──────────────────────────────────────────────────────────

plt.rcParams.update({
    "figure.facecolor": config.SURFACE,
    "axes.facecolor": config.SURFACE,
    "savefig.facecolor": config.SURFACE,
    "font.family": "sans-serif",
    "font.sans-serif": ["Segoe UI", "Helvetica Neue", "Arial", "DejaVu Sans"],
    "font.size": 9,
    "axes.titlesize": 11,
    "axes.titleweight": "600",
    "axes.titlecolor": config.INK_PRIMARY,
    "axes.labelsize": 9,
    "axes.labelcolor": config.INK_SECONDARY,
    "axes.edgecolor": config.BASELINE,
    "axes.linewidth": 0.8,
    "xtick.color": config.INK_MUTED,
    "ytick.color": config.INK_MUTED,
    "xtick.labelcolor": config.INK_SECONDARY,
    "ytick.labelcolor": config.INK_SECONDARY,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.frameon": False,
    "legend.fontsize": 8,
    "figure.autolayout": False,
})

DIVERGING = LinearSegmentedColormap.from_list(
    "wl_div", [config.DIVERGING_LOW, config.DIVERGING_MID, config.DIVERGING_HIGH])


def _style(ax, *, grid_axis: str = "y", hide_spines=("top", "right")) -> None:
    """Hairline solid grid behind the marks; recessive chrome."""
    for spine in hide_spines:
        ax.spines[spine].set_visible(False)
    for spine in ax.spines.values():
        spine.set_color(config.BASELINE)
        spine.set_linewidth(0.8)
    if grid_axis:
        ax.grid(axis=grid_axis, color=config.GRIDLINE, linewidth=0.7,
                linestyle="-", zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)


def _title(ax, title: str, subtitle: str | None = None) -> None:
    """Axes-anchored title. Pad clears the subtitle line beneath it."""
    ax.set_title(title, loc="left", pad=24 if subtitle else 8)
    if subtitle:
        ax.text(0, 1.015, subtitle, transform=ax.transAxes, fontsize=8,
                color=config.INK_MUTED, va="bottom")


def _fig_title(fig, title: str, subtitle: str | None = None) -> float:
    """Figure-anchored title, for plots whose long y labels push the axes right.

    Returns the top of the area the axes may occupy, for tight_layout's rect.
    """
    points = fig.get_figheight() * 72
    fig.suptitle(title, x=0.006, ha="left", y=1 - 14 / points, va="top",
                 fontsize=12, fontweight="600", color=config.INK_PRIMARY)
    if not subtitle:
        return 1 - 30 / points
    fig.text(0.006, 1 - 32 / points, subtitle, ha="left", va="top",
             fontsize=8, color=config.INK_MUTED)
    return 1 - 48 / points


def _save(fig, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=config.FIGURE_DPI, bbox_inches="tight",
                facecolor=config.SURFACE)
    plt.close(fig)
    return path


def _empty(ax, message: str = "No data yet") -> None:
    ax.text(0.5, 0.5, message, ha="center", va="center", fontsize=10,
            color=config.INK_MUTED, transform=ax.transAxes)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)


# ── 1. Score distributions ────────────────────────────────────────────────

def score_distributions(ds: Dataset, out: Path) -> Path:
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
    p = ds.participants
    specs = [("workloadScore", "Nursing workload score", config.SERIES_WORKLOAD),
             ("ipcScore", "IPC compliance score (CSPS)", config.SERIES_IPC)]

    for ax, (col, label, colour) in zip(axes, specs):
        values = pd.to_numeric(p[col], errors="coerce").dropna() if not p.empty else pd.Series(dtype=float)
        if values.empty:
            _empty(ax)
            ax.set_title(label, loc="left")
            continue
        ax.hist(values, bins=np.arange(0, 105, 5), color=colour,
                edgecolor=config.SURFACE, linewidth=1.2, zorder=2)
        median = values.median()
        ax.axvline(median, color=config.INK_PRIMARY, linewidth=1.2, zorder=3)
        ax.text(median, ax.get_ylim()[1] * 0.96, f"  median {median:.0f}",
                fontsize=8, color=config.INK_PRIMARY, va="top")
        _style(ax)
        ax.set_xlim(0, 100)
        ax.set_xlabel("Score (0–100)")
        ax.set_ylabel("Nurses")
        _title(ax, label, f"n = {len(values)}")

    fig.suptitle("Distribution of workload and IPC compliance scores",
                 x=0.005, ha="left", fontsize=12, fontweight="600",
                 color=config.INK_PRIMARY)
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    return _save(fig, out)


# ── 2. Category pies ──────────────────────────────────────────────────────

def category_pies(ds: Dataset, out: Path) -> Path:
    """Part-to-whole at a glance: 4 ordered slices each, always named."""
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.6))
    p = ds.participants
    specs = [("workloadCategory", "Workload category", config.WORKLOAD_CATEGORIES),
             ("ipcCategory", "IPC compliance category", config.IPC_CATEGORIES)]

    for ax, (col, label, order) in zip(axes, specs):
        if p.empty:
            _empty(ax)
            ax.set_title(label, loc="left")
            continue
        counts = p[col].value_counts().reindex(order, fill_value=0)
        total = int(counts.sum())
        keep = counts[counts > 0]
        if keep.empty:
            _empty(ax)
            continue
        colours = [config.ORDINAL_4[order.index(c)] for c in keep.index]

        wedges, _ = ax.pie(
            keep.to_numpy(), startangle=90, counterclock=False, colors=colours,
            wedgeprops={"edgecolor": config.SURFACE, "linewidth": 2},
        )
        # Direct labels outside the wedge — never colour alone.
        for wedge, name, value in zip(wedges, keep.index, keep.to_numpy()):
            angle = np.deg2rad((wedge.theta1 + wedge.theta2) / 2)
            x, y = np.cos(angle), np.sin(angle)
            ax.annotate(
                f"{name}\n{value} ({value / total * 100:.0f}%)",
                xy=(x * 0.82, y * 0.82), xytext=(x * 1.22, y * 1.18),
                ha="left" if x >= 0 else "right", va="center", fontsize=8,
                color=config.INK_SECONDARY,
                arrowprops={"arrowstyle": "-", "color": config.BASELINE,
                            "linewidth": 0.8, "shrinkA": 0, "shrinkB": 2},
            )
        ax.set_title(f"{label}  ·  n = {total}", loc="left", pad=10)
        ax.set_xlim(-1.9, 1.9)
        ax.set_ylim(-1.45, 1.45)

    fig.suptitle("How nurses distribute across workload and compliance bands",
                 x=0.005, ha="left", fontsize=12, fontweight="600",
                 color=config.INK_PRIMARY)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    return _save(fig, out)


# ── 3. The primary relationship ───────────────────────────────────────────

def workload_vs_ipc(ds: Dataset, out: Path) -> Path:
    fig, ax = plt.subplots(figsize=(7.2, 5.2))
    p = ds.participants
    if p.empty or len(p) < 4:
        _empty(ax, "Not enough data for a correlation")
        _title(ax, "Workload vs IPC compliance")
        return _save(fig, out)

    x = pd.to_numeric(p["workloadScore"], errors="coerce")
    y = pd.to_numeric(p["ipcScore"], errors="coerce")
    ax.scatter(x, y, s=44, color=config.SERIES_WORKLOAD, alpha=0.75,
               edgecolor=config.SURFACE, linewidth=1.4, zorder=3)

    corr = A.spearman(x, y)
    if corr is not None and len(x.dropna()) > 2:
        # Trend line on ranks-consistent OLS purely as a visual guide.
        mask = x.notna() & y.notna()
        slope, intercept = np.polyfit(x[mask], y[mask], 1)
        xs = np.linspace(x.min(), x.max(), 100)
        ax.plot(xs, slope * xs + intercept, color=config.INK_PRIMARY,
                linewidth=2, zorder=4)
        ax.text(
            0.98, 0.97,
            f"Spearman ρ = {corr.rho:+.3f}\n95% CI [{corr.ci_low:+.2f}, {corr.ci_high:+.2f}]\n"
            f"p {A.fmt_p(corr.p)}   n = {corr.n}",
            transform=ax.transAxes, ha="right", va="top", fontsize=9,
            color=config.INK_PRIMARY, linespacing=1.5,
            bbox={"facecolor": config.SURFACE, "edgecolor": config.GRIDLINE,
                  "boxstyle": "round,pad=0.5", "linewidth": 0.8},
        )

    _style(ax, grid_axis="both")
    ax.set_xlim(-2, 102)
    ax.set_ylim(-2, 102)
    ax.set_xlabel("Nursing workload score (higher = heavier workload)")
    ax.set_ylabel("IPC compliance score (higher = better compliance)")
    _title(ax, "Nursing workload against IPC compliance",
           "Each point is one completed assessment")
    fig.tight_layout()
    return _save(fig, out)


# ── 4-6. Grouped comparisons ──────────────────────────────────────────────

def _grouped_bars(ds: Dataset, group_col: str, title: str, out: Path,
                  order: list[str] | None = None) -> Path:
    p = ds.participants
    fig, ax = plt.subplots(figsize=(9, 5))
    if p.empty:
        _empty(ax)
        _title(ax, title)
        return _save(fig, out)

    grouped = (p.groupby(group_col, observed=True)[["workloadScore", "ipcScore"]]
               .mean().round(1))
    counts = p.groupby(group_col, observed=True).size()
    if order:
        grouped = grouped.reindex([o for o in order if o in grouped.index])
        counts = counts.reindex(grouped.index)
    else:
        grouped = grouped.sort_values("workloadScore", ascending=True)
        counts = counts.reindex(grouped.index)

    y = np.arange(len(grouped))
    height = 0.38
    ax.barh(y + height / 2 + 0.01, grouped["workloadScore"], height=height,
            color=config.SERIES_WORKLOAD, label="Workload", zorder=2)
    ax.barh(y - height / 2 - 0.01, grouped["ipcScore"], height=height,
            color=config.SERIES_IPC, label="IPC compliance", zorder=2)

    for i, (w, c) in enumerate(zip(grouped["workloadScore"], grouped["ipcScore"])):
        ax.text(w + 1, i + height / 2 + 0.01, f"{w:.0f}", va="center", fontsize=7.5,
                color=config.INK_SECONDARY)
        ax.text(c + 1, i - height / 2 - 0.01, f"{c:.0f}", va="center", fontsize=7.5,
                color=config.INK_SECONDARY)

    ax.set_yticks(y)
    ax.set_yticklabels([f"{idx}  (n={counts[idx]})" for idx in grouped.index])
    _style(ax, grid_axis="x")
    ax.set_xlim(0, 105)
    ax.set_xlabel("Mean score (0–100)")

    test = A.compare_groups(p, "ipcScore", group_col)
    subtitle = "Mean scores per group"
    if test:
        subtitle += (f"  ·  IPC across groups: {test.test} = {test.statistic:.2f}, "
                     f"p {A.fmt_p(test.p)}, {test.effect_name} = {test.effect} "
                     f"({test.interpret_effect()})")
    top = _fig_title(fig, title, subtitle)
    ax.legend(loc="lower right", ncol=2)
    fig.tight_layout(rect=(0, 0, 1, top))
    return _save(fig, out)


def scores_by_ward(ds: Dataset, out: Path) -> Path:
    return _grouped_bars(ds, "ward", "Workload and IPC compliance by ward", out)


def scores_by_shift(ds: Dataset, out: Path) -> Path:
    return _grouped_bars(ds, "shift", "Workload and IPC compliance by shift", out,
                         order=["Morning", "Afternoon", "Night"])


def scores_by_qualification(ds: Dataset, out: Path) -> Path:
    return _grouped_bars(ds, "qualification",
                         "Workload and IPC compliance by qualification", out,
                         order=["RN", "BNSc", "RN+BNSc", "MSc", "PhD"])


# ── 7. Subscale profiles ──────────────────────────────────────────────────

def subscale_profiles(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    wl_names = [f"WL: {s}" for s in subscales(ds.workload_items)]
    ip_names = [f"IPC: {s}" for s in subscales(ds.ipc_items)]

    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.2),
                             gridspec_kw={"width_ratios": [1, 1.25]})
    for ax, names, colour, label in (
        (axes[0], wl_names, config.SERIES_WORKLOAD, "Workload subscales"),
        (axes[1], ip_names, config.SERIES_IPC, "IPC compliance subscales"),
    ):
        available = [n for n in names if n in p.columns]
        if p.empty or not available:
            _empty(ax)
            ax.set_title(label, loc="left")
            continue
        means = p[available].mean().round(1).sort_values()
        sds = p[available].std(ddof=1).reindex(means.index)
        y = np.arange(len(means))
        ax.barh(y, means.to_numpy(), height=0.6, color=colour, zorder=2)
        ax.errorbar(means.to_numpy(), y, xerr=sds.to_numpy(), fmt="none",
                    ecolor=config.INK_MUTED, elinewidth=1, capsize=3, zorder=3)
        for i, v in enumerate(means.to_numpy()):
            ax.text(v + 1.5, i, f"{v:.0f}", va="center", fontsize=8,
                    color=config.INK_SECONDARY)
        ax.set_yticks(y)
        ax.set_yticklabels([n.split(": ", 1)[1] for n in means.index], fontsize=8)
        _style(ax, grid_axis="x")
        ax.set_xlim(0, 105)
        ax.set_xlabel("Mean subscale score (0–100)")
        _title(ax, label, "Bars show the mean; whiskers show ±1 SD")

    fig.suptitle("Where the workload sits, and where compliance breaks down",
                 x=0.005, ha="left", fontsize=12, fontweight="600",
                 color=config.INK_PRIMARY)
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    return _save(fig, out)


# ── 8. IPC score across workload bands ────────────────────────────────────

def ipc_by_workload_band(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    fig, ax = plt.subplots(figsize=(7.6, 4.8))
    if p.empty:
        _empty(ax)
        _title(ax, "IPC compliance across workload bands")
        return _save(fig, out)

    order = config.WORKLOAD_CATEGORIES
    groups, labels, colours = [], [], []
    for i, cat in enumerate(order):
        values = pd.to_numeric(
            p.loc[p["workloadCategory"] == cat, "ipcScore"], errors="coerce").dropna()
        if values.empty:
            continue
        groups.append(values.to_numpy())
        labels.append(f"{cat}\nn={len(values)}")
        colours.append(config.ORDINAL_4[i])

    if not groups:
        _empty(ax)
        return _save(fig, out)

    bp = ax.boxplot(groups, patch_artist=True, widths=0.55,
                    medianprops={"color": config.SURFACE, "linewidth": 1.8},
                    whiskerprops={"color": config.BASELINE, "linewidth": 1},
                    capprops={"color": config.BASELINE, "linewidth": 1},
                    flierprops={"marker": "o", "markersize": 4,
                                "markerfacecolor": config.INK_MUTED,
                                "markeredgecolor": config.SURFACE, "alpha": 0.7})
    for patch, colour in zip(bp["boxes"], colours):
        patch.set_facecolor(colour)
        patch.set_edgecolor(config.SURFACE)
        patch.set_linewidth(2)

    ax.set_xticklabels(labels)
    _style(ax)
    ax.set_ylim(0, 105)
    ax.set_ylabel("IPC compliance score (0–100)")
    ax.set_xlabel("Workload band")

    test = A.compare_groups(p, "ipcScore", "workloadCategory")
    subtitle = "Boxes span the interquartile range; the line is the median"
    if test:
        subtitle += (f"  ·  {test.test} = {test.statistic:.2f}, p {A.fmt_p(test.p)}, "
                     f"{test.effect_name} = {test.effect} ({test.interpret_effect()})")
    _title(ax, "IPC compliance across workload bands", subtitle)
    fig.tight_layout()
    return _save(fig, out)


# ── 9. Subscale correlation heatmap ───────────────────────────────────────

def subscale_heatmap(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    names = ([f"WL: {s}" for s in subscales(ds.workload_items)]
             + [f"IPC: {s}" for s in subscales(ds.ipc_items)])
    names = [n for n in names if n in p.columns]

    fig, ax = plt.subplots(figsize=(8.6, 7.2))
    if p.empty or len(p) < 4 or len(names) < 2:
        _empty(ax, "Not enough data for a correlation matrix")
        _title(ax, "Subscale correlations")
        return _save(fig, out)

    rho, pvals = A.correlation_matrix(p, names)
    data = rho.to_numpy(dtype=float)
    im = ax.imshow(data, cmap=DIVERGING, vmin=-1, vmax=1)

    short = [n.replace("WL: ", "").replace("IPC: ", "") for n in names]
    ax.set_xticks(range(len(names)))
    ax.set_yticks(range(len(names)))
    ax.set_xticklabels(short, rotation=35, ha="right", fontsize=7.5)
    ax.set_yticklabels(short, fontsize=7.5)
    # Keep the workload / IPC split visible.
    split = sum(1 for n in names if n.startswith("WL: "))
    if 0 < split < len(names):
        ax.axhline(split - 0.5, color=config.INK_PRIMARY, linewidth=1.4)
        ax.axvline(split - 0.5, color=config.INK_PRIMARY, linewidth=1.4)

    for i in range(len(names)):
        for j in range(len(names)):
            value = data[i, j]
            if np.isnan(value):
                continue
            star = "*" if (i != j and pvals.iat[i, j] < 0.05) else ""
            ax.text(j, i, f"{value:.2f}{star}", ha="center", va="center", fontsize=7,
                    color=config.SURFACE if abs(value) > 0.55 else config.INK_PRIMARY)

    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.tick_params(length=0)
    cbar = fig.colorbar(im, ax=ax, shrink=0.7, pad=0.02)
    cbar.set_label("Spearman ρ", color=config.INK_SECONDARY, fontsize=8)
    cbar.outline.set_visible(False)
    cbar.ax.tick_params(length=0, labelsize=7.5)

    top = _fig_title(fig, "Correlations between workload and compliance subscales",
                     "* marks p < .05; the rule separates workload from IPC subscales")
    fig.tight_layout(rect=(0, 0, 1, top))
    return _save(fig, out)


# ── 10. Weakest IPC practices ─────────────────────────────────────────────

def ipc_item_ranking(ds: Dataset, out: Path) -> Path:
    fig, ax = plt.subplots(figsize=(11, 7))
    if ds.items_long.empty:
        _empty(ax)
        _title(ax, "IPC compliance by item")
        return _save(fig, out)

    ipc = ds.items_long[ds.items_long["scale"] == "IPC"]
    means = ipc.groupby("item_id")["scored"].mean().sort_values()
    meta = {i.id: i for i in ds.ipc_items}
    # Percentage answering the top of the scale, after reverse correction.
    always = (ipc[ipc["scored"] == config.IPC_MAX].groupby("item_id").size()
              .reindex(means.index, fill_value=0) /
              ipc.groupby("item_id").size().reindex(means.index) * 100)

    y = np.arange(len(means))
    ax.barh(y, means.to_numpy(), height=0.66, color=config.SERIES_IPC, zorder=2)
    for i, (item_id, value) in enumerate(means.items()):
        ax.text(value + 0.03, i, f"{value:.2f}   ({always[item_id]:.0f}% always)",
                va="center", fontsize=7.5, color=config.INK_SECONDARY)

    labels = []
    for item_id in means.index:
        item = meta[item_id]
        flag = "  (reverse-keyed)" if item.reversed else ""
        labels.append(f"{item_id}. {short_label(item.text, 62)}{flag}")
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=7.5)
    _style(ax, grid_axis="x")
    ax.set_xlim(1, config.IPC_MAX + 0.55)
    ax.set_xticks(range(1, config.IPC_MAX + 1))
    ax.set_xlabel("Mean compliance score per item (1 = never, 4 = always)")
    ax.invert_yaxis()          # weakest practice first, reading top-down
    top = _fig_title(
        fig, "Which standard precautions are actually being followed",
        "Ranked weakest first. Reverse-keyed items are flagged; scores are already corrected")
    fig.tight_layout(rect=(0, 0, 1, top))
    return _save(fig, out)


# ── 11-12. Likert response distributions ──────────────────────────────────

def _likert_stack(ds: Dataset, scale: str, labels: dict[int, str],
                  ramp: list[str], scale_max: int, title: str, out: Path) -> Path:
    fig, ax = plt.subplots(figsize=(11, 6.4 if scale == "IPC" else 4.6))
    if ds.items_long.empty:
        _empty(ax)
        _title(ax, title)
        return _save(fig, out)

    subset = ds.items_long[ds.items_long["scale"] == scale]
    meta = {i.id: i for i in (ds.ipc_items if scale == "IPC" else ds.workload_items)}
    item_ids = sorted(meta)

    counts = (subset.groupby(["item_id", "scored"]).size().unstack(fill_value=0)
              .reindex(index=item_ids, fill_value=0)
              .reindex(columns=range(1, scale_max + 1), fill_value=0))
    totals = counts.sum(axis=1).replace(0, np.nan)
    pct = counts.div(totals, axis=0) * 100

    y = np.arange(len(item_ids))
    left = np.zeros(len(item_ids))
    for level in range(1, scale_max + 1):
        values = pct[level].to_numpy()
        ax.barh(y, values, left=left, height=0.68, color=ramp[level - 1],
                edgecolor=config.SURFACE, linewidth=2,
                label=f"{level} · {labels[level]}", zorder=2)
        # Only label a segment that can actually hold the text.
        for i, (value, start) in enumerate(zip(values, left)):
            if value >= 9:
                ax.text(start + value / 2, i, f"{value:.0f}", ha="center",
                        va="center", fontsize=7,
                        color=config.SURFACE if level >= 3 else config.INK_PRIMARY)
        left += np.nan_to_num(values)

    ax.set_yticks(y)
    ax.set_yticklabels(
        [f"{i}. {short_label(meta[i].text, 54)}{'  (rev)' if meta[i].reversed else ''}"
         for i in item_ids], fontsize=7.5)
    _style(ax, grid_axis="x")
    ax.set_xlim(0, 100)
    ax.set_xlabel("Share of nurses (%)")
    ax.invert_yaxis()
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.11),
              ncol=scale_max, fontsize=8)
    top = _fig_title(
        fig, title,
        "Scores shown after reverse correction, so higher always means better practice"
        if scale == "IPC" else "Higher always means a heavier reported demand")
    fig.tight_layout(rect=(0, 0, 1, top))
    return _save(fig, out)


def ipc_likert(ds: Dataset, out: Path) -> Path:
    return _likert_stack(ds, "IPC", config.IPC_LABELS, config.ORDINAL_4,
                         config.IPC_MAX, "Response profile for every CSPS item", out)


def workload_likert(ds: Dataset, out: Path) -> Path:
    return _likert_stack(ds, "Workload", config.WORKLOAD_LABELS, config.ORDINAL_5,
                         config.WORKLOAD_MAX,
                         "Response profile for every workload item", out)


# ── 13. Compliance mix per ward ───────────────────────────────────────────

def ward_compliance_mix(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    fig, ax = plt.subplots(figsize=(9.6, 5.4))
    if p.empty:
        _empty(ax)
        _title(ax, "IPC compliance mix by ward")
        return _save(fig, out)

    table = pd.crosstab(p["ward"], p["ipcCategory"])
    table = table.reindex(columns=config.IPC_CATEGORIES, fill_value=0)
    counts = table.sum(axis=1)
    pct = table.div(counts, axis=0) * 100
    pct = pct.loc[counts.sort_values().index]

    y = np.arange(len(pct))
    left = np.zeros(len(pct))
    for i, category in enumerate(config.IPC_CATEGORIES):
        values = pct[category].to_numpy()
        ax.barh(y, values, left=left, height=0.66, color=config.ORDINAL_4[i],
                edgecolor=config.SURFACE, linewidth=2, label=category, zorder=2)
        for j, (value, start) in enumerate(zip(values, left)):
            if value >= 11:
                ax.text(start + value / 2, j, f"{value:.0f}", ha="center",
                        va="center", fontsize=7,
                        color=config.SURFACE if i >= 2 else config.INK_PRIMARY)
        left += values

    ax.set_yticks(y)
    ax.set_yticklabels([f"{w}  (n={counts[w]})" for w in pct.index], fontsize=8)
    _style(ax, grid_axis="x")
    ax.set_xlim(0, 100)
    ax.set_xlabel("Share of nurses in the ward (%)")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.12), ncol=4)
    top = _fig_title(fig, "IPC compliance mix by ward",
                     "Wards ordered by number of assessments — read small-n wards with caution")
    fig.tight_layout(rect=(0, 0, 1, top))
    return _save(fig, out)


# ── 14. Patient load ──────────────────────────────────────────────────────

def patient_load_relationship(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    fig, axes = plt.subplots(1, 2, figsize=(10.4, 4.2))
    specs = [("workloadScore", "Workload score", config.SERIES_WORKLOAD),
             ("ipcScore", "IPC compliance score", config.SERIES_IPC)]

    for ax, (col, label, colour) in zip(axes, specs):
        if p.empty or len(p) < 4:
            _empty(ax)
            ax.set_title(label, loc="left")
            continue
        x = pd.to_numeric(p["patientLoad"], errors="coerce")
        y = pd.to_numeric(p[col], errors="coerce")
        ax.scatter(x, y, s=34, color=colour, alpha=0.7,
                   edgecolor=config.SURFACE, linewidth=1.2, zorder=3)
        corr = A.spearman(x, y)
        if corr:
            mask = x.notna() & y.notna()
            if mask.sum() > 2 and x[mask].nunique() > 1:
                slope, intercept = np.polyfit(x[mask], y[mask], 1)
                xs = np.linspace(x.min(), x.max(), 60)
                ax.plot(xs, slope * xs + intercept, color=config.INK_PRIMARY,
                        linewidth=1.8, zorder=4)
            ax.text(0.98, 0.03, f"ρ = {corr.rho:+.2f}, p {A.fmt_p(corr.p)}",
                    transform=ax.transAxes, ha="right", va="bottom", fontsize=8.5,
                    color=config.INK_PRIMARY)
        _style(ax, grid_axis="both")
        ax.set_ylim(0, 102)
        ax.set_xlabel("Patients assigned during the shift")
        ax.set_ylabel(label)
        _title(ax, label)

    fig.suptitle("Does the number of patients assigned track workload and compliance?",
                 x=0.005, ha="left", fontsize=12, fontweight="600",
                 color=config.INK_PRIMARY)
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    return _save(fig, out)


# ── 15. Demographic composition ───────────────────────────────────────────

def sample_composition(ds: Dataset, out: Path) -> Path:
    p = ds.participants
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    specs = [("shift", "Shift", ["Morning", "Afternoon", "Night"]),
             ("qualification", "Qualification", ["RN", "BNSc", "RN+BNSc", "MSc", "PhD"]),
             ("ward", "Ward", None)]

    for ax, (col, label, order) in zip(axes, specs):
        if p.empty:
            _empty(ax)
            ax.set_title(label, loc="left")
            continue
        counts = p[col].value_counts()
        counts = counts.reindex([o for o in order if o in counts.index]) if order \
            else counts.sort_values(ascending=True).tail(10)
        total = int(p.shape[0])
        y = np.arange(len(counts))
        ax.barh(y, counts.to_numpy(), height=0.62, color=config.SERIES[0], zorder=2)
        for i, value in enumerate(counts.to_numpy()):
            ax.text(value + total * 0.012, i, f"{value} ({value / total * 100:.0f}%)",
                    va="center", fontsize=7.5, color=config.INK_SECONDARY)
        ax.set_yticks(y)
        ax.set_yticklabels(counts.index, fontsize=8)
        _style(ax, grid_axis="x")
        ax.set_xlim(0, counts.max() * 1.32)
        ax.set_xlabel("Nurses")
        _title(ax, label)

    fig.suptitle(f"Sample composition  ·  n = {len(p)}", x=0.005, ha="left",
                 fontsize=12, fontweight="600", color=config.INK_PRIMARY)
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    return _save(fig, out)


# ── Orchestration ─────────────────────────────────────────────────────────

FIGURES = [
    ("01_sample_composition", sample_composition),
    ("02_score_distributions", score_distributions),
    ("03_category_pies", category_pies),
    ("04_workload_vs_ipc", workload_vs_ipc),
    ("05_ipc_by_workload_band", ipc_by_workload_band),
    ("06_scores_by_ward", scores_by_ward),
    ("07_scores_by_shift", scores_by_shift),
    ("08_scores_by_qualification", scores_by_qualification),
    ("09_subscale_profiles", subscale_profiles),
    ("10_subscale_heatmap", subscale_heatmap),
    ("11_ipc_item_ranking", ipc_item_ranking),
    ("12_ipc_likert", ipc_likert),
    ("13_workload_likert", workload_likert),
    ("14_ward_compliance_mix", ward_compliance_mix),
    ("15_patient_load", patient_load_relationship),
]


def render_all(ds: Dataset, figure_dir: Path) -> list[Path]:
    figure_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, fn in FIGURES:
        path = fn(ds, figure_dir / f"{name}.png")
        written.append(path)
        print(f"  figure  {path.name}")
    return written


def render_pdf(ds: Dataset, path: Path) -> Path:
    """One combined PDF holding every figure, for appendices."""
    from matplotlib.backends.backend_pdf import PdfPages

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / "_tmp_figure.png"
    with PdfPages(path) as pdf:
        for _, fn in FIGURES:
            fn(ds, tmp)
            image = plt.imread(tmp)
            h, w = image.shape[:2]
            fig = plt.figure(figsize=(11.7, 11.7 * h / w))
            ax = fig.add_axes((0, 0, 1, 1))
            ax.imshow(image)
            ax.axis("off")
            pdf.savefig(fig, facecolor=config.SURFACE)
            plt.close(fig)
    tmp.unlink(missing_ok=True)
    return path
