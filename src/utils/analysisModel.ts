import type { AssessmentRecord, ScaleItem } from '../types';
import { WORKLOAD_ITEMS, WORKLOAD_SUBSCALES } from '../data/workloadItems';
import { IPC_ITEMS, IPC_SUBSCALES } from '../data/ipcItems';
import { WARD_NAMES, WARD_GROUPS, wardGroup } from '../data/wards';
import {
  describe, frequencyTable, bandValues, spearman, pearson, linearRegression,
  kruskalWallis, chiSquareIndependence, cronbachAlpha, interpretAlpha,
  dagostinoPearson, interpretCorrelation, mean, stdDev,
  type Descriptives, type FrequencyRow, type CorrelationResult,
  type KruskalWallisResult, type ChiSquareResult, type NormalityResult,
  type RegressionResult,
} from './statistics';

// ── The study, computed once ──────────────────────────────────────────────
// buildAnalysis() turns the record set into every number the study reports.
// The Analysis screen renders this object and the downloadable report writes
// the same object out, so a figure on screen and the same figure in the thesis
// can never drift apart.

export const ALPHA = 0.05;

/** Never let a non-finite value reach prose: an em dash reads, "NaN" does not. */
const fmt = (value: number, dp = 1): string =>
  (Number.isFinite(value) ? value.toFixed(dp) : '—');

export const WORKLOAD_BANDS = ['Low', 'Moderate', 'High', 'Very High'] as const;
export const IPC_BANDS = ['Poor', 'Suboptimal', 'Satisfactory', 'Optimal'] as const;
export const SHIFTS = ['Morning', 'Afternoon', 'Night'] as const;
export const QUALIFICATIONS = ['RN', 'BNSc', 'RN+BNSc', 'MSc', 'PhD'] as const;

const EXPERIENCE_BANDS = [
  { label: '5 years or less', max: 5 },
  { label: '6 - 10 years', max: 10 },
  { label: '11 - 15 years', max: 15 },
  { label: '16 - 20 years', max: 20 },
  { label: 'Over 20 years', max: Infinity },
];

const PATIENT_LOAD_BANDS = [
  { label: '5 patients or fewer', max: 5 },
  { label: '6 - 10 patients', max: 10 },
  { label: '11 - 15 patients', max: 15 },
  { label: '16 - 20 patients', max: 20 },
  { label: 'Over 20 patients', max: Infinity },
];

/** Records needed before inferential statistics and reliability are reported. */
const MINIMUM_N = 10;

// ── Result shapes ─────────────────────────────────────────────────────────

export interface ItemStatistic {
  id: number;
  text: string;
  subscale: string;
  reversed: boolean;
  /** Mean of the *scored* response, after any reverse keying. */
  mean: number;
  sd: number;
  n: number;
}

export interface SubscaleStatistic {
  name: string;
  descriptives: Descriptives;
  /** Mean scored response per item, on the instrument's own 1-5 or 1-4 scale. */
  itemMean: number;
  alpha: number;
  itemCount: number;
}

export interface ScaleAnalysis {
  key: 'workload' | 'ipc';
  label: string;
  /** Descriptives of the normalised 0-100 score. */
  descriptives: Descriptives;
  /** Descriptives of the raw summed score, for readers who want the total. */
  rawDescriptives: Descriptives;
  rawMin: number;
  rawMax: number;
  itemMean: number;
  responseRange: string;
  normality: NormalityResult;
  bands: FrequencyRow[];
  modalBand: string;
  modalBandPercent: number;
  subscales: SubscaleStatistic[];
  items: ItemStatistic[];
  alpha: number;
  alphaVerdict: string;
  byWard: KruskalWallisResult;
  byWardGroup: KruskalWallisResult;
  byShift: KruskalWallisResult;
  byQualification: KruskalWallisResult;
}

export type Decision = 'Reject' | 'Retain' | 'Not testable';

export interface HypothesisResult {
  id: string;
  nullHypothesis: string;
  alternativeHypothesis: string;
  test: string;
  statisticLabel: string;
  statistic: number;
  df: number | null;
  p: number;
  n: number;
  decision: Decision;
  conclusion: string;
}

export interface ConclusionChartDatum {
  label: string;
  value: number;
  detail?: string;
}

export interface Conclusion {
  number: number;
  question: string;
  headline: string;
  narrative: string;
  chartType: 'pie' | 'bar';
  chartLabel: string;
  data: ConclusionChartDatum[];
  /** Colour key so the screen and the report shade the same categories alike. */
  palette: string[];
}

