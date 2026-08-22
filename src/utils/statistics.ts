// ── Statistical routines ──────────────────────────────────────────────────
// Everything the study reports is computed here, in the browser, from the
// records in the database. No numbers are produced anywhere else: the on-screen
// analysis and the downloadable report both read the same values.
//
// Distribution functions follow the standard series / continued-fraction
// approximations (Press et al., Numerical Recipes) and agree with SPSS and R to
// well within the precision a thesis reports.

// ── Ranking ───────────────────────────────────────────────────────────────

export interface RankResult {
  ranks: number[];
  /** Sizes of each group of tied values, for tie corrections. */
  tieGroups: number[];
}

export function rankWithTies(values: number[]): RankResult {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length).fill(0);
  const tieGroups: number[] = [];

  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].v === indexed[i].v) j++;
    const size = j - i + 1;
    const averageRank = (i + j + 2) / 2; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = averageRank;
    if (size > 1) tieGroups.push(size);
    i = j + 1;
  }
  return { ranks, tieGroups };
}

// ── Central tendency and dispersion ───────────────────────────────────────

export function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function variance(values: number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function median(values: number[]): number {
  return quantile(values, 0.5);
}

/** Linear-interpolation quantile (R type 7 / Excel PERCENTILE.INC). */
export function quantile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (pos - lower) * (sorted[upper] - sorted[lower]);
}

export function mode(values: number[]): { value: number; count: number } | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: number; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count || (count === best.count && value < best.value)) {
      best = { value, count };
    }
  }
  return best;
}

/** Adjusted Fisher-Pearson sample skewness (the G1 that SPSS reports). */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return NaN;
  const m = mean(values);
  const s = stdDev(values);
  if (!s) return NaN;
  const sum = values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** Sample excess kurtosis (SPSS G2); 0 is mesokurtic. */
export function kurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return NaN;
  const m = mean(values);
  const s = stdDev(values);
  if (!s) return NaN;
  const sum = values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

export interface Descriptives {
  n: number;
  mean: number;
  sd: number;
  sem: number;
  ci95Lower: number;
  ci95Upper: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
  /** Coefficient of variation, as a percentage of the mean. */
  cv: number;
  mode: number | null;
}

export function describe(values: number[]): Descriptives {
  const n = values.length;
  const m = mean(values);
  const sd = stdDev(values);
  const sem = n > 1 ? sd / Math.sqrt(n) : NaN;
  // Normal-approximation interval; n is comfortably large in a ward census.
  const halfWidth = 1.96 * sem;
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const modeResult = mode(values);

  return {
    n,
    mean: m,
    sd,
    sem,
    ci95Lower: m - halfWidth,
    ci95Upper: m + halfWidth,
    median: median(values),
    q1,
    q3,
    iqr: q3 - q1,
    min: n ? Math.min(...values) : NaN,
    max: n ? Math.max(...values) : NaN,
    range: n ? Math.max(...values) - Math.min(...values) : NaN,
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    cv: m ? (sd / m) * 100 : NaN,
    mode: modeResult ? modeResult.value : null,
  };
}

// ── Frequency tables ──────────────────────────────────────────────────────

export interface FrequencyRow {
  label: string;
  count: number;
  percent: number;
}

/**
 * Counts of each label with percentages. `order` fixes the row order for
 * ordinal variables (compliance bands, shifts) so tables read consistently;
 * anything not in `order` follows, sorted by frequency.
 */
export function frequencyTable(labels: string[], order?: string[]): FrequencyRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const total = labels.length || 1;

  const ordered: FrequencyRow[] = [];
  if (order) {
    for (const label of order) {
      const count = counts.get(label) ?? 0;
      counts.delete(label);
      ordered.push({ label, count, percent: (count / total) * 100 });
    }
  }
  const rest = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count, percent: (count / total) * 100 }));

  return [...ordered, ...rest];
}

/** Groups a numeric variable into labelled bands for the demographic tables. */
export function bandValues(
  values: number[],
  bands: { label: string; max: number }[],
): string[] {
  return values.map(v => bands.find(b => v <= b.max)?.label ?? bands[bands.length - 1].label);
}

// ── Distribution functions ────────────────────────────────────────────────

function logGamma(x: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let series = 1.000000000190015;
  for (const c of coefficients) { y++; series += c / y; }
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAX_ITERATIONS = 200;
  const EPSILON = 3e-12;
  const TINY = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a,b). */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for Student's t with `df` degrees of freedom. */
