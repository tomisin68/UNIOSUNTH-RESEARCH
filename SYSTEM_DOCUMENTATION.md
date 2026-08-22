``UNIOSUNTH Nursing Research Tool
## System Documentation

**Study Title:** Development and Use of a Simple Digital Tool for Assessing the Relationship Between Nursing Workload and Infection Prevention Compliance Among Nurses in Medical Wards of UNIOSUNTH

**Version:** 1.0 | **Date:** 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Assessment Instruments](#2-assessment-instruments)
3. [Scoring Methods](#3-scoring-methods)
4. [Statistical Analysis](#4-statistical-analysis)
5. [Data Flow & Architecture](#5-data-flow--architecture)
6. [Multi-Device & Cloud Sync](#6-multi-device--cloud-sync)
7. [Security & Access Control](#7-security--access-control)
8. [PWA & Offline Capability](#8-pwa--offline-capability)
9. [File Structure](#9-file-structure)
10. [Limitations & Recommendations](#10-limitations--recommendations)

---

## 1. System Overview

The UNIOSUNTH Nursing Research Tool is a **Progressive Web Application (PWA)** built for data collection and analysis in a cross-sectional nursing research study. It enables:

- **Nurses** to complete two validated self-report scales on their own mobile devices
- **The research coordinator** to aggregate, analyse, and export all submitted data from a central device

The tool operates **entirely offline** — assessments can be completed without internet access, and data syncs to the cloud database automatically when connectivity is restored.

### Design Principles

| Principle | Implementation |
|---|---|
| Anonymous data collection | Auto-generated nurse codes (no names stored) |
| Offline-first | All data stored locally; synced when online |
| Validated instruments | CSPS (Lam, 2004) + adapted NAS/NASA-TLX |
| Coordinator-only aggregation | PIN-protected cloud sync |
| Portable | Installable PWA — works on any smartphone or laptop |

---

## 2. Assessment Instruments

### 2.1 Nursing Workload Scale (12 items)

**Basis:** Adapted from the Nursing Activities Score (Miranda et al., 2003) and the NASA Task Load Index (Hart & Staveland, 1988), contextualised for general medical wards in low- and middle-income country (LMIC) settings.

**Response format:** 5-point Likert scale
| Value | Label |
|---|---|
| 1 | Not at all |
| 2 | Slightly |
| 3 | Moderately |
| 4 | Very much |
| 5 | Extremely |

**Subscales and items:**

#### Subscale A — Physical & Task Demands (Items 1–4)
| # | Item |
|---|---|
| 1 | Physical demands (lifting, moving, repositioning patients) were burdensome |
| 2 | Number of patients exceeded what I could comfortably manage |
| 3 | Had to perform complex or multiple procedures simultaneously or in rapid succession |
| 4 | Experienced time pressure — insufficient time to complete all required tasks |

#### Subscale B — Cognitive & Emotional Demands (Items 5–8)
| # | Item |
|---|---|
| 5 | Mental concentration required to monitor patients and make clinical decisions was high |
| 6 | Experienced emotional stress related to patient conditions or family interactions |
| 7 | Frequently interrupted or distracted while performing nursing tasks |
| 8 | Unexpected emergencies or deteriorating patients increased workload significantly |

#### Subscale C — Administrative & Resource Burden (Items 9–12)
| # | Item |
|---|---|
| 9 | Documentation, records, and administrative tasks consumed a considerable portion of shift |
| 10 | Inadequate supplies, equipment, or resources made nursing care harder |
| 11 | Coordination with other health team members added to workload |
| 12 | Overall workload was excessive relative to available nursing staff |

**No reverse-scored items** in the workload scale. All items are positively keyed (higher = more burden).

---

### 2.2 IPC Compliance Scale — CSPS Adapted (20 items)

**Basis:** Compliance with Standard Precautions Scale (CSPS), originally developed by Dr. Simon Ching Lam (2004). The adapted version used here aligns with validations conducted in Nigerian and African hospital settings (Lam, 2014; Nigerian COVID-19 compliance studies, 2021–2023).

**Response format:** 4-point Likert scale
| Value | Label |
|---|---|
| 1 | Never |
| 2 | Rarely |
| 3 | Sometimes |
| 4 | Always |

**Reverse-scored items:** Items 3, 8, 10, and 11 describe non-compliant behaviours (e.g., recapping needles). For these items, scoring is inverted: **Never = 4, Always = 1**.

**Subscales and items:**

#### Subscale 1 — Personal Protective Equipment (Items 1–7)
| # | Item | Reversed? |
|---|---|---|
| 1 | Wear gloves when at risk of contact with blood/body fluids | No |
| 2 | Change gloves and perform hand hygiene between patients | No |
| 3 | Reuse single-use gloves after cleaning/disinfecting | **Yes** |
| 4 | Wear gown/apron when at risk of splashing onto clothing | No |
| 5 | Wear surgical mask during splash-risk procedures | No |
| 6 | Wear eye protection during splash-risk procedures | No |
| 7 | Remove PPE appropriately and perform hand hygiene after | No |

#### Subscale 2 — Sharps Safety (Items 8–12)
| # | Item | Reversed? |
|---|---|---|
| 8 | Recap used needles with two-handed technique | **Yes** |
| 9 | Dispose of used sharps into puncture-resistant container immediately | No |
| 10 | Bend or break used needles before disposing | **Yes** |
| 11 | Pass used sharps directly from hand to hand | **Yes** |
| 12 | Report needlestick/sharps injuries promptly | No |

#### Subscale 3 — Decontamination & Waste Management (Items 13–16)
| # | Item | Reversed? |
|---|---|---|
| 13 | Clean blood/body fluid spills promptly with appropriate disinfectant | No |
| 14 | Ensure reusable equipment is decontaminated before use on another patient | No |
| 15 | Handle soiled linen without shaking; place in designated bag | No |
| 16 | Segregate and dispose of clinical waste in appropriate containers | No |

#### Subscale 4 — Hand Hygiene & Cross-Infection Prevention (Items 17–20)
| # | Item | Reversed? |
|---|---|---|
| 17 | Perform hand hygiene before direct patient contact | No |
| 18 | Perform hand hygiene after direct patient contact | No |
| 19 | Apply standard precautions for ALL patients regardless of diagnosis | No |
| 20 | Maintain aseptic technique during invasive procedures | No |

---

## 3. Scoring Methods

### 3.1 Workload Score

**Raw score range:** 12 (minimum, all items rated 1) to 60 (maximum, all items rated 5)

**Normalisation formula:**

```
Workload Score (%) = ((raw_total - 12) / (60 - 12)) × 100
                   = ((raw_total - 12) / 48) × 100
```

**Subscale scores** are computed the same way per subscale (each has 4 items, so min=4, max=20):

```
Subscale Score (%) = ((subscale_raw - 4) / (20 - 4)) × 100
                   = ((subscale_raw - 4) / 16) × 100
```

**Workload categories:**

| Score Range | Category | Clinical Implication |
|---|---|---|
| 0–24% | Low | Manageable workload; IPC practices can be fully maintained |
| 25–49% | Moderate | Moderate demand; occasional time pressure but IPC generally maintained |
| 50–74% | High | High demand; risk that IPC shortcuts may be taken |
| 75–100% | Very High | Critical overload; significant risk of IPC non-compliance |

---

### 3.2 IPC Compliance Score (CSPS)

**Scoring of reverse items:** Items 3, 8, 10, 11 are inverted before summing:
```
Adjusted score = 5 - raw_score
```
(e.g., raw score of 4 "Always" for recapping needles becomes 1)

**Raw score range:** 20 (minimum) to 80 (maximum)

**Normalisation formula:**

```
IPC Score (%) = ((raw_total - 20) / (80 - 20)) × 100
              = ((raw_total - 20) / 60) × 100
```

**Subscale scores:**

Each subscale has a different number of items (7, 5, 4, 4). The formula generalises as:

```
Subscale Score (%) = ((subscale_raw - n) / (n × 3)) × 100
```
where `n` = number of items in the subscale (min score = n × 1, max score = n × 4).

**IPC compliance categories:**

| Score Range | Category | Interpretation |
|---|---|---|
| 0–49% | Poor | Significant gaps in IPC practice; immediate training required |
| 50–69% | Suboptimal | Inconsistent practice; targeted intervention needed |
| 70–89% | Satisfactory | Generally good compliance with minor gaps |
| 90–100% | Optimal | Consistently excellent compliance with all standard precautions |

*Thresholds adapted from: Lam (2014); WHO IPC assessment frameworks.*

---

## 4. Statistical Analysis

### 4.1 Descriptive Statistics

For both scores, each of the 7 subscales, every individual item, and the
demographic variables (years of experience, patients per shift), the tool computes:

| Statistic | Formula / definition |
|---|---|
| **n** | Number of valid observations |
| **Mean** | Σxᵢ / n |
| **Standard Deviation** | √[ Σ(xᵢ − x̄)² / (n−1) ] — sample SD |
| **Standard error (SEM)** | SD / √n |
| **95% confidence interval** | x̄ ± 1.96 × SEM |
| **Median** | 50th percentile (linear interpolation, R type 7) |
| **Q1 / Q3 / IQR** | 25th and 75th percentiles, and their difference |
| **Minimum / Maximum / Range** | Lowest, highest, and the spread between them |
| **Mode** | Most frequent value |
| **Skewness** | Adjusted Fisher–Pearson G1 — the same figure SPSS reports |
| **Kurtosis** | Sample excess kurtosis G2 (0 = mesokurtic) |
| **Coefficient of variation** | SD / mean, as a percentage |

Frequency tables (count and percent) are produced for ward, service area, shift,
qualification, banded experience, banded patient load, and both outcome bands.

**Internal consistency.** Cronbach's alpha is computed for each instrument and each
subscale from the item responses of this sample, after reverse keying. It is
reported only once at least 10 records exist, below which alpha is unstable and can
turn negative.

**Distribution shape.** The D'Agostino–Pearson K² omnibus test (requires n ≥ 20)
combines standardised skewness and kurtosis. It is what justifies reporting
Spearman's ρ rather than Pearson's r as the primary test.

---

### 4.2 Spearman's Rank Correlation Coefficient (ρ)

**Why Spearman and not Pearson?**

Spearman's ρ is used because:
1. The outcome variables (workload and IPC scores) are derived from Likert-scale responses, which are ordinal in nature
2. The distribution of scores may not be normally distributed (especially in small samples)
3. Spearman is robust to outliers — important in a hospital setting where extreme workload cases may occur
4. Consistent with the statistical approach used in comparable Nigerian nursing workload-IPC studies (e.g., Oyedele et al., 2023)

**Computation:**

Step 1 — Rank both variables independently (ties receive averaged ranks):
```
R(xᵢ) = rank of workload score for participant i
R(yᵢ) = rank of IPC score for participant i
```

Step 2 — Compute sum of squared rank differences:
```
Σdᵢ² = Σ [R(xᵢ) - R(yᵢ)]²
```

Step 3 — Apply Spearman's formula:
```
ρ = 1 - (6 × Σdᵢ²) / (n × (n² - 1))
```

**Range:** −1.0 (perfect negative) to +1.0 (perfect positive). ρ = 0 means no monotonic relationship.

**Expected hypothesis for this study:**
- H₀: There is no significant relationship between nursing workload and IPC compliance (ρ = 0)
- H₁: There is a significant negative relationship (ρ < 0) — higher workload → lower compliance

---

### 4.3 Statistical Significance (p-value)

The p-value is computed using the **t-distribution approximation**:

```
t = ρ × √((n − 2) / (1 − ρ²))
```

with degrees of freedom = n − 2. The two-tailed p-value is derived from the incomplete beta function using the Wilson-Hilferty approximation (Numerical Recipes, Press et al.).

**Significance threshold:** α = 0.05 (two-tailed)

**Interpretation table (Cohen, 1988):**

| |ρ| range | Interpretation |
|---|---|
| < 0.10 | Negligible |
| 0.10 – 0.29 | Weak |
| 0.30 – 0.49 | Moderate |
| 0.50 – 0.69 | Strong |
| ≥ 0.70 | Very strong |

**Minimum sample size:** A minimum of 3 records is required to display the correlation. For reliable inference in a research publication, a sample of **≥ 30 participants** is recommended (Bonett & Wright, 2000).

---

### 4.4 Visual Outputs

| Chart | Type | Purpose |
|---|---|---|
| Records by ward | Horizontal bar | How many nurses each clinical area contributed |
| Workload bands | Pie | Share of nurses in Low / Moderate / High / Very High |
| IPC bands | Pie | Share of nurses in Poor / Suboptimal / Satisfactory / Optimal |
| Subscale means | Bar chart | Mean score for each subscale of an instrument |
| Scatter plot | XY scatter with fitted line | Individual workload vs IPC pairs; dot colour = workload band |
| Conclusion charts | 2 pies + 1 bar | One figure per conclusion (see 4.5) |
| Records table | Table | Raw scores and bands for each participant |

---

### 4.5 Inferential Tests and Hypotheses

| Test | Applied to |
|---|---|
| **Spearman's ρ** | Workload vs IPC compliance (primary), plus workload vs patient load and both scores vs experience |
| **Pearson's r** | Workload vs IPC, reported alongside ρ for comparison |
| **Linear regression** | IPC regressed on workload — slope, intercept, R² |
| **Chi-square test of independence** | Workload band × IPC band, with Cramér's V and a low-expected-count warning |
| **Kruskal–Wallis H** | Each score across wards, service areas, shifts, and qualifications (tie-corrected) |

Four hypotheses are stated and decided at α = 0.05:

| | Null hypothesis (H₀) | Test |
|---|---|---|
| **H1** | There is no statistically significant relationship between nursing workload and IPC compliance among nurses in UNIOSUNTH | Spearman's ρ |
| **H2** | There is no statistically significant association between the workload category of a nurse and their IPC compliance category | Chi-square |
| **H3** | There is no statistically significant difference in nursing workload across the clinical areas of UNIOSUNTH | Kruskal–Wallis H |
| **H4** | There is no statistically significant difference in IPC compliance across the clinical areas of UNIOSUNTH | Kruskal–Wallis H |

Each is shown with its statistic, degrees of freedom, n, p-value, and an explicit
**REJECT H₀** / **RETAIN H₀** decision. Below 10 records the decision reads
**NOT TESTABLE** rather than reporting an unstable p-value.

---

### 4.6 Conclusions

The analysis closes with three categorical conclusions, each carrying its own figure:

| # | Answers | Figure |
|---|---|---|
| **1** | Objective 1 — the level of nursing workload in UNIOSUNTH | Pie of workload bands |
| **2** | Objective 2 — the level of IPC compliance in UNIOSUNTH | Pie of compliance bands |
| **3** | The hypothesis — whether workload relates to compliance | Bar of mean IPC within each workload band |

---

### 4.7 Downloading the Analysis

The **Download Analysis** button on the Analysis tab produces four artefacts, all
generated from the same computation that renders the page, so a figure on screen
and the same figure in the thesis cannot drift apart:

| Output | Contents |
|---|---|
| **Analysis report (print / PDF)** | The full written report, opened ready to save as PDF |
| **Analysis report (HTML file)** | The same report as a file that also opens in Word |
| **Statistics (CSV)** | Every table on the page as a spreadsheet, for SPSS or Excel |
| **Raw data (CSV)** | One row per participant with every item response, plus a codebook |

The charts embedded in the report are the live charts, serialised out of the page
as SVG at the moment of download.

---

## 5. Data Flow & Architecture

### 5.1 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Component-based UI with type safety |
| Build tool | Vite 5 | Fast development server and optimised production build |
| Styling | Tailwind CSS 3 | Utility-first responsive design |
| Routing | React Router v6 | Client-side navigation between pages |
| Charts | Recharts 2 | Responsive SVG-based data visualisations |
| Cloud database | Cloud Firestore (Firebase) | Remote data storage and sync |
| Service worker | Workbox (via vite-plugin-pwa) | Offline caching and PWA functionality |
| Offline writes | Firestore IndexedDB cache | Holds submissions made with no connection until they sync |
| Cryptography | Web Crypto API | PBKDF2 PIN hashing; random code generation |

### 5.2 Application Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Overview, instrument summary, quick stats |
| `/assess` | Demographics | Auto-generated nurse code, ward, shift, qualification, patient load |
| `/assess/workload` | Workload Scale | 12 Likert items grouped by subscale |
| `/assess/ipc` | IPC Scale | 20 Likert items grouped by subscale |
| `/assess/results` | Results | Scores, categories, interpretation, save/submit actions |
| `/data` | Data Manager | Live view of every submitted record; exclusion controls (coordinator only) |
| `/analysis` | Analysis | Full descriptive statistics, hypothesis tests, conclusions, downloads |

### 5.3 Clinical Areas

The intake form offers exactly the wards of UNIOSUN Teaching Hospital, grouped by
service area. Free text is not accepted, so ward is a clean categorical variable
for the group comparisons. Because per-ward cell counts get small quickly, the
service area is what the ward-level hypotheses (H3, H4) are tested on.

| Service area | Wards / units |
|---|---|
| Medical | Male Medical Ward, Female Medical Ward, Renal Unit |
| Surgical | Male Surgical Ward, Female Surgical Ward, Orthopaedic Ward, Burns Unit |
| Paediatric & Neonatal | Paediatric Medical Ward 1, Paediatric Medical Ward 2, Paediatric Surgical Ward, Special Care Baby Unit (SCBU) |
| Critical & Peri-operative | Intensive Care Unit (ICU), Theatre |
| Obstetrics & Gynaecology | Labour Ward, Post-Natal Ward, Gynaecology Ward |
| Emergency | Accident & Emergency (A&E), Children Emergency Unit (CEU) |

Defined once in `src/data/wards.ts`; `analysis/make_sample_data.py` mirrors the list.

### 5.4 Assessment Data Model

```typescript
AssessmentRecord {
  id: string                        // Internal UUID (timestamp + random)
  timestamp: string                 // Human-readable date/time
  demographics: {
    nurseCode: string               // Auto-generated e.g. "NRS-A7X2K9"
    ward: string
    shift: 'Morning' | 'Afternoon' | 'Night'
    qualification: 'RN' | 'BNSc' | 'RN+BNSc' | 'MSc' | 'PhD'
    yearsExperience: string
    patientLoad: string
  }
  workloadResponses: { [itemId]: 1|2|3|4|5 }   // Raw responses
  ipcResponses:      { [itemId]: 1|2|3|4 }      // Raw responses
  workloadScore: number             // 0–100 normalised
  ipcScore: number                  // 0–100 normalised
  workloadCategory: string          // Low | Moderate | High | Very High
  ipcCategory: string               // Poor | Suboptimal | Satisfactory | Optimal
  subscoreWorkload: { [subscale]: number }       // 0–100 per subscale
  subscoreIPC:      { [subscale]: number }       // 0–100 per subscale
}
```

### 5.5 Firestore Database Schema

Collection `assessment_records`, one document per completed assessment.
**The document id is the record id**, which makes retried uploads idempotent —
a re-submit overwrites its own document rather than creating a duplicate.

```
collection: assessment_records
document id: <record id>
─────────────────────────────────────────────────────
id                 string      == document id
submittedAt        timestamp   server clock (serverTimestamp())
excluded           boolean     true = flagged out of the analysis by the coordinator
nurseCode          string
ward               string
shift              string      Morning | Afternoon | Night
qualification      string      RN | BNSc | RN+BNSc | MSc | PhD
yearsExperience    string
patientLoad        string
assessmentDate     string
timestamp          string      local time the assessment was completed
workloadScore      number      0–100
ipcScore           number      0–100
workloadCategory   string      Low | Moderate | High | Very High
ipcCategory        string      Poor | Suboptimal | Satisfactory | Optimal
subscoreWorkload   map         subscale → 0–100
subscoreIPC        map         subscale → 0–100
workloadResponses  map         item id → 1–5
ipcResponses       map         item id → 1–4
```

No composite indexes are required — `orderBy('submittedAt')` is served by the
automatic single-field index.

**Security rules (`firestore.rules`):** the study runs without user sign-in, so
the rules validate the *shape* of each write rather than the identity of the
writer.

| Operation | Allowed | Condition |
|---|---|---|
| `read` | yes | Coordinator sync/export runs in the browser with no login |
| `create` | valid records only | Exact field set, enumerated categories, scores 0–100, bounded map sizes, `submittedAt == request.time` |
| `update` | idempotent re-submit only | `id` and `nurseCode` must be unchanged |
| `delete` | never | Records are append-only |
| any other path | never | Catch-all denies everything else |

Deploy them with `firebase deploy --only firestore:rules`. Full instructions
are in `FIREBASE_SETUP.md`.

---

## 6. Multi-Device & Cloud Sync

### 6.1 Nurse Workflow

```
1. Nurse installs PWA on their phone (or opens in browser)
2. Opens app → "Start New Assessment"
3. Auto-generated code (e.g. NRS-A7X2K9) assigned
4. Completes workload scale (≈3 min) + IPC scale (≈4 min)
5. Views individual results
6. Taps "Submit to Study Database"
   ├── If online  → uploads immediately → "Saved to the study database"
   └── If offline → held by the Firestore client → uploads by itself when online
```

The responses exist only in memory until step 6. Closing the tab part-way through
discards the sitting; nothing about a participant is written to the device.

### 6.2 Coordinator Workflow

```
1. Opens app on any device
2. Goes to Data tab
3. Taps "Coordinator access" → enters PIN
4. Every submitted record is already listed — the tab is a live view of the
   database, so there is no sync step
5. Opens Analysis tab → descriptive statistics, hypothesis tests, conclusions
6. "Download Analysis" → written report (PDF/HTML), statistics CSV, or raw data CSV
   OR prints an individual PDF report per nurse
```

### 6.3 Working Offline

The study database is the only place a record is kept. There is no app-managed
queue: a submission made with no connection is written to the Firestore client's
own IndexedDB cache, which survives a reload and replays the write as soon as the
device reconnects. The Results screen reports this as "Recorded — waiting for a
connection", and the Data tab shows whether it is reading live or from cache.

### 6.4 CSV Export Columns

| Column | Description |
|---|---|
| ID | Internal record identifier |
| Date | Assessment date/time |
| Nurse Code | Auto-generated anonymous code |
| Ward | Selected ward |
| Shift | Morning / Afternoon / Night |
| Qualification | Highest nursing qualification |
| Years Experience | Years in nursing |
| Patient Load | Number of patients that shift |
| Workload Score (%) | Normalised 0–100 |
| Workload Category | Low / Moderate / High / Very High |
| IPC Score (%) | Normalised 0–100 |
| IPC Category | Poor / Suboptimal / Satisfactory / Optimal |
| Workload subscores (3 columns) | Per subscale % |
| IPC subscores (4 columns) | Per subscale % |

---

## 7. Security & Access Control

### 7.1 Coordinator PIN

The coordinator PIN gates the exclusion controls and signals coordinator access. It is stored in the study database as a **salted PBKDF2-SHA256 digest** (250,000 iterations) at `config/coordinator` — the plain PIN is never saved anywhere, and because it lives in the database it is the same PIN on every device used for the study.

**Process:**
1. First use: coordinator sets a 4–8 digit PIN
2. A 16-byte random salt is generated; `PBKDF2(pin, salt, 250000)` → written to `config/coordinator`
3. The rules allow that document to be created once and never updated or deleted from a client
4. Each unlock attempt derives the digest again and compares it
5. On match: a session storage flag is set — unlocked for the current browser tab only
6. Closing the tab automatically re-locks (session storage is cleared)

**Reset:** Delete the `config/coordinator` document in the Firebase Console; the next unlock attempt offers first-time setup again.

### 7.2 Data Privacy

- No personally identifiable information (PII) is collected — only anonymous nurse codes
- Nurse codes are randomly generated (`crypto.getRandomValues`) and not linked to any identity
- Raw item responses are stored in Cloud Firestore for audit and re-analysis purposes
- Firestore security rules make the collection append-only — DELETE is never permitted from the client, and UPDATE is restricted to an idempotent re-submit of the same record
- Because the study uses no sign-in, read access is open at the rules level. Records are pseudonymised (nurse codes, no names). App Check (reCAPTCHA v3) can be enabled to restrict access to this app without adding a login — see `FIREBASE_SETUP.md`

### 7.3 Nurse Code Generation

Codes follow the format `NRS-XXXXXX` where each `X` is drawn from a 32-character unambiguous alphabet:

```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Characters `0`, `O`, `1`, `I` are excluded to prevent transcription errors. Using `crypto.getRandomValues` (cryptographically secure random), the probability of two identical codes being generated is:

```
P(collision) = 1 / 32^6 ≈ 1 in 1,073,741,824
```

This makes accidental duplication effectively impossible across a study sample.

---

## 8. PWA & Offline Capability

### 8.1 What is a PWA?

A Progressive Web App (PWA) is a website that can be installed on a device and behaves like a native app — it works offline, appears on the home screen, and runs in full-screen without a browser address bar.

### 8.2 Installation

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the "Install" banner at the bottom, OR tap ⋮ → "Add to Home Screen"

**iOS (Safari):**
1. Open the app URL in Safari
2. Tap the Share button (□↑) → "Add to Home Screen"

**Desktop (Chrome/Edge):**
1. Click the install icon (⊕) in the address bar

### 8.3 Offline Strategy

The service worker (generated by Workbox) pre-caches all application assets on first install:

| Asset type | Strategy |
|---|---|
| HTML, JS, CSS | Cache-first (served from cache, updated in background) |
| Navigation fallback | Serves `index.html` for all routes — SPA routing works offline |
| Google Fonts | Cache-first with 1-year TTL (if used) |

**Data persistence offline:** Submitted records are durable — the Firestore client keeps an unsynced write in IndexedDB across reloads and uploads it on reconnect. An assessment that has not yet been submitted is held in memory only and is lost if the tab is closed, which is the deliberate trade for keeping no participant data on a shared ward device.

### 8.4 Updates

When a new version of the app is deployed:
1. The service worker detects the update in the background
2. An "Update Available" toast appears
3. Tapping "Update now" refreshes to the new version

---

## 9. File Structure

```
UNIOSUNTH-RESEARCH/
├── index.html                    # PWA entry point (meta tags, theme-color)
├── vite.config.ts                # Build config + PWA plugin + chunk splitting
├── tailwind.config.js            # Design system colours
├── .env                          # Firebase web config (not committed to git)
├── .env.example                  # Template for deployment
├── firebase.json                 # Firebase CLI config (Firestore + Hosting)
├── firestore.rules               # Firestore security rules (deploy with the CLI)
├── firestore.indexes.json        # Index definitions (none needed today)
├── FIREBASE_SETUP.md             # Step-by-step Firebase setup guide
│
├── public/
│   ├── favicon.svg               # App icon (heartbeat line on blue)
│   └── apple-touch-icon.svg      # iOS home screen icon
│
└── src/
    ├── main.tsx                  # App entry; registers auto-sync listener
    ├── App.tsx                   # Router + PWA prompts
    ├── index.css                 # Tailwind base + custom utilities
    │
    ├── types/
    │   └── index.ts              # AssessmentRecord, Demographics, etc.
    │
    ├── data/
    │   ├── workloadItems.ts      # 12 workload scale items + labels + subscales
    │   └── ipcItems.ts           # 20 CSPS items + labels + subscales + reversed flags
    │
    ├── lib/
    │   └── firebase.ts           # Firebase app + Firestore (null if env vars not set)
    │
    ├── utils/
    │   ├── scoring.ts            # calcWorkloadScore, calcIPCScore, categories
    │   ├── statistics.ts         # spearmanCorrelation, p-value, descriptives
    │   ├── ids.ts               # generateId + generateNurseCode
    │   ├── records.ts           # Firestore submit, live subscription, exclusion
    │   ├── analysisModel.ts     # Every statistic the study reports, computed once
    │   ├── report.ts            # Downloadable report, statistics CSV, data CSV
    │   ├── coordinator.ts        # PIN hash/verify, session lock/unlock
    │   └── export.ts             # CSV export, printable HTML report
    │
    ├── components/
    │   ├── Layout.tsx            # Header, mobile bottom nav, coordinator banner
    │   ├── ProgressBar.tsx       # Step indicator (dots desktop, label mobile)
    │   ├── LikertItem.tsx        # Single scale question with response buttons
    │   ├── ScoreCard.tsx         # Score display with category + subscore bars
    │   ├── CoordinatorModal.tsx  # PIN entry / setup bottom sheet
    │   ├── PWAInstallPrompt.tsx  # "Add to Home Screen" install banner
    │   └── PWAUpdatePrompt.tsx   # "New version available" toast
    │
    └── pages/
        ├── Home.tsx              # Landing page
        ├── Demographics.tsx      # Step 1: auto code + ward/shift/qualification
        ├── WorkloadAssessment.tsx # Step 2: 12 Likert items
        ├── IPCAssessment.tsx     # Step 3: 20 Likert items
        ├── Results.tsx           # Step 4: scores + submit button
        ├── DataManager.tsx       # Records table/cards + coordinator sync
        └── Analysis.tsx          # Stats + charts + records table
```

---

## 10. Limitations & Recommendations

### 10.1 Instrument Limitations

| Limitation | Note |
|---|---|
| Self-report bias | Nurses self-report their IPC compliance — social desirability bias may inflate scores. Consider pairing with direct observational audits |
| Single-shift snapshot | The workload scale covers the most recent completed shift, not an average — scores may vary across shifts |
| Cross-sectional design | Cannot infer causation — only association between workload and compliance |
| Workload scale adaptation | The workload scale is adapted, not independently validated in a Nigerian medical ward context. Cronbach's alpha should be computed on the collected sample and reported |
| Sample size | Spearman's ρ is reliable from n ≥ 30. For power to detect a moderate effect (ρ = 0.30) at α = 0.05, two-tailed, 80% power, the required n ≈ 84 participants |

### 10.2 Technical Limitations

| Limitation | Note |
|---|---|
| Unsubmitted sittings | An assessment is held in memory until it is submitted, so closing the tab part-way through loses it. This is deliberate: no participant data rests on a shared ward device |
| No data backup | If a nurse clears their browser data before submitting, their record is lost |
| PIN security | The coordinator PIN gates the UI only — it does not protect the database. Its digest is publicly readable, so a short numeric PIN is brute-forceable offline despite the PBKDF2 work factor. For real protection, add a coordinator login via Firebase Auth and tighten `allow read` |
| Offline sync conflicts | If the same record ID is somehow submitted from two devices, the merged `setDoc` write will overwrite the earlier version |

### 10.3 Recommended Reporting Template

When reporting results from this tool in a thesis or publication:

> *"Nursing workload was assessed using a 12-item scale adapted from the Nursing Activities Score (Miranda et al., 2003) and the NASA Task Load Index (Hart & Staveland, 1988) for general medical ward contexts. Infection prevention compliance was measured using the 20-item Compliance with Standard Precautions Scale (CSPS; Lam, 2004), previously validated in Nigerian hospital settings. Both scales were administered digitally via a purpose-built Progressive Web Application. Scores were normalised to 0–100% and categorised using established thresholds. The relationship between nursing workload and IPC compliance was examined using Spearman's rank correlation coefficient (ρ), with statistical significance set at α = 0.05 (two-tailed). Data were analysed using built-in statistical functions within the tool, and exported to SPSS v.XX for verification."*

---

### References

- Cohen, J. (1988). *Statistical Power Analysis for the Behavioral Sciences* (2nd ed.). Lawrence Erlbaum.
- Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX: Results of empirical and theoretical research. *Human Mental Workload*, 1, 139–183.
- Lam, S. C. (2004). *Compliance with Standard Precautions: Development of an Instrument.* (Doctoral dissertation). Hong Kong Polytechnic University.
- Lam, S. C. (2014). Validation and cross-cultural pilot testing of compliance with standard precautions scale. *Applied Nursing Research*, 27(3), 169–175.
- Miranda, D. R., Nap, R., de Rijk, A., Schaufeli, W., & Iapichino, G. (2003). Nursing activities score. *Critical Care Medicine*, 31(2), 374–382.
- Press, W. H., Teukolsky, S. A., Vetterling, W. T., & Flannery, B. P. (2007). *Numerical Recipes: The Art of Scientific Computing* (3rd ed.). Cambridge University Press.
- WHO (2009). *WHO Guidelines on Hand Hygiene in Health Care.* World Health Organization.

---

*Document generated by the UNIOSUNTH Nursing Research Tool development environment.*
*Tool built with React 18, TypeScript, Vite, Tailwind CSS, Recharts, and Firebase (Cloud Firestore).*