export interface AnalysisModel {
  generatedAt: string;
  n: number;
  totalSubmitted: number;
  excludedCount: number;
  sufficient: boolean;
  /** Minimum n at which the inferential tests are reported. */
  minimumN: number;
  sample: {
    ward: FrequencyRow[];
    wardGroup: FrequencyRow[];
    shift: FrequencyRow[];
    qualification: FrequencyRow[];
    experienceBand: FrequencyRow[];
    patientLoadBand: FrequencyRow[];
    experience: Descriptives;
    patientLoad: Descriptives;
  };
  workload: ScaleAnalysis;
  ipc: ScaleAnalysis;
  association: {
    spearman: CorrelationResult;
    pearson: CorrelationResult;
    regression: RegressionResult;
    interpretation: string;
    workloadVsPatientLoad: CorrelationResult;
    workloadVsExperience: CorrelationResult;
    ipcVsExperience: CorrelationResult;
  };
  crossTab: ChiSquareResult;
  ipcByWorkloadBand: { label: string; n: number; mean: number; sd: number }[];
  scatter: { workload: number; ipc: number; code: string; band: string; ward: string }[];
  hypotheses: HypothesisResult[];
  conclusions: Conclusion[];
}

// ── Scoring helpers ───────────────────────────────────────────────────────

/** Applies reverse keying so every item points the same way before analysis. */
function scoredValue(item: ScaleItem, raw: number, scaleMax: number): number {
  return item.reversed ? scaleMax + 1 - raw : raw;
}

function responsesOf(record: AssessmentRecord, key: 'workload' | 'ipc') {
  return key === 'workload' ? record.workloadResponses : record.ipcResponses;
}

/** Respondents x items matrix of scored responses; incomplete rows are dropped. */
function scoredMatrix(
  records: AssessmentRecord[],
  items: ScaleItem[],
  key: 'workload' | 'ipc',
  scaleMax: number,
): number[][] {
  const matrix: number[][] = [];
  for (const record of records) {
    const responses = responsesOf(record, key);
    const row: number[] = [];
    let complete = true;
    for (const item of items) {
      const raw = responses?.[item.id];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) { complete = false; break; }
      row.push(scoredValue(item, raw, scaleMax));
    }
    if (complete) matrix.push(row);
  }
  return matrix;
}

function numeric(values: (string | number | undefined)[]): number[] {
  return values
    .map(v => (typeof v === 'number' ? v : parseFloat(String(v ?? ''))))
    .filter(v => Number.isFinite(v));
}

function groupBy(
  records: AssessmentRecord[],
  score: (r: AssessmentRecord) => number,
  key: (r: AssessmentRecord) => string,
  order: readonly string[],
) {
  return order.map(label => ({
    label,
    values: records.filter(r => key(r) === label).map(score),
  })).filter(g => g.values.length > 0);
}

// ── Per-scale analysis ────────────────────────────────────────────────────

