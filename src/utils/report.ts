import type { AnalysisModel } from './analysisModel';
import { ALPHA } from './analysisModel';
import type { AssessmentRecord } from '../types';
import { WORKLOAD_ITEMS } from '../data/workloadItems';
import { IPC_ITEMS } from '../data/ipcItems';
import { wardGroup } from '../data/wards';
import type { Descriptives, FrequencyRow, KruskalWallisResult } from './statistics';
import { downloadFile, toCSV, stamp } from './download';
import { buildChapterFour } from './chapterFour';
import { downloadChapterDocx, downloadChapterPdf, downloadChapterHTML } from './chapterExport';

// ── Downloadable analysis ─────────────────────────────────────────────────
// All generated from the same AnalysisModel:
//
//   1. the written results as Chapter Four of the project (Word, PDF or HTML),
//      laid out to the department's project template
//   2. the statistics as a spreadsheet
//   3. the raw record-level data, one row per participant

export type ReportFormat = 'docx' | 'pdf' | 'html';

export async function downloadAnalysisReport(
  model: AnalysisModel,
  records: AssessmentRecord[],
  format: ReportFormat,
): Promise<void> {
  const chapter = buildChapterFour(model, records);
  if (format === 'docx') await downloadChapterDocx(chapter);
  else if (format === 'pdf') await downloadChapterPdf(chapter);
  else downloadChapterHTML(chapter);
}

// ── Statistics spreadsheet ────────────────────────────────────────────────

function descriptiveCSVRows(label: string, d: Descriptives): (string | number)[][] {
  return [[
    label, d.n, d.mean, d.sd, d.sem, d.ci95Lower, d.ci95Upper, d.median, d.q1, d.q3,
    d.iqr, d.min, d.max, d.range, d.skewness, d.kurtosis, d.cv,
  ].map(v => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(4)) : v))];
}

