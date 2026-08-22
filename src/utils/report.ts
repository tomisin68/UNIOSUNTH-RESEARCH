import type { AnalysisModel, ScaleAnalysis } from './analysisModel';
import { ALPHA } from './analysisModel';
import type { AssessmentRecord } from '../types';
import { WORKLOAD_ITEMS } from '../data/workloadItems';
import { IPC_ITEMS } from '../data/ipcItems';
import { wardGroup } from '../data/wards';
import { formatNumber, formatP, type Descriptives, type FrequencyRow, type KruskalWallisResult } from './statistics';
import { downloadFile, toCSV, stamp } from './download';

// ── Downloadable analysis ─────────────────────────────────────────────────
// Three artefacts, all generated from the same AnalysisModel:
//
//   1. a full written report (HTML, opens in Word and prints to PDF unchanged)
//   2. the statistics as a spreadsheet
//   3. the raw record-level data, one row per participant
//
// The charts in the report are the live charts: they are serialised out of the
// page as SVG, so the figure in the report is the figure the reader just saw.

export interface CapturedChart {
  title: string;
  svg: string;
}

/** Serialises the rendered charts inside `root` for embedding in the report. */
export function captureCharts(root: HTMLElement | null): CapturedChart[] {
  if (!root) return [];
  const serializer = new XMLSerializer();
  const charts: CapturedChart[] = [];

  root.querySelectorAll<HTMLElement>('[data-chart]').forEach(container => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    // Recharts sizes its SVG in pixels; a viewBox lets the report scale it.
    const width = svg.clientWidth || Number(svg.getAttribute('width')) || 640;
    const height = svg.clientHeight || Number(svg.getAttribute('height')) || 320;
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.setAttribute('width', '100%');
    clone.removeAttribute('height');
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    charts.push({
      title: container.getAttribute('data-chart') ?? '',
      svg: serializer.serializeToString(clone),
    });
  });

  return charts;
}

// ── Small formatting helpers ──────────────────────────────────────────────

const escapeHTML = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const pct = (v: number, dp = 1) => (Number.isFinite(v) ? `${v.toFixed(dp)}%` : '—');

/** HTML-safe p-value: formatP can return "< .001", and a bare "<" is markup. */
const pValue = (value: number) => escapeHTML(formatP(value));

/** Same, for the table cells that drop the leading "=". */
const pCell = (value: number) => formatP(value).replace('= ', '');

