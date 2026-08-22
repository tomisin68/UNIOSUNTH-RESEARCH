"""Shared configuration: paths, Firestore target, and the validated chart palette."""
from __future__ import annotations

from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────
ANALYSIS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ANALYSIS_DIR.parent
SRC_DATA_DIR = PROJECT_ROOT / "src" / "data"

OUTPUT_DIR = ANALYSIS_DIR / "output"
FIGURE_DIR = OUTPUT_DIR / "figures"
TABLE_DIR = OUTPUT_DIR / "tables"
CACHE_PATH = OUTPUT_DIR / "records_cache.json"

# ── Firestore ─────────────────────────────────────────────────────────────
# The security rules allow anonymous reads, so no credentials are needed.
FIREBASE_PROJECT_ID = "uniosunth-research"
FIRESTORE_COLLECTION = "assessment_records"

# ── Instrument scale bounds ───────────────────────────────────────────────
WORKLOAD_MIN, WORKLOAD_MAX = 1, 5          # 5-point Likert
IPC_MIN, IPC_MAX = 1, 4                    # 4-point Likert

WORKLOAD_CATEGORIES = ["Low", "Moderate", "High", "Very High"]
IPC_CATEGORIES = ["Poor", "Suboptimal", "Satisfactory", "Optimal"]

WORKLOAD_LABELS = {1: "Not at all", 2: "Slightly", 3: "Moderately",
                   4: "Very much", 5: "Extremely"}
IPC_LABELS = {1: "Never", 2: "Rarely", 3: "Sometimes", 4: "Always"}

# ── Palette ───────────────────────────────────────────────────────────────
# Every set below was checked with the data-viz validator against the light
# surface #fcfcfb. Do not substitute colours without re-running it — the
# obvious green/amber/red risk ramp FAILS (red vs green sits at deuteranopia
# ΔE 4.1), which is why ordered categories use a single-hue ordinal ramp and
# carry their names as direct labels rather than relying on colour.

SURFACE = "#fcfcfb"
INK_PRIMARY = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRIDLINE = "#e1e0d9"
BASELINE = "#c3c2b7"

# Categorical slots, fixed order — never cycled, never reassigned by rank.
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
SERIES_WORKLOAD = SERIES[0]   # blue   — workload, everywhere it appears
SERIES_IPC = SERIES[1]        # orange — IPC compliance, everywhere

# Ordinal ramps for ordered levels (validated with --ordinal).
ORDINAL_4 = ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"]
ORDINAL_5 = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"]

# Diverging pair for correlation heatmaps: warm/cool poles, neutral midpoint.
DIVERGING_LOW = "#1c5cab"
DIVERGING_MID = "#f0efec"
DIVERGING_HIGH = "#d03b3b"

FIGURE_DPI = 300
