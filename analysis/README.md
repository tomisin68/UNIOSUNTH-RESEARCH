# Analysis layer — UNIOSUNTH nursing workload & IPC compliance

A Python layer that reads the live study database and produces the statistics,
figures, and written report for the thesis.

It reads Firestore directly. No credentials, no export step, no copy-paste: the
study runs without authentication and the security rules allow anonymous reads,
so `requests` and the project id are enough.

---

## Setup

```bash
cd analysis
python -m pip install -r requirements.txt
```

## Run it

```bash
python run_analysis.py              # live data from Firestore
python run_analysis.py --cached     # reuse the last download (offline)
python run_analysis.py --pdf        # also bundle every figure into one PDF
python run_analysis.py --sample     # synthetic data, to see it work before collection starts
```

Everything lands in `output/`:

```
output/
├── report.md              written findings, with every table and figure inline
├── all_figures.pdf        every figure in one file (with --pdf)
├── figures/*.png          15 figures at 300 dpi, sized for a thesis page
├── tables/*.csv           every statistic as a spreadsheet (opens in Excel/SPSS)
└── records_cache.json     raw download, so --cached works offline
```

## Trying it before you have data

The database starts empty. To see the whole pipeline work end to end:

```bash
python make_sample_data.py --n 120
python run_analysis.py --sample --pdf
```

`make_sample_data.py` writes a **local JSON file only** — it never writes to
Firestore, so the real study database cannot be contaminated with fabricated
records. Every report generated this way is stamped as synthetic. Delete
`output/sample_records.json` when you are done.

---

## What it computes

**Descriptive** — n, mean, SD, median, IQR, range, and skew for both scores, all
seven subscales, years of experience, and patient load; frequency tables for
ward, shift, qualification, and both outcome bands.

**Reliability** — Cronbach's α with a Feldt 95% confidence interval for the
12-item workload scale, the 20-item CSPS, and each subscale separately, plus
corrected item-total correlations and alpha-if-item-deleted. This is the
evidence a thesis needs that the instruments held up in this sample.

**The primary hypothesis** — Spearman's ρ between workload and IPC compliance,
with a Bonett-Wright confidence interval and a plain-language interpretation.

**Group comparisons** — Kruskal-Wallis across wards, shifts, qualifications and
workload bands (Mann-Whitney U where there are only two groups), each with an
effect size (ε² or rank-biserial r) and its magnitude, because in a single-site
sample the size of a difference matters more than its p-value.

**Subscale structure** — a full Spearman correlation matrix across all workload
and IPC subscales, with significance marking.

**Item level** — mean compliance and "% always" for all 20 CSPS items, ranked
weakest first, plus the full Likert response profile per item. This is what
turns the study into something the infection-control team can act on.

**Data integrity** — every stored score is recomputed from the raw item
responses and compared. A disagreement between the app's arithmetic and this
layer's is reported rather than quietly absorbed.

## The figures

| # | Figure | Form |
|---|---|---|
| 01 | Sample composition by shift, qualification, ward | bar |
| 02 | Score distributions | histogram |
| 03 | Workload and compliance bands | **pie** |
| 04 | Workload vs IPC compliance — the key figure | scatter + trend |
| 05 | IPC compliance across workload bands | box |
| 06–08 | Scores by ward / shift / qualification | grouped bar |
| 09 | Subscale profiles with ±1 SD | bar + error |
| 10 | Subscale correlation matrix | heatmap |
| 11 | Standard precautions ranked weakest first | bar |
| 12–13 | Likert response profile per item | stacked bar |
| 14 | Compliance mix per ward | stacked bar |
| 15 | Patient load vs both scores | scatter |

### On the colours

They are not free-hand. The palette was checked with a colour-vision validator
against the light surface these figures render on. The obvious green-amber-red
risk ramp **fails**: red against green measures ΔE 4.1 under deuteranopia, so a
colourblind reader cannot separate "Poor" from "Optimal". Ordered categories
therefore use a single-hue light-to-dark ramp and always carry their names as
text, so meaning never rests on colour alone. Workload is blue and IPC is orange
in every figure, so the mapping only has to be learned once.

## Files

| File | Role |
|---|---|
| `run_analysis.py` | CLI entry point |
| `firestore_client.py` | REST fetch, pagination, typed-value decoding, cache |
| `instruments.py` | parses item text/subscales/reverse flags from the app's own `.ts` files |
| `dataset.py` | records → tidy frames; recomputes and verifies scores |
| `analytics.py` | descriptives, reliability, correlation, group tests |
| `charts.py` | all 15 figures |
| `report.py` | CSV tables and the written report |
| `config.py` | paths, Firestore target, validated palette |
| `make_sample_data.py` | synthetic data for testing (local file only) |

`instruments.py` deliberately parses `src/data/workloadItems.ts` and
`src/data/ipcItems.ts` rather than keeping its own copy. If an item is reworded
or re-keyed in the app, the analysis follows automatically instead of silently
reporting the old wording.

## Troubleshooting

**"Could not reach Firestore"** — check the network, or run `--cached` to work
from the last download.

**A 403** — the rules allow anonymous reads, so this almost certainly means App
Check enforcement was switched on. Set `GOOGLE_APPLICATION_CREDENTIALS` to a
service-account key file and the client will authenticate automatically.

**"Parsed zero items"** — `instruments.py` could not read the `.ts` item files.
Run from inside the repo so `../src/data/` resolves.