function table(headers: string[], rows: (string | number)[][]): string {
  const head = headers.map(h => `<th>${escapeHTML(h)}</th>`).join('');
  const body = rows
    .map(row => `<tr>${row.map(cell => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function descriptivesRow(label: string, d: Descriptives): (string | number)[] {
  return [
    label, d.n, formatNumber(d.mean), formatNumber(d.sd), formatNumber(d.sem),
    `${formatNumber(d.ci95Lower)} - ${formatNumber(d.ci95Upper)}`,
    formatNumber(d.median), formatNumber(d.q1), formatNumber(d.q3), formatNumber(d.iqr),
    formatNumber(d.min, 0), formatNumber(d.max, 0), formatNumber(d.range, 0),
    formatNumber(d.skewness), formatNumber(d.kurtosis), formatNumber(d.cv, 1),
  ];
}

const DESCRIPTIVE_HEADERS = [
  'Variable', 'n', 'Mean', 'SD', 'SEM', '95% CI', 'Median', 'Q1', 'Q3', 'IQR',
  'Min', 'Max', 'Range', 'Skewness', 'Kurtosis', 'CV %',
];

function frequencyRows(rows: FrequencyRow[]): (string | number)[][] {
  return rows.map(r => [r.label, r.count, pct(r.percent)]);
}

function kruskalTable(result: KruskalWallisResult): string {
  if (!result.groups.length) {
    return '<p class="muted">Not enough records in two or more groups for this comparison.</p>';
  }
  return table(
    ['Group', 'n', 'Mean', 'SD', 'Median', 'Mean rank'],
    result.groups.map(g => [
      g.label, g.n, formatNumber(g.mean, 1), formatNumber(g.sd, 1),
      formatNumber(g.median, 1), formatNumber(g.meanRank, 1),
    ]),
  ) + `<p class="stat">H(${result.df}) = ${formatNumber(result.h)}, `
    + `p ${pValue(result.p)}, N = ${result.n}`
    + `${result.p < ALPHA ? ' - significant at the .05 level' : ''}</p>`;
}

function scaleSection(scale: ScaleAnalysis, title: string, objective: string): string {
  const d = scale.descriptives;
  return `
<h2>${escapeHTML(title)}</h2>
<p class="objective">${escapeHTML(objective)}</p>

<h3>Overall score</h3>
${table(DESCRIPTIVE_HEADERS, [descriptivesRow(`${scale.label} (0-100)`, d)])}
<p>
  Raw total score: mean ${formatNumber(scale.rawDescriptives.mean)} of a possible
  ${scale.rawMax} (scale range ${scale.rawMin}-${scale.rawMax}).
  Mean response per item: ${formatNumber(scale.itemMean)}
  (${escapeHTML(scale.responseRange)}).
  Internal consistency in this sample: Cronbach's alpha = ${formatNumber(scale.alpha, 3)}
  (${escapeHTML(scale.alphaVerdict)}).
</p>
<p>
  Distribution: ${scale.normality.applicable
    ? `D'Agostino-Pearson K&sup2; = ${formatNumber(scale.normality.k2)}, p ${pValue(scale.normality.p)} -
       the scores are ${scale.normality.normal ? 'consistent with' : 'not consistent with'} normality`
    : 'too few records for a formal normality test'}.
  Non-parametric tests are used throughout.
</p>

<h3>Distribution across bands</h3>
${table(['Band', 'Frequency', 'Percent'], frequencyRows(scale.bands))}

<h3>Subscales</h3>
${table(
  ['Subscale', 'Items', 'Mean %', 'SD', 'Median %', 'Mean item score', "Cronbach's alpha"],
  scale.subscales.map(s => [
    s.name, s.itemCount, formatNumber(s.descriptives.mean, 1),
    formatNumber(s.descriptives.sd, 1), formatNumber(s.descriptives.median, 1),
    formatNumber(s.itemMean), formatNumber(s.alpha, 3),
  ]),
)}

<h3>Item-level responses</h3>
<p class="muted">Reverse-keyed items are shown after inversion, so a higher mean always
means more of the construct.</p>
${table(
  ['#', 'Item', 'Subscale', 'Mean', 'SD', 'n'],
  scale.items.map(i => [
    i.id, i.text + (i.reversed ? ' (reverse scored)' : ''), i.subscale,
    formatNumber(i.mean), formatNumber(i.sd), i.n,
  ]),
)}

<h3>Comparison across groups</h3>
<h4>By service area</h4>
${kruskalTable(scale.byWardGroup)}
<h4>By ward</h4>
${kruskalTable(scale.byWard)}
<h4>By shift</h4>
${kruskalTable(scale.byShift)}
<h4>By qualification</h4>
${kruskalTable(scale.byQualification)}
`;
}

// ── The written report ────────────────────────────────────────────────────

export function buildReportHTML(model: AnalysisModel, charts: CapturedChart[]): string {
  const generated = new Date(model.generatedAt);
  const { workload, ipc, association, crossTab } = model;

  const chartBlocks = charts
    .map(c => `<figure class="chart"><figcaption>${escapeHTML(c.title)}</figcaption>${c.svg}</figure>`)
    .join('');

  const crossTabTable = crossTab.rowLabels.length
    ? table(
      ['Workload band', ...crossTab.colLabels, 'Total'],
      crossTab.observed.map((row, i) => [
        crossTab.rowLabels[i], ...row, row.reduce((a, b) => a + b, 0),
      ]),
    )
    : '<p class="muted">No records to cross-tabulate.</p>';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UNIOSUNTH Nursing Workload and IPC Compliance - Analysis Report</title>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#1e3a8a; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink);
         margin: 0 auto; padding: 32px 28px 64px; max-width: 900px; line-height: 1.55;
         font-size: 14px; background: #fff; }
  h1 { color: var(--accent); font-size: 24px; margin: 0 0 4px; line-height: 1.25; }
  h2 { color: var(--accent); font-size: 18px; margin: 34px 0 10px;
       border-bottom: 2px solid var(--accent); padding-bottom: 5px; }
  h3 { font-size: 15px; margin: 22px 0 8px; color: #374151; }
  h4 { font-size: 13px; margin: 16px 0 6px; color: #4b5563; text-transform: uppercase;
       letter-spacing: .04em; }
  p { margin: 8px 0; }
  .subtitle { color: var(--muted); font-size: 13px; margin: 0 0 2px; }
  .meta { color: var(--muted); font-size: 11px; border-bottom: 1px solid var(--line);
          padding-bottom: 14px; margin-bottom: 8px; }
  .muted { color: var(--muted); font-size: 12px; }
  .objective { background: #f8fafc; border-left: 3px solid var(--accent); padding: 8px 12px;
               font-size: 13px; color: #334155; margin: 10px 0 16px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 11.5px;
          font-family: Arial, Helvetica, sans-serif; }
  th, td { border: 1px solid var(--line); padding: 5px 8px; text-align: left;
           vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .stat { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700;
          color: #111827; margin: 4px 0 16px; }
  .hypothesis { border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px;
                margin: 12px 0; page-break-inside: avoid; }
  .hypothesis h4 { margin-top: 0; color: var(--accent); }
  .decision { display: inline-block; padding: 2px 10px; border-radius: 3px; font-weight: 700;
              font-size: 11px; font-family: Arial, Helvetica, sans-serif; color: #fff; }
  .reject { background: #16a34a; }
  .retain { background: #6b7280; }
  .untestable { background: #ca8a04; }
  .conclusion { border: 1px solid var(--line); border-left: 5px solid var(--accent);
                border-radius: 6px; padding: 14px 16px; margin: 16px 0;
                page-break-inside: avoid; }
  .conclusion h3 { margin-top: 0; }
  .headline { font-size: 15px; font-weight: 700; color: var(--accent); margin: 6px 0; }
  .chart { margin: 16px 0; page-break-inside: avoid; border: 1px solid var(--line);
           border-radius: 6px; padding: 12px; }
  .chart figcaption { font-family: Arial, Helvetica, sans-serif; font-size: 11px;
                      font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
                      color: var(--muted); margin-bottom: 8px; }
  .chart svg { max-width: 100%; height: auto; }
  footer { margin-top: 40px; border-top: 1px solid var(--line); padding-top: 12px;
           color: var(--muted); font-size: 11px; }
  @media print {
    body { padding: 0; font-size: 11pt; max-width: none; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>

<h1>Nursing Workload and Compliance with Infection Prevention and Control Practices</h1>
<p class="subtitle">UNIOSUN Teaching Hospital (UNIOSUNTH), Osogbo - Analysis Report</p>
<p class="meta">
  Generated ${escapeHTML(generated.toLocaleString())} &middot;
  ${model.n} record${model.n === 1 ? '' : 's'} analysed
  ${model.excludedCount ? `(${model.excludedCount} excluded from ${model.totalSubmitted} submitted)` : ''}
  &middot; significance level alpha = ${ALPHA}
</p>

<h2>1. Purpose of the study</h2>
<p>This report addresses two objectives and the hypotheses that follow from them:</p>
<ol>
  <li><strong>Objective 1.</strong> To assess nursing workload among nurses in UNIOSUN Teaching Hospital.</li>
  <li><strong>Objective 2.</strong> To assess compliance with infection prevention and control (IPC)
      practices among nurses in UNIOSUN Teaching Hospital.</li>
</ol>
<p>
  Workload was measured with a 12-item adapted nursing workload scale (physical and task demands,
  cognitive and emotional demands, administrative and resource burden), rated 1-5. IPC compliance
  was measured with the 20-item Compliance with Standard Precautions Scale (Lam, 2004) covering
  personal protective equipment, sharps safety, decontamination and waste, and hand hygiene, rated
  1-4. Both instruments are reported as a normalised 0-100 score so that they can be compared
  directly.
</p>

<h2>2. Characteristics of the sample</h2>
<h3>Clinical area</h3>
${table(['Ward', 'Frequency', 'Percent'], frequencyRows(model.sample.ward))}
<h3>Service area</h3>
${table(['Service area', 'Frequency', 'Percent'], frequencyRows(model.sample.wardGroup))}
<h3>Shift, qualification, experience and patient load</h3>
${table(['Shift', 'Frequency', 'Percent'], frequencyRows(model.sample.shift))}
${table(['Qualification', 'Frequency', 'Percent'], frequencyRows(model.sample.qualification))}
${table(['Years of experience', 'Frequency', 'Percent'], frequencyRows(model.sample.experienceBand))}
${table(['Patients this shift', 'Frequency', 'Percent'], frequencyRows(model.sample.patientLoadBand))}
${table(DESCRIPTIVE_HEADERS, [
  descriptivesRow('Years of experience', model.sample.experience),
  descriptivesRow('Patients this shift', model.sample.patientLoad),
])}

${scaleSection(workload, '3. Objective 1 - Nursing workload', 'To assess nursing workload among nurses in UNIOSUN Teaching Hospital.')}

${scaleSection(ipc, '4. Objective 2 - IPC compliance', 'To assess compliance with infection prevention and control practices among nurses in UNIOSUN Teaching Hospital.')}

<h2>5. Relationship between workload and IPC compliance</h2>
${table(
  ['Test', 'Coefficient', 'n', 'df', 'p', 'Interpretation'],
  [
    ["Spearman's rho (workload vs IPC)", formatNumber(association.spearman.coefficient, 3),
      association.spearman.n, formatNumber(association.spearman.df, 0),
      pCell(association.spearman.p), association.interpretation],
    ["Pearson's r (workload vs IPC)", formatNumber(association.pearson.coefficient, 3),
      association.pearson.n, formatNumber(association.pearson.df, 0),
      pCell(association.pearson.p), 'reported for comparison'],
    ['Workload vs patients this shift', formatNumber(association.workloadVsPatientLoad.coefficient, 3),
      association.workloadVsPatientLoad.n, formatNumber(association.workloadVsPatientLoad.df, 0),
      pCell(association.workloadVsPatientLoad.p), 'convergent validity check'],
    ['Workload vs years of experience', formatNumber(association.workloadVsExperience.coefficient, 3),
      association.workloadVsExperience.n, formatNumber(association.workloadVsExperience.df, 0),
      pCell(association.workloadVsExperience.p), ''],
    ['IPC compliance vs years of experience', formatNumber(association.ipcVsExperience.coefficient, 3),
      association.ipcVsExperience.n, formatNumber(association.ipcVsExperience.df, 0),
      pCell(association.ipcVsExperience.p), ''],
  ],
)}
<p class="stat">
  Least-squares fit: IPC = ${formatNumber(association.regression.intercept, 2)}
  ${association.regression.slope < 0 ? '-' : '+'} ${formatNumber(Math.abs(association.regression.slope), 3)}
  &times; workload, R&sup2; = ${formatNumber(association.regression.r2, 3)}
</p>
<p class="muted">
  Effect size convention (Cohen, 1988): |rho| below .10 negligible, .10-.29 weak,
  .30-.49 moderate, .50-.69 strong, .70 and above very strong.
</p>

<h3>Workload band by compliance band</h3>
${crossTabTable}
<p class="stat">
  chi-square(${crossTab.df}) = ${formatNumber(crossTab.chiSquare)}, p ${pValue(crossTab.p)},
  Cramer's V = ${formatNumber(crossTab.cramersV, 3)}, N = ${crossTab.n}
</p>
${crossTab.expectedCountWarning
  ? '<p class="muted">More than 20% of cells have an expected count below 5, so the chi-square '
    + 'approximation should be read with caution at this sample size.</p>'
  : ''}
<h3>Mean compliance within each workload band</h3>
${table(
  ['Workload band', 'n', 'Mean IPC %', 'SD'],
  model.ipcByWorkloadBand.map(r => [r.label, r.n, formatNumber(r.mean, 1), formatNumber(r.sd, 1)]),
)}

<h2>6. Hypothesis testing</h2>
<p>
  Each null hypothesis is tested at alpha = ${ALPHA}. The null is rejected when p &lt; ${ALPHA}
  and retained otherwise.
</p>
${model.hypotheses.map(h => `
<div class="hypothesis">
  <h4>${escapeHTML(h.id)} &middot; ${escapeHTML(h.test)}</h4>
  <p><strong>H&#8320;:</strong> ${escapeHTML(h.nullHypothesis)}</p>
  <p><strong>H&#8321;:</strong> ${escapeHTML(h.alternativeHypothesis)}</p>
  <p class="stat">
    ${escapeHTML(h.statisticLabel)} = ${formatNumber(h.statistic, 3)}${h.df !== null ? `, df = ${h.df}` : ''},
    n = ${h.n}, p ${pValue(h.p)}
  </p>
  <p>
    <span class="decision ${h.decision === 'Reject' ? 'reject' : h.decision === 'Retain' ? 'retain' : 'untestable'}">
      ${h.decision === 'Reject' ? 'REJECT H&#8320;' : h.decision === 'Retain' ? 'RETAIN H&#8320;' : 'NOT TESTABLE'}
    </span>
    ${escapeHTML(h.conclusion)}
  </p>
</div>`).join('')}

<h2>7. Conclusions</h2>
${model.conclusions.map(c => `
<div class="conclusion">
  <h3>Conclusion ${c.number}: ${escapeHTML(c.question)}</h3>
  <p class="headline">${escapeHTML(c.headline)}</p>
  <p>${escapeHTML(c.narrative)}</p>
  ${table(
    [c.chartType === 'pie' ? 'Category' : 'Workload band',
      c.chartType === 'pie' ? 'Nurses' : 'Mean IPC %', 'Detail'],
    c.data.map(d => [
      d.label,
      c.chartType === 'bar' ? formatNumber(d.value, 1) : d.value,
      d.detail ?? '',
    ]),
  )}
</div>`).join('')}

${chartBlocks ? `<h2>8. Figures</h2>${chartBlocks}` : ''}

<footer>
  UNIOSUN Teaching Hospital nursing research study &middot; Compliance with Standard Precautions
  Scale adapted from Lam (2004) &middot; workload scale adapted from the Nursing Activities Score
  and NASA-TLX. Statistics computed by the study application from
  ${model.n} record${model.n === 1 ? '' : 's'} held in the study database.
</footer>

</body></html>`;
}

// ── Public actions ────────────────────────────────────────────────────────

export function downloadAnalysisReport(model: AnalysisModel, charts: CapturedChart[]): void {
  downloadFile(
    `UNIOSUNTH_Analysis_Report_${stamp()}.html`,
    buildReportHTML(model, charts),
    'text/html',
  );
}

export function printAnalysisReport(model: AnalysisModel, charts: CapturedChart[]): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildReportHTML(model, charts));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
  return true;
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