function analyseScale(
  records: AssessmentRecord[],
  config: {
    key: 'workload' | 'ipc';
    label: string;
    items: ScaleItem[];
    subscaleNames: string[];
    scaleMax: number;
    responseRange: string;
    bands: readonly string[];
    score: (r: AssessmentRecord) => number;
    band: (r: AssessmentRecord) => string;
    subscore: (r: AssessmentRecord) => Record<string, number>;
  },
): ScaleAnalysis {
  const { key, items, scaleMax, subscaleNames } = config;
  const scores = records.map(config.score);
  const matrix = scoredMatrix(records, items, key, scaleMax);

  // Raw summed totals, reconstructed from the item responses.
  const rawTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));

  const itemStats: ItemStatistic[] = items.map((item, index) => {
    const column = matrix.map(row => row[index]);
    return {
      id: item.id,
      text: item.text,
      subscale: item.subscale,
      reversed: item.reversed,
      mean: mean(column),
      sd: stdDev(column),
      n: column.length,
    };
  });

  const subscales: SubscaleStatistic[] = subscaleNames.map(name => {
    const values = records
      .map(r => config.subscore(r)?.[name])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const columnIndexes = items
      .map((item, index) => (item.subscale === name ? index : -1))
      .filter(index => index >= 0);
    const subMatrix = matrix.map(row => columnIndexes.map(index => row[index]));
    const subItemMeans = columnIndexes.map(index => mean(matrix.map(row => row[index])));

    return {
      name,
      descriptives: describe(values),
      itemMean: mean(subItemMeans.filter(Number.isFinite)),
      alpha: records.length >= MINIMUM_N ? cronbachAlpha(subMatrix) : NaN,
      itemCount: columnIndexes.length,
    };
  });

  const bandLabels = records.map(config.band);
  const bandRows = frequencyTable(bandLabels, [...config.bands]);
  const modal = [...bandRows].sort((a, b) => b.count - a.count)[0]
    ?? { label: '—', count: 0, percent: 0 };

  // Alpha on a handful of respondents swings wildly and can go negative, which
  // would be reported as fact. Below the inference threshold it is not shown.
  const alpha = records.length >= MINIMUM_N ? cronbachAlpha(matrix) : NaN;

  return {
    key,
    label: config.label,
    descriptives: describe(scores),
    rawDescriptives: describe(rawTotals),
    rawMin: items.length,
    rawMax: items.length * scaleMax,
    itemMean: mean(itemStats.map(i => i.mean).filter(Number.isFinite)),
    responseRange: config.responseRange,
    normality: dagostinoPearson(scores),
    bands: bandRows,
    modalBand: modal.label,
    modalBandPercent: modal.percent,
    subscales,
    items: itemStats,
    alpha,
    alphaVerdict: interpretAlpha(alpha),
    byWard: kruskalWallis(groupBy(records, config.score, r => r.demographics.ward, WARD_NAMES)),
    byWardGroup: kruskalWallis(
      groupBy(records, config.score, r => wardGroup(r.demographics.ward), WARD_GROUPS),
    ),
    byShift: kruskalWallis(groupBy(records, config.score, r => r.demographics.shift, SHIFTS)),
    byQualification: kruskalWallis(
      groupBy(records, config.score, r => r.demographics.qualification, QUALIFICATIONS),
    ),
  };
}

// ── Hypothesis wording ────────────────────────────────────────────────────

function decide(p: number, n: number, minimumN: number): Decision {
  if (n < minimumN || !Number.isFinite(p)) return 'Not testable';
  return p < ALPHA ? 'Reject' : 'Retain';
}

function decisionSentence(decision: Decision, rejectText: string, retainText: string): string {
  if (decision === 'Reject') return rejectText;
  if (decision === 'Retain') return retainText;
  return 'Too few records have been submitted for this test to be reported.';
}

// ── Entry point ───────────────────────────────────────────────────────────