export function tDistTwoTailed(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return t === Infinity || t === -Infinity ? 0 : NaN;
  const x = df / (df + t * t);
  return Math.min(1, incompleteBeta(df / 2, 0.5, x));
}

/** Regularised lower incomplete gamma P(a,x) by series expansion. */
function gammaSeries(a: number, x: number): number {
  const MAX_ITERATIONS = 500;
  const EPSILON = 1e-12;
  let ap = a;
  let sum = 1 / a;
  let delta = sum;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    ap++;
    delta *= x / ap;
    sum += delta;
    if (Math.abs(delta) < Math.abs(sum) * EPSILON) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularised upper incomplete gamma Q(a,x) by continued fraction. */
function gammaContinuedFraction(a: number, x: number): number {
  const MAX_ITERATIONS = 500;
  const EPSILON = 1e-12;
  const TINY = 1e-300;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Upper-tail probability of the chi-square distribution. */
export function chiSquarePValue(chiSquare: number, df: number): number {
  if (!Number.isFinite(chiSquare) || chiSquare < 0 || df <= 0) return NaN;
  if (chiSquare === 0) return 1;
  const a = df / 2;
  const x = chiSquare / 2;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

/** Two-tailed p-value for a standard normal deviate. */
export function normalTwoTailed(z: number): number {
  if (!Number.isFinite(z)) return NaN;
  return chiSquarePValue(z * z, 1);
}

// ── Correlation ───────────────────────────────────────────────────────────

export interface CorrelationResult {
  coefficient: number;
  p: number;
  n: number;
  df: number;
  t: number;
}

export function pearson(x: number[], y: number[]): CorrelationResult {
  const n = x.length;
  const empty = { coefficient: NaN, p: NaN, n, df: NaN, t: NaN };
  if (n !== y.length || n < 3) return empty;

  const mx = mean(x);
  const my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (!sxx || !syy) return empty;

  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  const t = Math.abs(r) === 1 ? Infinity * Math.sign(r) : r * Math.sqrt(df / (1 - r * r));
  return { coefficient: r, p: tDistTwoTailed(t, df), n, df, t };
}

export function spearman(x: number[], y: number[]): CorrelationResult {
  const n = x.length;
  if (n !== y.length || n < 3) return { coefficient: NaN, p: NaN, n, df: NaN, t: NaN };

  // Ranked Pearson — correct in the presence of ties, unlike the 6*sum(d^2)
  // shortcut. Bounded integer scores tie constantly, so this matters.
  const rx = rankWithTies(x).ranks;
  const ry = rankWithTies(y).ranks;
  return pearson(rx, ry);
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  const n = x.length;
  if (n < 3 || n !== y.length) return { slope: NaN, intercept: NaN, r2: NaN, n };
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  if (!sxx) return { slope: NaN, intercept: NaN, r2: NaN, n };
  const slope = sxy / sxx;
  const r = pearson(x, y).coefficient;
  return { slope, intercept: my - slope * mx, r2: r * r, n };
}

// ── Group comparison ──────────────────────────────────────────────────────

export interface GroupSummary {
  label: string;
  n: number;
  meanRank: number;
  mean: number;
  sd: number;
  median: number;
}

export interface KruskalWallisResult {
  h: number;
  df: number;
  p: number;
  n: number;
  groups: GroupSummary[];
  /** Groups dropped for having fewer than two observations. */
  droppedGroups: string[];
}

/**
 * Kruskal-Wallis H — the non-parametric one-way test used here to compare
 * scores across wards, shifts and qualifications. Groups with fewer than two
 * observations are dropped: they carry no within-group information.
 */
export function kruskalWallis(
  groups: { label: string; values: number[] }[],
): KruskalWallisResult {
  const usable = groups.filter(g => g.values.length >= 2);
  const droppedGroups = groups.filter(g => g.values.length < 2 && g.values.length > 0)
    .map(g => g.label);

  if (usable.length < 2) {
    return { h: NaN, df: NaN, p: NaN, n: 0, groups: [], droppedGroups };
  }

  const pooled: number[] = [];
  for (const g of usable) pooled.push(...g.values);
  const N = pooled.length;
  const { ranks, tieGroups } = rankWithTies(pooled);

  let offset = 0;
  let rankSumTerm = 0;
  const summaries: GroupSummary[] = usable.map(g => {
    const groupRanks = ranks.slice(offset, offset + g.values.length);
    offset += g.values.length;
    const rankSum = groupRanks.reduce((a, b) => a + b, 0);
    rankSumTerm += (rankSum * rankSum) / g.values.length;
    return {
      label: g.label,
      n: g.values.length,
      meanRank: rankSum / g.values.length,
      mean: mean(g.values),
      sd: stdDev(g.values),
      median: median(g.values),
    };
  });

  let h = (12 / (N * (N + 1))) * rankSumTerm - 3 * (N + 1);

  // Tie correction — essential here, since scores are bounded integers.
  const tieSum = tieGroups.reduce((acc, t) => acc + (t ** 3 - t), 0);
  const correction = 1 - tieSum / (N ** 3 - N);
  if (correction > 0) h /= correction;

  const df = usable.length - 1;
  return { h, df, p: chiSquarePValue(h, df), n: N, groups: summaries, droppedGroups };
}

// ── Cross-tabulation ──────────────────────────────────────────────────────

export interface ChiSquareResult {
  chiSquare: number;
  df: number;
  p: number;
  n: number;
  rowLabels: string[];
  colLabels: string[];
  observed: number[][];
  expected: number[][];
  cramersV: number;
  /** True when more than 20% of cells have an expected count below 5. */
  expectedCountWarning: boolean;
}

export function chiSquareIndependence(
  rows: string[],
  cols: string[],
  rowOrder: string[],
  colOrder: string[],
): ChiSquareResult {
  const rowLabels = rowOrder.filter(l => rows.includes(l));
  const colLabels = colOrder.filter(l => cols.includes(l));

  const rowIndex = new Map(rowLabels.map((l, i) => [l, i] as const));
  const colIndex = new Map(colLabels.map((l, i) => [l, i] as const));
  const observed = rowLabels.map(() => colLabels.map(() => 0));
  for (let i = 0; i < rows.length; i++) {
    const r = rowIndex.get(rows[i]);
    const c = colIndex.get(cols[i]);
    if (r !== undefined && c !== undefined) observed[r][c]++;
  }

  const n = rows.length;
  const rowTotals = observed.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = colLabels.map((_, j) => observed.reduce((acc, r) => acc + r[j], 0));
  const expected = rowTotals.map(rt => colTotals.map(ct => (n ? (rt * ct) / n : 0)));

  let chiSquare = 0;
  let lowCells = 0;
  for (let i = 0; i < rowLabels.length; i++) {
    for (let j = 0; j < colLabels.length; j++) {
      const e = expected[i][j];
      if (e < 5) lowCells++;
      if (e > 0) chiSquare += (observed[i][j] - e) ** 2 / e;
    }
  }

  const df = (rowLabels.length - 1) * (colLabels.length - 1);
  const cellCount = rowLabels.length * colLabels.length || 1;
  const minDim = Math.min(rowLabels.length - 1, colLabels.length - 1);

  return {
    chiSquare,
    df,
    p: df > 0 ? chiSquarePValue(chiSquare, df) : NaN,
    n,
    rowLabels,
    colLabels,
    observed,
    expected,
    cramersV: minDim > 0 && n ? Math.sqrt(chiSquare / (n * minDim)) : NaN,
    expectedCountWarning: lowCells / cellCount > 0.2,
  };
}

// ── Reliability ───────────────────────────────────────────────────────────

/**
 * Cronbach's alpha over a respondents x items matrix of *scored* responses
 * (reverse-keyed items must already be inverted). Reported so the thesis can
 * state the internal consistency of each instrument in this sample, rather than
 * relying only on the figures published with the original scales.
 */
export function cronbachAlpha(matrix: number[][]): number {
  const respondents = matrix.length;
  if (respondents < 2) return NaN;
  const items = matrix[0]?.length ?? 0;
  if (items < 2) return NaN;

  let itemVarianceSum = 0;
  for (let j = 0; j < items; j++) {
    itemVarianceSum += variance(matrix.map(row => row[j]));
  }
  const totals = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const totalVariance = variance(totals);
  if (!totalVariance) return NaN;

  return (items / (items - 1)) * (1 - itemVarianceSum / totalVariance);
}

export function interpretAlpha(alpha: number): string {
  if (!Number.isFinite(alpha)) return 'not estimable';
  if (alpha >= 0.9) return 'excellent';
  if (alpha >= 0.8) return 'good';
  if (alpha >= 0.7) return 'acceptable';
  if (alpha >= 0.6) return 'questionable';
  if (alpha >= 0.5) return 'poor';
  return 'unacceptable';
}

// ── Normality ─────────────────────────────────────────────────────────────

export interface NormalityResult {
  k2: number;
  p: number;
  n: number;
  normal: boolean;
  /** False when n is too small for the omnibus test to be meaningful. */
  applicable: boolean;
}

/** k-th central moment about the mean, divided by n (the biased estimator). */
function centralMoment(values: number[], k: number): number {
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) ** k, 0) / values.length;
}

/**
 * D'Agostino-Pearson K-squared omnibus test, combining standardised skewness
 * and kurtosis. This is what justifies reporting Spearman's rho rather than
 * Pearson's r as the study's primary test of association.
 *
 * The test statistics are defined on the raw sample moments (b1 and b2), not
 * on the bias-corrected G1 and G2 that `skewness` and `kurtosis` report for the
 * descriptive tables, so the moments are recomputed here.
 */
export function dagostinoPearson(values: number[]): NormalityResult {
  const n = values.length;
  if (n < 20) return { k2: NaN, p: NaN, n, normal: false, applicable: false };

  const m2 = centralMoment(values, 2);
  if (!m2) return { k2: NaN, p: NaN, n, normal: false, applicable: false };
  const g1 = centralMoment(values, 3) / m2 ** 1.5;
  const g2 = centralMoment(values, 4) / (m2 * m2) - 3;
  if (!Number.isFinite(g1) || !Number.isFinite(g2)) {
    return { k2: NaN, p: NaN, n, normal: false, applicable: false };
  }

  // Standardised skewness (D'Agostino, 1970)
  const y = g1 * Math.sqrt(((n + 1) * (n + 3)) / (6 * (n - 2)));
  const beta2 = (3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3))
    / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const w2 = -1 + Math.sqrt(2 * (beta2 - 1));
  const w = Math.sqrt(w2);
  const delta = 1 / Math.sqrt(Math.log(w));
  const alpha = Math.sqrt(2 / (w2 - 1));
  const z1 = delta * Math.log(y / alpha + Math.sqrt((y / alpha) ** 2 + 1));

  // Standardised kurtosis (Anscombe & Glynn, 1983)
  const b2 = g2 + 3;
  const meanB2 = (3 * (n - 1)) / (n + 1);
  const varB2 = (24 * n * (n - 2) * (n - 3)) / ((n + 1) ** 2 * (n + 3) * (n + 5));
  const x = (b2 - meanB2) / Math.sqrt(varB2);
  const beta1 = ((6 * (n * n - 5 * n + 2)) / ((n + 7) * (n + 9)))
    * Math.sqrt((6 * (n + 3) * (n + 5)) / (n * (n - 2) * (n - 3)));
  const a = 6 + (8 / beta1) * (2 / beta1 + Math.sqrt(1 + 4 / (beta1 * beta1)));
  const term = Math.cbrt((1 - 2 / a) / (1 + x * Math.sqrt(2 / (a - 4))));
  const z2 = ((1 - 2 / (9 * a)) - term) / Math.sqrt(2 / (9 * a));

  if (!Number.isFinite(z1) || !Number.isFinite(z2)) {
    return { k2: NaN, p: NaN, n, normal: false, applicable: false };
  }

  const k2 = z1 * z1 + z2 * z2;
  const p = chiSquarePValue(k2, 2);
  return { k2, p, n, normal: p >= 0.05, applicable: true };
}

// ── Reporting helpers ─────────────────────────────────────────────────────

export function interpretCorrelation(r: number): string {
  if (!Number.isFinite(r)) return 'not estimable';
  const magnitude = Math.abs(r);
  const direction = r < 0 ? 'negative' : 'positive';
  if (magnitude < 0.1) return 'negligible';
  if (magnitude < 0.3) return `weak ${direction}`;
  if (magnitude < 0.5) return `moderate ${direction}`;
  if (magnitude < 0.7) return `strong ${direction}`;
  return `very strong ${direction}`;
}

/** APA-style p-value: never "p = .000". */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< .001';
  return `= ${p.toFixed(3).replace(/^0/, '')}`;
}

export function formatNumber(value: number, dp = 2): string {
  return Number.isFinite(value) ? value.toFixed(dp) : '—';
}