export function downloadStatisticsCSV(model: AnalysisModel): void {
  const rows: (string | number)[][] = [];
  const blank = () => rows.push([]);
  const section = (title: string) => { blank(); rows.push([title]); };

  rows.push(['UNIOSUNTH nursing workload and IPC compliance - statistics']);
  rows.push(['Generated', new Date(model.generatedAt).toLocaleString()]);
  rows.push(['Records analysed', model.n]);
  rows.push(['Records excluded', model.excludedCount]);
  rows.push(['Significance level', ALPHA]);

  section('DESCRIPTIVE STATISTICS');
  rows.push([
    'Variable', 'n', 'Mean', 'SD', 'SEM', '95% CI lower', '95% CI upper', 'Median',
    'Q1', 'Q3', 'IQR', 'Min', 'Max', 'Range', 'Skewness', 'Kurtosis', 'CV %',
  ]);
  rows.push(...descriptiveCSVRows('Workload score (0-100)', model.workload.descriptives));
  rows.push(...descriptiveCSVRows('IPC compliance score (0-100)', model.ipc.descriptives));
  rows.push(...descriptiveCSVRows('Workload raw total', model.workload.rawDescriptives));
  rows.push(...descriptiveCSVRows('IPC raw total', model.ipc.rawDescriptives));
  for (const s of model.workload.subscales) {
    rows.push(...descriptiveCSVRows(`Workload - ${s.name}`, s.descriptives));
  }
  for (const s of model.ipc.subscales) {
    rows.push(...descriptiveCSVRows(`IPC - ${s.name}`, s.descriptives));
  }
  rows.push(...descriptiveCSVRows('Years of experience', model.sample.experience));
  rows.push(...descriptiveCSVRows('Patients this shift', model.sample.patientLoad));

  section('FREQUENCY TABLES');
  const freq = (title: string, table: FrequencyRow[]) => {
    rows.push([title, 'Frequency', 'Percent']);
    for (const r of table) rows.push([r.label, r.count, Number(r.percent.toFixed(2))]);
    blank();
  };
  freq('Ward', model.sample.ward);
  freq('Service area', model.sample.wardGroup);
  freq('Shift', model.sample.shift);
  freq('Qualification', model.sample.qualification);
  freq('Years of experience', model.sample.experienceBand);
  freq('Patients this shift', model.sample.patientLoadBand);
  freq('Workload band', model.workload.bands);
  freq('IPC compliance band', model.ipc.bands);

  section('RELIABILITY (CRONBACH ALPHA)');
  rows.push(['Scale or subscale', 'Items', 'Alpha', 'Interpretation']);
  rows.push(['Nursing workload scale', model.workload.items.length,
    Number(model.workload.alpha.toFixed(4)), model.workload.alphaVerdict]);
  for (const s of model.workload.subscales) {
    rows.push([`  ${s.name}`, s.itemCount, Number(s.alpha.toFixed(4)), '']);
  }
  rows.push(['IPC compliance scale (CSPS)', model.ipc.items.length,
    Number(model.ipc.alpha.toFixed(4)), model.ipc.alphaVerdict]);
  for (const s of model.ipc.subscales) {
    rows.push([`  ${s.name}`, s.itemCount, Number(s.alpha.toFixed(4)), '']);
  }

  section('ITEM STATISTICS');
  rows.push(['Scale', 'Item', 'Subscale', 'Reverse scored', 'Mean', 'SD', 'n', 'Text']);
  for (const i of model.workload.items) {
    rows.push(['Workload', i.id, i.subscale, i.reversed ? 'Yes' : 'No',
      Number(i.mean.toFixed(3)), Number(i.sd.toFixed(3)), i.n, i.text]);
  }
  for (const i of model.ipc.items) {
    rows.push(['IPC', i.id, i.subscale, i.reversed ? 'Yes' : 'No',
      Number(i.mean.toFixed(3)), Number(i.sd.toFixed(3)), i.n, i.text]);
  }

  section('NORMALITY (D-AGOSTINO PEARSON K2)');
  rows.push(['Variable', 'K2', 'p', 'n', 'Consistent with normality']);
  for (const scale of [model.workload, model.ipc]) {
    rows.push([
      scale.label,
      scale.normality.applicable ? Number(scale.normality.k2.toFixed(4)) : 'n too small',
      scale.normality.applicable ? Number(scale.normality.p.toFixed(4)) : '',
      scale.normality.n,
      scale.normality.applicable ? (scale.normality.normal ? 'Yes' : 'No') : '',
    ]);
  }

  section('GROUP COMPARISONS (KRUSKAL-WALLIS H)');
  rows.push(['Variable', 'Grouping', 'Group', 'n', 'Mean', 'SD', 'Median', 'Mean rank', 'H', 'df', 'p']);
  const kwBlock = (variable: string, grouping: string, result: KruskalWallisResult) => {
    for (const g of result.groups) {
      rows.push([
        variable, grouping, g.label, g.n, Number(g.mean.toFixed(2)), Number(g.sd.toFixed(2)),
        Number(g.median.toFixed(2)), Number(g.meanRank.toFixed(2)),
        Number.isFinite(result.h) ? Number(result.h.toFixed(4)) : '',
        result.df, Number.isFinite(result.p) ? Number(result.p.toFixed(4)) : '',
      ]);
    }
  };
  kwBlock('Workload', 'Service area', model.workload.byWardGroup);
  kwBlock('Workload', 'Ward', model.workload.byWard);
  kwBlock('Workload', 'Shift', model.workload.byShift);
  kwBlock('Workload', 'Qualification', model.workload.byQualification);
  kwBlock('IPC compliance', 'Service area', model.ipc.byWardGroup);
  kwBlock('IPC compliance', 'Ward', model.ipc.byWard);
  kwBlock('IPC compliance', 'Shift', model.ipc.byShift);
  kwBlock('IPC compliance', 'Qualification', model.ipc.byQualification);

  section('CORRELATIONS');
  rows.push(['Pair', 'Coefficient', 'Test', 'n', 'df', 'p']);
  const corr = (label: string, test: string, c: typeof model.association.spearman) => {
    rows.push([
      label, Number.isFinite(c.coefficient) ? Number(c.coefficient.toFixed(4)) : '', test,
      c.n, Number.isFinite(c.df) ? c.df : '',
      Number.isFinite(c.p) ? Number(c.p.toFixed(5)) : '',
    ]);
  };
  corr('Workload vs IPC compliance', 'Spearman', model.association.spearman);
  corr('Workload vs IPC compliance', 'Pearson', model.association.pearson);
  corr('Workload vs patients this shift', 'Spearman', model.association.workloadVsPatientLoad);
  corr('Workload vs years of experience', 'Spearman', model.association.workloadVsExperience);
  corr('IPC compliance vs years of experience', 'Spearman', model.association.ipcVsExperience);
  rows.push(['Regression IPC on workload', 'slope', Number(model.association.regression.slope.toFixed(4)),
    'intercept', Number(model.association.regression.intercept.toFixed(4)),
    'R2', Number(model.association.regression.r2.toFixed(4))]);

  section('CROSS-TABULATION: WORKLOAD BAND x IPC BAND (observed)');
  rows.push(['Workload band', ...model.crossTab.colLabels, 'Total']);
  model.crossTab.observed.forEach((row, i) => {
    rows.push([model.crossTab.rowLabels[i], ...row, row.reduce((a, b) => a + b, 0)]);
  });
  rows.push(['Chi-square', Number(model.crossTab.chiSquare.toFixed(4)), 'df', model.crossTab.df,
    'p', Number.isFinite(model.crossTab.p) ? Number(model.crossTab.p.toFixed(5)) : '',
    "Cramer's V", Number.isFinite(model.crossTab.cramersV) ? Number(model.crossTab.cramersV.toFixed(4)) : '']);

  section('HYPOTHESIS TESTS');
  rows.push(['ID', 'Null hypothesis', 'Test', 'Statistic', 'Value', 'df', 'n', 'p', 'Decision', 'Conclusion']);
  for (const h of model.hypotheses) {
    rows.push([
      h.id, h.nullHypothesis, h.test, h.statisticLabel,
      Number.isFinite(h.statistic) ? Number(h.statistic.toFixed(4)) : '',
      h.df ?? '', h.n, Number.isFinite(h.p) ? Number(h.p.toFixed(5)) : '',
      h.decision === 'Reject' ? 'Reject H0' : h.decision === 'Retain' ? 'Retain H0' : 'Not testable',
      h.conclusion,
    ]);
  }

  section('CONCLUSIONS');
  for (const c of model.conclusions) {
    rows.push([`Conclusion ${c.number}`, c.question]);
    rows.push(['', c.headline]);
    rows.push(['', c.narrative]);
    rows.push(['', c.chartLabel]);
    for (const d of c.data) rows.push(['', d.label, d.value, d.detail ?? '']);
    blank();
  }

  downloadFile(`UNIOSUNTH_Statistics_${stamp()}.csv`, toCSV(rows), 'text/csv');
}