export function buildAnalysis(
  records: AssessmentRecord[],
  totalSubmitted = records.length,
): AnalysisModel {
  const n = records.length;
  const workloadScores = records.map(r => r.workloadScore);
  const ipcScores = records.map(r => r.ipcScore);
  const experience = numeric(records.map(r => r.demographics.yearsExperience));
  const patientLoad = numeric(records.map(r => r.demographics.patientLoad));

  const workload = analyseScale(records, {
    key: 'workload',
    label: 'Nursing workload',
    items: WORKLOAD_ITEMS,
    subscaleNames: WORKLOAD_SUBSCALES,
    scaleMax: 5,
    responseRange: '1 = Not at all to 5 = Extremely',
    bands: WORKLOAD_BANDS,
    score: r => r.workloadScore,
    band: r => r.workloadCategory,
    subscore: r => r.subscoreWorkload,
  });

  const ipc = analyseScale(records, {
    key: 'ipc',
    label: 'IPC compliance',
    items: IPC_ITEMS,
    subscaleNames: IPC_SUBSCALES,
    scaleMax: 4,
    responseRange: '1 = Never to 4 = Always',
    bands: IPC_BANDS,
    score: r => r.ipcScore,
    band: r => r.ipcCategory,
    subscore: r => r.subscoreIPC,
  });

  const spearmanResult = spearman(workloadScores, ipcScores);
  const pearsonResult = pearson(workloadScores, ipcScores);
  const regression = linearRegression(workloadScores, ipcScores);

  // Experience and patient load are only defined for records that supplied a
  // number, so the paired vectors are rebuilt rather than reused.
  const pairedLoad = records.filter(r => Number.isFinite(parseFloat(r.demographics.patientLoad)));
  const pairedExperience = records
    .filter(r => Number.isFinite(parseFloat(r.demographics.yearsExperience)));

  const crossTab = chiSquareIndependence(
    records.map(r => r.workloadCategory),
    records.map(r => r.ipcCategory),
    [...WORKLOAD_BANDS],
    [...IPC_BANDS],
  );

  const ipcByWorkloadBand = WORKLOAD_BANDS.map(band => {
    const values = records.filter(r => r.workloadCategory === band).map(r => r.ipcScore);
    return { label: band, n: values.length, mean: mean(values), sd: stdDev(values) };
  }).filter(row => row.n > 0);

  const hypotheses = buildHypotheses({
    n, spearmanResult, crossTab, workload, ipc,
  });

  return {
    generatedAt: new Date().toISOString(),
    n,
    totalSubmitted,
    excludedCount: Math.max(0, totalSubmitted - n),
    sufficient: n >= MINIMUM_N,
    minimumN: MINIMUM_N,
    sample: {
      ward: frequencyTable(records.map(r => r.demographics.ward), WARD_NAMES),
      wardGroup: frequencyTable(records.map(r => wardGroup(r.demographics.ward)), WARD_GROUPS),
      shift: frequencyTable(records.map(r => r.demographics.shift), [...SHIFTS]),
      qualification: frequencyTable(
        records.map(r => r.demographics.qualification), [...QUALIFICATIONS],
      ),
      experienceBand: frequencyTable(
        bandValues(experience, EXPERIENCE_BANDS), EXPERIENCE_BANDS.map(b => b.label),
      ),
      patientLoadBand: frequencyTable(
        bandValues(patientLoad, PATIENT_LOAD_BANDS), PATIENT_LOAD_BANDS.map(b => b.label),
      ),
      experience: describe(experience),
      patientLoad: describe(patientLoad),
    },
    workload,
    ipc,
    association: {
      spearman: spearmanResult,
      pearson: pearsonResult,
      regression,
      interpretation: interpretCorrelation(spearmanResult.coefficient),
      workloadVsPatientLoad: spearman(
        pairedLoad.map(r => r.workloadScore),
        pairedLoad.map(r => parseFloat(r.demographics.patientLoad)),
      ),
      workloadVsExperience: spearman(
        pairedExperience.map(r => r.workloadScore),
        pairedExperience.map(r => parseFloat(r.demographics.yearsExperience)),
      ),
      ipcVsExperience: spearman(
        pairedExperience.map(r => r.ipcScore),
        pairedExperience.map(r => parseFloat(r.demographics.yearsExperience)),
      ),
    },
    crossTab,
    ipcByWorkloadBand,
    scatter: records.map(r => ({
      workload: r.workloadScore,
      ipc: r.ipcScore,
      code: r.demographics.nurseCode,
      band: r.workloadCategory,
      ward: r.demographics.ward,
    })),
    hypotheses,
    conclusions: buildConclusions({ n, workload, ipc, spearmanResult, ipcByWorkloadBand }),
  };
}

// ── Hypotheses ────────────────────────────────────────────────────────────

