import type { AssessmentRecord } from '../types';

function rankArray(arr: number[]): number[] {
  const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length).fill(0);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return NaN;
  const n = x.length;
  const rx = rankArray(x);
  const ry = rankArray(y);
  const sumDsq = rx.reduce((sum, r, i) => sum + (r - ry[i]) ** 2, 0);
  return 1 - (6 * sumDsq) / (n * (n * n - 1));
}

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Approximate p-value for Spearman r via t-distribution (two-tailed)
export function spearmanPValue(r: number, n: number): number {
  if (isNaN(r) || n < 3) return NaN;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Use normal approximation for large n, rough t-approx for small n
  const absT = Math.abs(t);
  const df = n - 2;
  // Using Wilson-Hilferty approximation for t-distribution p-value
  const x = df / (df + absT * absT);
  const p = incompleteBeta(df / 2, 0.5, x);
  return Math.min(1, p);
}

function incompleteBeta(a: number, b: number, x: number): number {
  // Simple continued fraction approximation (Numerical Recipes)
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 1;
  if (x === 1) return 0;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const bt = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betaCF(a, b, x) / a;
  return 1 - bt * betaCF(b, a, 1 - x) / b;
}

function betaCF(a: number, b: number, x: number): number {
  const MAXIT = 100;
  const EPS = 3e-7;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) { y++; ser += ci / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const dir = r < 0 ? 'negative' : 'positive';
  if (abs < 0.1) return 'negligible';
  if (abs < 0.3) return `weak ${dir}`;
  if (abs < 0.5) return `moderate ${dir}`;
  if (abs < 0.7) return `strong ${dir}`;
  return `very strong ${dir}`;
}

export function getDescriptiveStats(records: AssessmentRecord[]) {
  const workload = records.map(r => r.workloadScore);
  const ipc = records.map(r => r.ipcScore);
  return {
    n: records.length,
    workload: {
      mean: mean(workload),
      sd: stdDev(workload),
      median: median(workload),
      min: Math.min(...workload),
      max: Math.max(...workload),
    },
    ipc: {
      mean: mean(ipc),
      sd: stdDev(ipc),
      median: median(ipc),
      min: Math.min(...ipc),
      max: Math.max(...ipc),
    },
  };
}