// ── Record-level data ─────────────────────────────────────────────────────

/**
 * One row per participant, with every item response, ready for SPSS or R.
 * Item columns hold the raw response; the scored (reverse-keyed) values are
 * recoverable from the scale definitions and are documented in the report.
 */
export function downloadDataCSV(records: AssessmentRecord[]): void {
  const headers = [
    'record_id', 'submitted', 'nurse_code', 'ward', 'service_area', 'shift',
    'qualification', 'years_experience', 'patients_this_shift',
    'workload_score', 'workload_band', 'ipc_score', 'ipc_band', 'excluded',
    ...Object.keys(records[0]?.subscoreWorkload ?? {}).map(k => `wl_sub_${slug(k)}`),
    ...Object.keys(records[0]?.subscoreIPC ?? {}).map(k => `ipc_sub_${slug(k)}`),
    ...WORKLOAD_ITEMS.map(i => `WL${i.id}`),
    ...IPC_ITEMS.map(i => `IPC${i.id}`),
  ];

  const rows = records.map(r => [
    r.id, r.timestamp, r.demographics.nurseCode, r.demographics.ward,
    wardGroup(r.demographics.ward), r.demographics.shift, r.demographics.qualification,
    r.demographics.yearsExperience, r.demographics.patientLoad,
    r.workloadScore, r.workloadCategory, r.ipcScore, r.ipcCategory,
    r.excluded ? 'Yes' : 'No',
    ...Object.keys(records[0]?.subscoreWorkload ?? {}).map(k => r.subscoreWorkload?.[k] ?? ''),
    ...Object.keys(records[0]?.subscoreIPC ?? {}).map(k => r.subscoreIPC?.[k] ?? ''),
    ...WORKLOAD_ITEMS.map(i => r.workloadResponses?.[i.id] ?? ''),
    ...IPC_ITEMS.map(i => r.ipcResponses?.[i.id] ?? ''),
  ]);

  // A codebook sheet cannot travel in a CSV, so the item wording follows the
  // data as commented rows — SPSS ignores them, a human reader does not.
  const codebook: (string | number)[][] = [
    [], ['# CODEBOOK'],
    ['# Column', 'Item text', 'Subscale', 'Reverse scored', 'Response range'],
    ...WORKLOAD_ITEMS.map(i => [`# WL${i.id}`, i.text, i.subscale,
      i.reversed ? 'Yes' : 'No', '1 Not at all - 5 Extremely']),
    ...IPC_ITEMS.map(i => [`# IPC${i.id}`, i.text, i.subscale,
      i.reversed ? 'Yes' : 'No', '1 Never - 4 Always']),
  ];

  downloadFile(
    `UNIOSUNTH_Data_${stamp()}.csv`,
    toCSV([headers, ...rows, ...codebook]),
    'text/csv',
  );
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