function buildHypotheses(input: {
  n: number;
  spearmanResult: CorrelationResult;
  crossTab: ChiSquareResult;
  workload: ScaleAnalysis;
  ipc: ScaleAnalysis;
}): HypothesisResult[] {
  const { n, spearmanResult, crossTab, workload, ipc } = input;

  const primaryDecision = decide(spearmanResult.p, n, MINIMUM_N);
  const direction = spearmanResult.coefficient < 0 ? 'inverse' : 'positive';

  const hypotheses: HypothesisResult[] = [
    {
      id: 'H1',
      nullHypothesis:
        'There is no statistically significant relationship between nursing workload and '
        + 'compliance with infection prevention and control practices among nurses in UNIOSUN '
        + 'Teaching Hospital.',
      alternativeHypothesis:
        'There is a statistically significant relationship between nursing workload and '
        + 'compliance with infection prevention and control practices among nurses in UNIOSUN '
        + 'Teaching Hospital.',
      test: "Spearman's rank-order correlation",
      statisticLabel: 'rho',
      statistic: spearmanResult.coefficient,
      df: Number.isFinite(spearmanResult.df) ? spearmanResult.df : null,
      p: spearmanResult.p,
      n,
      decision: primaryDecision,
      conclusion: decisionSentence(
        primaryDecision,
        `The null hypothesis is rejected. Nursing workload and IPC compliance are significantly `
        + `related in this sample (${interpretCorrelation(spearmanResult.coefficient)}, `
        + `${direction} association).`,
        'The null hypothesis is retained. This sample provides no evidence of a significant '
        + 'relationship between nursing workload and IPC compliance.',
      ),
    },
    {
      id: 'H2',
      nullHypothesis:
        'There is no statistically significant association between the workload category '
        + 'of a nurse and their IPC compliance category.',
      alternativeHypothesis:
        'Workload category and IPC compliance category are significantly associated.',
      test: 'Pearson chi-square test of independence',
      statisticLabel: 'chi-square',
      statistic: crossTab.chiSquare,
      df: Number.isFinite(crossTab.df) ? crossTab.df : null,
      p: crossTab.p,
      n,
      decision: decide(crossTab.p, n, MINIMUM_N),
      conclusion: decisionSentence(
        decide(crossTab.p, n, MINIMUM_N),
        'The null hypothesis is rejected: the compliance band a nurse falls into depends on '
        + 'their workload band.',
        'The null hypothesis is retained: compliance band and workload band are independent '
        + 'in this sample.',
      ),
    },
    {
      id: 'H3',
      nullHypothesis:
        'There is no statistically significant difference in nursing workload across the '
        + 'clinical areas of UNIOSUN Teaching Hospital.',
      alternativeHypothesis:
        'Nursing workload differs significantly across clinical areas.',
      test: 'Kruskal-Wallis H (by service area)',
      statisticLabel: 'H',
      statistic: workload.byWardGroup.h,
      df: Number.isFinite(workload.byWardGroup.df) ? workload.byWardGroup.df : null,
      p: workload.byWardGroup.p,
      n: workload.byWardGroup.n,
      decision: decide(workload.byWardGroup.p, workload.byWardGroup.n, MINIMUM_N),
      conclusion: decisionSentence(
        decide(workload.byWardGroup.p, workload.byWardGroup.n, MINIMUM_N),
        'The null hypothesis is rejected: workload is not distributed evenly across the '
        + 'service areas.',
        'The null hypothesis is retained: workload does not differ significantly across '
        + 'service areas.',
      ),
    },
    {
      id: 'H4',
      nullHypothesis:
        'There is no statistically significant difference in IPC compliance across the '
        + 'clinical areas of UNIOSUN Teaching Hospital.',
      alternativeHypothesis:
        'IPC compliance differs significantly across clinical areas.',
      test: 'Kruskal-Wallis H (by service area)',
      statisticLabel: 'H',
      statistic: ipc.byWardGroup.h,
      df: Number.isFinite(ipc.byWardGroup.df) ? ipc.byWardGroup.df : null,
      p: ipc.byWardGroup.p,
      n: ipc.byWardGroup.n,
      decision: decide(ipc.byWardGroup.p, ipc.byWardGroup.n, MINIMUM_N),
      conclusion: decisionSentence(
        decide(ipc.byWardGroup.p, ipc.byWardGroup.n, MINIMUM_N),
        'The null hypothesis is rejected: compliance varies significantly between service '
        + 'areas, so improvement effort can be targeted.',
        'The null hypothesis is retained: compliance is statistically comparable across '
        + 'service areas.',
      ),
    },
  ];

  return hypotheses;
}

// ── The three categorical conclusions ─────────────────────────────────────

const WORKLOAD_PALETTE = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626'];
const IPC_PALETTE = ['#dc2626', '#ca8a04', '#2563eb', '#16a34a'];

function buildConclusions(input: {
  n: number;
  workload: ScaleAnalysis;
  ipc: ScaleAnalysis;
  spearmanResult: CorrelationResult;
  ipcByWorkloadBand: { label: string; n: number; mean: number; sd: number }[];
}): Conclusion[] {
  const { n, workload, ipc, spearmanResult, ipcByWorkloadBand } = input;

  const highWorkloadShare = workload.bands
    .filter(b => b.label === 'High' || b.label === 'Very High')
    .reduce((sum, b) => sum + b.percent, 0);

  const adequateComplianceShare = ipc.bands
    .filter(b => b.label === 'Satisfactory' || b.label === 'Optimal')
    .reduce((sum, b) => sum + b.percent, 0);

  const decision = decide(spearmanResult.p, n, MINIMUM_N);
  const rho = spearmanResult.coefficient;

  const gap = ipcByWorkloadBand.length >= 2
    ? ipcByWorkloadBand[0].mean - ipcByWorkloadBand[ipcByWorkloadBand.length - 1].mean
    : NaN;

  return [
    {
      number: 1,
      question: 'Objective 1 - What is the level of nursing workload in UNIOSUNTH?',
      headline: n === 0
        ? 'No records yet'
        : `Workload is predominantly ${workload.modalBand.toLowerCase()}`
          + ` (${fmt(workload.modalBandPercent)}% of nurses)`,
      narrative: n === 0
        ? 'Submit assessments to populate this conclusion.'
        : `Nurses recorded a mean workload of ${fmt(workload.descriptives.mean)}% `
          + `(SD ${fmt(workload.descriptives.sd)}, median `
          + `${fmt(workload.descriptives.median)}%) on the adapted 12-item scale, an `
          + `average item response of ${fmt(workload.itemMean, 2)} out of 5. `
          + `${fmt(highWorkloadShare)}% of nurses fall in the High or Very High bands, `
          + `and the heaviest subscale is `
          + `${[...workload.subscales].sort((a, b) => b.descriptives.mean - a.descriptives.mean)[0]?.name ?? '—'}.`,
      chartType: 'pie',
      chartLabel: 'Distribution of nursing workload bands',
      data: workload.bands.map(b => ({
        label: b.label, value: b.count, detail: `${b.percent.toFixed(1)}%`,
      })),
      palette: WORKLOAD_PALETTE,
    },
    {
      number: 2,
      question: 'Objective 2 - What is the level of IPC compliance in UNIOSUNTH?',
      headline: n === 0
        ? 'No records yet'
        : `Compliance is predominantly ${ipc.modalBand.toLowerCase()}`
          + ` (${fmt(ipc.modalBandPercent)}% of nurses)`,
      narrative: n === 0
        ? 'Submit assessments to populate this conclusion.'
        : `Compliance with standard precautions averaged ${fmt(ipc.descriptives.mean)}% `
          + `(SD ${fmt(ipc.descriptives.sd)}, median ${fmt(ipc.descriptives.median)}%) `
          + `on the CSPS, an average item response of ${fmt(ipc.itemMean, 2)} out of 4. `
          + `${fmt(adequateComplianceShare)}% of nurses reached Satisfactory or Optimal `
          + `compliance; the weakest domain is `
          + `${[...ipc.subscales].sort((a, b) => a.descriptives.mean - b.descriptives.mean)[0]?.name ?? '—'}.`,
      chartType: 'pie',
      chartLabel: 'Distribution of IPC compliance bands',
      data: ipc.bands.map(b => ({
        label: b.label, value: b.count, detail: `${b.percent.toFixed(1)}%`,
      })),
      palette: IPC_PALETTE,
    },
    {
      number: 3,
      question: 'Hypothesis - Does workload relate to IPC compliance?',
      headline: decision === 'Not testable'
        ? `At least ${MINIMUM_N} records are needed to test the hypothesis`
        : decision === 'Reject'
          ? `Null hypothesis rejected - a ${interpretCorrelation(rho)} relationship (rho = ${rho.toFixed(3)})`
          : `Null hypothesis retained - no significant relationship (rho = ${rho.toFixed(3)})`,
      narrative: decision === 'Not testable'
        ? `The correlation is computed once ${MINIMUM_N} assessments have been submitted.`
        : decision === 'Reject'
          ? `Spearman's rho = ${rho.toFixed(3)} (n = ${n}, p ${spearmanResult.p < 0.001 ? '< .001' : `= ${spearmanResult.p.toFixed(3)}`}). `
            + (rho < 0
              ? `Compliance falls as workload rises: mean compliance is `
                + `${Number.isFinite(gap) ? `${fmt(Math.abs(gap))} percentage points ${gap > 0 ? 'lower' : 'higher'}` : 'different'} `
                + `in the heaviest workload band than in the lightest.`
              : 'Compliance rises with workload in this sample, which runs against the '
                + 'direction usually reported and warrants a look at response bias.')
          : `Spearman's rho = ${rho.toFixed(3)} (n = ${n}, p = ${spearmanResult.p.toFixed(3)}), which does not `
            + 'reach the 0.05 threshold. Workload and compliance move independently in this sample.',
      chartType: 'bar',
      chartLabel: 'Mean IPC compliance (%) within each workload band',
      data: ipcByWorkloadBand.map(row => ({
        label: row.label,
        value: Number.isFinite(row.mean) ? Math.round(row.mean * 10) / 10 : 0,
        detail: `n = ${row.n}`,
      })),
      palette: WORKLOAD_PALETTE,
    },
  ];
}
