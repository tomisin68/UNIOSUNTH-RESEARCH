import type { AnalysisModel, HypothesisResult, ScaleAnalysis } from './analysisModel';
import { ALPHA } from './analysisModel';
import type { AssessmentRecord, ScaleItem } from '../types';
import { WORKLOAD_ITEMS, WORKLOAD_LABELS, WORKLOAD_SUBSCALES } from '../data/workloadItems';
import { IPC_ITEMS, IPC_LABELS, IPC_SUBSCALES } from '../data/ipcItems';
import { interpretCorrelation, mean, stdDev, type FrequencyRow, type KruskalWallisResult } from './statistics';
import { WORKLOAD_LEVELS, COMPLIANCE_LEVELS, type LevelRange } from './scoring';

// ── Chapter Four, as a format-neutral document ────────────────────────────
// The project supervisor's template lays results out as a thesis chapter:
// numbered sections, "Table 4.x" frequency tables of n (%), a paragraph of
// interpretation under every table, pie charts of the overall levels, answers
// to the research questions, then one table per hypothesis with its decision.
// The supervisor's review (2026-10) added: Table 4.1 alone on the chapter's
// first page, interpretation in the past tense, Mean and SD on the item tables,
// three workload levels and two compliance levels with the computation shown,
// three hypotheses, and reliability moved out of the chapter into an appendix.
//
// buildChapterFour() produces that chapter once as a list of blocks; the Word,
// PDF and HTML exporters only decide how each block looks, so the three
// downloads can never say different things.

export interface TableCell {
  text: string;
  bold?: boolean;
}

export type ChapterBlock =
  | { kind: 'chapterTitle'; lines: string[] }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'table'; caption: string; headers: string[]; rows: TableCell[][]; note?: string;
      /** Tighter type and spacing, so a long table fits on one page. */
      compact?: boolean }
  | { kind: 'figure'; caption: string; legendTitle: string; slices: PieSlice[] }
  | { kind: 'pageBreak' };

export interface PieSlice {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface ChapterFour {
  title: string;
  n: number;
  blocks: ChapterBlock[];
}

// ── Number formatting in the template's style: "112 (90.3)", "p = 0.003" ──

const pct = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
const num = (v: number, dp = 1) => (Number.isFinite(v) ? v.toFixed(dp) : '-');
const nPct = (count: number, total: number) =>
  `${count} (${pct(total ? (count / total) * 100 : 0)})`;
const pText = (p: number) =>
  (!Number.isFinite(p) ? 'p = -' : p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);

const cell = (text: string | number, bold = false): TableCell => ({ text: String(text), bold });

/** "majority" only when it really is more than half; otherwise say so honestly. */
function share(percent: number): string {
  return percent > 50 ? 'majority of the respondents' : 'the largest proportion of the respondents';
}

function modal(rows: FrequencyRow[]): FrequencyRow | null {
  return [...rows].filter(r => r.count > 0).sort((a, b) => b.count - a.count)[0] ?? null;
}

/** Item statements are first person ("I wear gloves…"); this drops the "I" so
 *  the sentence can be built around the respondents. Falls back to a quote. */
function verbPhrase(text: string): string | null {
  const trimmed = text.trim().replace(/\.$/, '');
  return /^I\s/.test(trimmed)
    ? trimmed.slice(2).replace(/\bmy\b/g, 'their').replace(/\bI\b/g, 'they')
    : null;
}

// ── Item response distributions ───────────────────────────────────────────

interface ItemDistribution {
  item: ScaleItem;
  counts: number[]; // index 0 = response 1
  answered: number;
  /** Mean and SD of the scored response (after reverse keying), from the same answers. */
  mean: number;
  sd: number;
}

function distributions(
  records: AssessmentRecord[],
  items: ScaleItem[],
  key: 'workloadResponses' | 'ipcResponses',
  points: number,
): ItemDistribution[] {
  return items.map(item => {
    const counts = Array.from({ length: points }, () => 0);
    const scored: number[] = [];
    for (const record of records) {
      const raw = record[key]?.[item.id];
      if (typeof raw === 'number' && raw >= 1 && raw <= points) {
        counts[raw - 1]++;
        scored.push(item.reversed ? points + 1 - raw : raw);
      }
    }
    return { item, counts, answered: scored.length, mean: mean(scored), sd: stdDev(scored) };
  });
}

/** Each respondent's mean item score (total ÷ number of items), complete answers only. */
function respondentMeans(
  records: AssessmentRecord[],
  items: ScaleItem[],
  key: 'workloadResponses' | 'ipcResponses',
  points: number,
): number[] {
  const out: number[] = [];
  for (const record of records) {
    let total = 0;
    let complete = true;
    for (const item of items) {
      const raw = record[key]?.[item.id];
      if (typeof raw !== 'number' || raw < 1 || raw > points) { complete = false; break; }
      total += item.reversed ? points + 1 - raw : raw;
    }
    if (complete) out.push(total / items.length);
  }
  return out;
}

// ── Section builders ──────────────────────────────────────────────────────

function demographicsTable(model: AnalysisModel): ChapterBlock {
  const groups: [string, FrequencyRow[]][] = [
    ['Service area', model.sample.wardGroup.filter(r => r.count > 0)],
    ['Ward / unit', model.sample.ward.filter(r => r.count > 0)],
    ['Shift', model.sample.shift],
    ['Qualification', model.sample.qualification],
    ['Years of experience', model.sample.experienceBand],
    ['Patients cared for this shift', model.sample.patientLoadBand],
  ];

  const rows: TableCell[][] = [];
  for (const [variable, freq] of groups) {
    freq.forEach((r, i) => {
      rows.push([cell(i === 0 ? variable : '', i === 0), cell(r.label), cell(r.count), cell(pct(r.percent))]);
    });
  }

  return {
    kind: 'table',
    caption: 'Table 4.1: Socio-demographic Characteristics of the Respondents',
    headers: ['Variables', 'Category', `Frequency (n=${model.n})`, 'Percentage (%)'],
    rows,
    compact: true,
  };
}

function demographicsNarrative(model: AnalysisModel): string {
  const parts: string[] = [];
  const area = modal(model.sample.wardGroup);
  const ward = modal(model.sample.ward);
  const shift = modal(model.sample.shift);
  const qual = modal(model.sample.qualification);
  const exp = modal(model.sample.experienceBand);
  const load = modal(model.sample.patientLoadBand);

  if (area) {
    parts.push(`It revealed that ${share(area.percent)} ${area.count} (${pct(area.percent)}%) worked in the `
      + `${area.label.toLowerCase()} service area`
      + (ward ? `, and the ward with the most respondents was the ${ward.label} with ${ward.count} (${pct(ward.percent)}%).` : '.'));
  }
  if (shift) {
    parts.push(`${shift.count} (${pct(shift.percent)}%) of the respondents were on the `
      + `${shift.label.toLowerCase()} shift at the time of the assessment.`);
  }
  if (qual) {
    parts.push(`${share(qual.percent).replace(/^./, c => c.toUpperCase())} ${qual.count} (${pct(qual.percent)}%) held the ${qual.label} qualification.`);
  }
  if (exp) {
    parts.push(`${exp.count} (${pct(exp.percent)}%) had ${exp.label.toLowerCase()} of working experience`
      + (Number.isFinite(model.sample.experience.mean)
        ? ` (mean ${num(model.sample.experience.mean)} years, SD ${num(model.sample.experience.sd)}).`
        : '.'));
  }
  if (load) {
    parts.push(`${load.count} (${pct(load.percent)}%) cared for ${load.label.toLowerCase()} during the shift`
      + (Number.isFinite(model.sample.patientLoad.mean)
        ? ` (mean ${num(model.sample.patientLoad.mean)} patients per nurse).`
        : '.'));
  }

  return `Table 4.1 showed the socio-demographic information of the respondents. ${parts.join(' ')}`;
}

function itemTable(
  caption: string,
  dists: ItemDistribution[],
  labels: Record<number, string>,
  firstNumber: number,
  overall: number[],
  markReversed: boolean,
): ChapterBlock {
  const points = Object.keys(labels).length;
  const criterion = (points + 1) / 2;
  const blank = Array.from({ length: points }, () => cell(''));
  return {
    kind: 'table',
    caption,
    headers: [
      'S/N', 'Variables', ...Array.from({ length: points }, (_, i) => `${labels[i + 1]} n (%)`),
      'Mean', 'SD',
    ],
    rows: [
      ...dists.map((d, index) => [
        cell(firstNumber + index),
        cell(d.item.text + (markReversed && d.item.reversed ? ' *' : '')),
        ...d.counts.map(c => cell(nPct(c, d.answered))),
        cell(num(d.mean, 2)),
        cell(num(d.sd, 2)),
      ]),
      [cell(''), cell(`Grand mean (sum of the ${dists.length} item means ÷ ${dists.length})`, true), ...blank,
        cell(num(mean(overall), 2), true), cell(num(stdDev(overall), 2), true)],
    ],
    note: [
      'Each row totals 100% of the respondents who answered the item. Mean and SD are on the '
        + `1-${points} response scale; criterion mean = (${Array.from({ length: points }, (_, i) => i + 1).join(' + ')}) `
        + `÷ ${points} = ${criterion.toFixed(2)}.`,
      markReversed && dists.some(d => d.item.reversed)
        ? '* Negatively worded item: "Never" is the safe practice, so the item was reverse-scored '
          + '(Never = 4 ... Always = 1) before its mean was computed; a higher mean always indicates better compliance.'
        : '',
    ].filter(Boolean).join(' '),
  };
}

function workloadNarrative(dists: ItemDistribution[]): string[] {
  const paragraphs: string[] = [];

  for (const subscale of WORKLOAD_SUBSCALES) {
    const sentences = dists
      .filter(d => d.item.subscale === subscale)
      .map(d => {
        const high = d.counts[3] + d.counts[4];
        const low = d.counts[0] + d.counts[1];
        return `${nPct(high, d.answered).replace(')', '%)')} of the respondents rated `
          + `"${d.item.text.replace(/\.$/, '')}" as very much or extremely, while `
          + `${nPct(low, d.answered).replace(')', '%)')} rated it not at all or slightly (mean = ${num(d.mean, 2)}).`;
      });
    paragraphs.push(`${subscale}: ${sentences.join(' ')}`);
  }

  const heaviest = [...dists].sort((a, b) =>
    (b.counts[3] + b.counts[4]) / (b.answered || 1) - (a.counts[3] + a.counts[4]) / (a.answered || 1))[0];
  if (heaviest?.answered) {
    const share = ((heaviest.counts[3] + heaviest.counts[4]) / heaviest.answered) * 100;
    paragraphs.push(`Overall, the most burdensome aspect of the shift was "${heaviest.item.text.replace(/\.$/, '')}", `
      + `rated very much or extremely by ${pct(share)}% of the respondents.`);
  }

  paragraphs[0] = `Table 4.2 above showed the responses of the respondents on nursing workload. ${paragraphs[0]}`;
  return paragraphs;
}

function ipcNarrative(dists: ItemDistribution[], tableNumber: string): string[] {
  const paragraphs: string[] = [];

  for (const subscale of IPC_SUBSCALES) {
    const sentences = dists
      .filter(d => d.item.subscale === subscale)
      .map(d => {
        const [never, rarely, sometimes, always] = d.counts;
        const phrase = verbPhrase(d.item.text);
        const subject = phrase ?? `"${d.item.text.replace(/\.$/, '')}"`;
        const p = (c: number) => nPct(c, d.answered).replace(')', '%)');
        const m = ` (mean = ${num(d.mean, 2)})`;
        if (d.item.reversed) {
          return phrase
            ? `${p(never)} of the respondents reported that they never ${subject}, which is the safe practice, `
              + `while ${p(sometimes + always)} reported doing so sometimes or always${m}.`
            : `${p(never)} of the respondents responded never (the safe practice) to ${subject}, `
              + `while ${p(sometimes + always)} responded sometimes or always${m}.`;
        }
        return phrase
          ? `${p(always)} of the respondents reported that they always ${subject}, `
            + `while ${p(never + rarely)} reported doing so rarely or never${m}.`
          : `${p(always)} of the respondents responded always to ${subject}, `
            + `while ${p(never + rarely)} responded rarely or never${m}.`;
      });
    paragraphs.push(`${subscale}: ${sentences.join(' ')}`);
  }

  // The weakest practice is the one with the smallest share giving the safe answer.
  const safeShare = (d: ItemDistribution) =>
    (d.item.reversed ? d.counts[0] : d.counts[3]) / (d.answered || 1);
  const weakest = [...dists].filter(d => d.answered).sort((a, b) => safeShare(a) - safeShare(b))[0];
  if (weakest) {
    paragraphs.push(`The practice with the lowest level of consistent compliance was "${weakest.item.text.replace(/\.$/, '')}", `
      + `where only ${pct(safeShare(weakest) * 100)}% of the respondents gave the safe response.`);
  }

  paragraphs[0] = `Table ${tableNumber} above showed the compliance of the respondents with infection prevention `
    + `and control practices. ${paragraphs[0]}`;
  return paragraphs;
}

function bandSlices(scale: ScaleAnalysis, palette: string[], ranges: LevelRange<string>[]): PieSlice[] {
  return scale.bands.map((b, i) => {
    const range = ranges.find(r => r.label === b.label);
    return {
      label: range ? `${b.label} (${range.min}-${range.max})` : b.label,
      count: b.count, percent: b.percent, color: palette[i % palette.length],
    };
  });
}

/** "12-28 were classified as low, 29-44 as moderate and 45-60 as high" */
function rangeList(ranges: LevelRange<string>[]): string {
  const parts = ranges.map((r, i) =>
    `${r.min}-${r.max}${i === 0 ? ' were classified' : ''} as ${r.label.toLowerCase()}`);
  const last = parts.pop();
  return parts.length ? `${parts.join(', ')} and ${last}` : last ?? '';
}

/** "26 (21.7%) of the respondents had a low level of workload, 34 (28.3%) moderate and …" */
function bandSentence(bands: FrequencyRow[], noun: string): string {
  const present = bands.filter(b => b.count > 0);
  if (!present.length) return `no respondent has been classified by level of ${noun} yet`;
  const [first, ...rest] = present;
  const head = `${first.count} (${pct(first.percent)}%) of the respondents had a `
    + `${first.label.toLowerCase()} level of ${noun}`;
  if (!rest.length) return head;
  const tail = rest.map(b => `${b.count} (${pct(b.percent)}%) ${b.label.toLowerCase()}`);
  const last = tail.pop();
  return tail.length ? `${head}, ${tail.join(', ')} and ${last}` : `${head} and ${last}`;
}

// ── Hypotheses ────────────────────────────────────────────────────────────

const PLAIN_ID: Record<string, string> = { H1: 'H01', H2: 'H02', H3: 'H03' };

function decisionText(h: HypothesisResult, statText: string, relationWord: string): string {
  if (h.decision === 'Not testable') {
    return `This hypothesis could not be tested because fewer records had been submitted than the minimum `
      + 'needed for a reliable test.';
  }
  return h.decision === 'Reject'
    ? `It showed that there was a statistically significant ${relationWord} as the p-value was less than `
      + `0.050 (${statText}). Therefore, the null hypothesis was rejected.`
    : `It showed that there was no statistically significant ${relationWord} as the p-value was greater than `
      + `0.050 (${statText}). Therefore, the null hypothesis was accepted.`;
}

function kruskalTable(caption: string, groupHeader: string, result: KruskalWallisResult): ChapterBlock {
  const statCells = [
    `H = ${num(result.h, 3)}`, `df = ${Number.isFinite(result.df) ? result.df : '-'}`, pText(result.p),
  ];
  return {
    kind: 'table',
    caption,
    headers: [groupHeader, 'n', 'Mean score (%)', 'Mean rank', 'Statistics (H, df, p)'],
    rows: [
      ...result.groups.map((g, i) => [
        cell(g.label), cell(g.n), cell(num(g.mean)), cell(num(g.meanRank)),
        cell(statCells[i] ?? '', i < statCells.length),
      ]),
      [cell('Total', true), cell(result.n, true), cell(''), cell(''),
        cell(statCells.slice(result.groups.length).join(', '), true)],
    ],
  };
}

// ── Entry point ───────────────────────────────────────────────────────────

/** "The overall level … was determined by summing …" — how each respondent was
 *  classified, written out so the reader can redo the computation. */
function workloadComputation(): string {
  const items = WORKLOAD_ITEMS.length;
  const min = WORKLOAD_LEVELS[0].min;
  const max = WORKLOAD_LEVELS[WORKLOAD_LEVELS.length - 1].max;
  const width = (max - min) / WORKLOAD_LEVELS.length;
  return `The overall level of nursing workload was determined by summing each respondent's scores on the `
    + `${items} workload items, giving a possible total of ${min} (${items} × 1) to ${max} (${items} × 5). `
    + `The range (${max} - ${min} = ${max - min}) was divided by the ${WORKLOAD_LEVELS.length} levels to give a `
    + `class interval of ${width}, so totals of ${rangeList(WORKLOAD_LEVELS)} workload.`;
}

function complianceComputation(): string {
  const items = IPC_ITEMS.length;
  const reversed = IPC_ITEMS.filter(i => i.reversed).length;
  const min = COMPLIANCE_LEVELS[0].min;
  const max = COMPLIANCE_LEVELS[COMPLIANCE_LEVELS.length - 1].max;
  const cut = COMPLIANCE_LEVELS[1].min;
  return `The overall level of compliance was determined by summing each respondent's scores on the ${items} `
    + `items, after reverse-scoring the ${reversed} negatively worded items, giving a possible total of ${min} `
    + `(${items} × 1) to ${max} (${items} × 4). The criterion mean of 2.50 [(1 + 2 + 3 + 4) ÷ 4] multiplied by `
    + `the ${items} items gave a cut-off total of ${cut}, so totals of ${rangeList(COMPLIANCE_LEVELS)} compliance.`;
}

// ── Entry point ───────────────────────────────────────────────────────────

export function buildChapterFour(model: AnalysisModel, records: AssessmentRecord[]): ChapterFour {
  const blocks: ChapterBlock[] = [];
  const add = (block: ChapterBlock) => blocks.push(block);
  const para = (text: string) => add({ kind: 'paragraph', text });
  const { workload, ipc } = model;
  const n = model.n;

  const workloadDists = distributions(records, WORKLOAD_ITEMS, 'workloadResponses', 5);
  const ipcDists = distributions(records, IPC_ITEMS, 'ipcResponses', 4);

  add({ kind: 'chapterTitle', lines: ['CHAPTER FOUR', 'DATA ANALYSIS AND RESULTS'] });

  // 4.1 — kept short so Table 4.1 fits whole on the chapter's first page.
  add({ kind: 'heading', text: '4.1 Introduction' });
  para(`Data collected from ${n} respondents were analysed using frequencies, percentages, mean and standard `
    + "deviation, while Spearman's rank-order correlation, the chi-square test of independence and the "
    + `Kruskal-Wallis H test were used to test the hypotheses at ${ALPHA.toFixed(2)} level of significance.`);

  // 4.2
  add({ kind: 'heading', text: '4.2 Socio-demographic Characteristics' });
  add(demographicsTable(model));
  para(demographicsNarrative(model));

  // 4.3
  add({ kind: 'heading', text: '4.3 Nursing Workload among Nurses' });
  add(itemTable('Table 4.2: Nursing Workload of the Respondents', workloadDists, WORKLOAD_LABELS, 1,
    respondentMeans(records, WORKLOAD_ITEMS, 'workloadResponses', 5), false));
  workloadNarrative(workloadDists).forEach(para);

  para(workloadComputation());
  add({
    kind: 'figure',
    caption: 'Fig 4.1: Pie Chart showing the Overall Level of Nursing Workload of the Respondents',
    legendTitle: 'Workload level (total score)',
    slices: bandSlices(workload, model.conclusions[0]?.palette ?? [], WORKLOAD_LEVELS),
  });
  const wlTop = modal(workload.bands);
  para(`Figure 4.1 above showed the overall level of workload of the respondents. It revealed that `
    + `${bandSentence(workload.bands, 'workload')}. `
    + (wlTop ? `This showed that ${share(wlTop.percent)} ${wlTop.count} (${pct(wlTop.percent)}%) experienced a `
      + `${wlTop.label.toLowerCase()} level of workload. ` : '')
    + `The mean total workload score was ${num(workload.rawDescriptives.mean)} (SD = `
    + `${num(workload.rawDescriptives.sd)}) out of a possible ${workload.rawMax}, a mean item score of `
    + `${num(workload.itemMean, 2)} on the 5-point scale.`);

  // 4.4
  add({ kind: 'heading', text: '4.4 Compliance with Infection Prevention and Control Practices' });
  add(itemTable('Table 4.3: Compliance of the Respondents with IPC (Standard Precaution) Practices',
    ipcDists, IPC_LABELS, WORKLOAD_ITEMS.length + 1,
    respondentMeans(records, IPC_ITEMS, 'ipcResponses', 4), true));
  ipcNarrative(ipcDists, '4.3').forEach(para);

  para(complianceComputation());
  add({
    kind: 'figure',
    caption: 'Fig 4.2: Pie Chart showing the Overall Level of IPC Compliance of the Respondents',
    legendTitle: 'Compliance level (total score)',
    slices: bandSlices(ipc, model.conclusions[1]?.palette ?? [], COMPLIANCE_LEVELS),
  });
  const ipcTop = modal(ipc.bands);
  para(`Figure 4.2 above showed the overall level of compliance of the respondents with infection `
    + `prevention and control practices. It revealed that ${bandSentence(ipc.bands, 'compliance')}. `
    + (ipcTop ? `This showed that ${share(ipcTop.percent)} ${ipcTop.count} (${pct(ipcTop.percent)}%) had a `
      + `${ipcTop.label.toLowerCase()} level of compliance. ` : '')
    + `The mean total compliance score was ${num(ipc.rawDescriptives.mean)} (SD = `
    + `${num(ipc.rawDescriptives.sd)}) out of a possible ${ipc.rawMax}, a mean item score of `
    + `${num(ipc.itemMean, 2)} against the criterion mean of 2.50.`);

  // 4.5
  add({ kind: 'heading', text: '4.5 Answering Research Questions' });
  const high = workload.bands.find(b => b.label === 'High');
  add({ kind: 'subheading', text: '1. What is the level of nursing workload among nurses in UNIOSUN Teaching Hospital?' });
  para(`According to figure 4.1 above, which showed the overall level of workload of the respondents, `
    + `${bandSentence(workload.bands, 'workload')}. In all, ${nPct(high?.count ?? 0, n).replace(')', '%)')} of the `
    + 'respondents experienced a high level of workload. '
    + (wlTop ? `The level of nursing workload among nurses in UNIOSUN Teaching Hospital was therefore predominantly ${wlTop.label.toLowerCase()}.` : ''));

  const compliant = ipc.bands.find(b => b.label === 'High');
  add({ kind: 'subheading', text: '2. What is the level of compliance with infection prevention and control practices among nurses in UNIOSUN Teaching Hospital?' });
  para(`According to figure 4.2 above, which showed the overall level of compliance of the respondents, `
    + `${bandSentence(ipc.bands, 'compliance')}. In all, ${nPct(compliant?.count ?? 0, n).replace(')', '%)')} of the `
    + 'respondents had a high level of compliance. '
    + (ipcTop ? `The level of compliance with IPC practices among nurses in UNIOSUN Teaching Hospital was therefore predominantly ${ipcTop.label.toLowerCase()}.` : ''));

  // 4.6
  add({ kind: 'heading', text: '4.6 Hypothesis Testing' });
  let tableNo = 4;
  const nextTable = () => `Table 4.${tableNo++}`;

  for (const h of model.hypotheses) {
    add({ kind: 'subheading', text: `${PLAIN_ID[h.id] ?? h.id}: ${h.nullHypothesis}` });

    if (h.id === 'H1') {
      const s = model.association.spearman;
      const t = nextTable();
      add({
        kind: 'table',
        caption: `${t}: Relationship between Nursing Workload and Compliance with IPC Practices`,
        headers: ['Variables', 'N', "Spearman's rho (rs)", 'p-value', 'Decision'],
        rows: [[
          cell('Nursing workload score vs IPC compliance score'), cell(s.n), cell(num(s.coefficient, 3)),
          cell(pText(s.p).replace('p ', '').replace('= ', ''), true),
          cell(h.decision === 'Reject' ? 'Rejected' : h.decision === 'Retain' ? 'Accepted' : 'Not testable', true),
        ]],
      });
      const strength = interpretCorrelation(s.coefficient);
      para(`${t} showed the relationship between nursing workload and compliance with infection prevention and `
        + `control practices among the respondents. ${decisionText(h, `rs = ${num(s.coefficient, 3)}, ${pText(s.p)}`,
          'relationship between nursing workload and compliance with IPC practices')}`
        + (h.decision === 'Reject'
          ? ` The relationship was ${strength}, meaning that compliance with IPC practices `
            + `${s.coefficient < 0 ? 'decreased' : 'increased'} as nursing workload increased.`
          : ''));
    } else if (h.id === 'H2') {
      const ct = model.crossTab;
      const t = nextTable();
      const statCells = [`X² = ${num(ct.chiSquare, 3)}`, `df = ${Number.isFinite(ct.df) ? ct.df : '-'}`, pText(ct.p)];
      const colTotals = ct.colLabels.map((_, j) => ct.observed.reduce((s, r) => s + r[j], 0));
      add({
        kind: 'table',
        caption: `${t}: Association between Level of Nursing Workload and Level of IPC Compliance`,
        headers: ['Level of workload', ...ct.colLabels.map(l => `${l} compliance n (%)`), 'Total', 'Statistics (X², df, p)'],
        rows: [
          ...ct.observed.map((row, i) => {
            const rowTotal = row.reduce((a, b) => a + b, 0);
            return [
              cell(ct.rowLabels[i]), ...row.map(v => cell(nPct(v, rowTotal))), cell(rowTotal),
              cell(statCells[i] ?? '', true),
            ];
          }),
          [cell('Total', true), ...colTotals.map(v => cell(nPct(v, ct.n), true)), cell(ct.n, true),
            cell(ct.observed.length < 3 ? statCells.slice(ct.observed.length).join(', ') : '', true)],
        ],
        note: ct.expectedCountWarning
          ? 'More than 20% of the cells had an expected count below 5, so the chi-square result should be interpreted with caution.'
          : undefined,
      });
      para(`${t} showed the association between the level of nursing workload and the level of compliance with `
        + `IPC practices among the respondents. ${decisionText(h, `X² = ${num(ct.chiSquare, 3)}, ${pText(ct.p)}`,
          'association between the level of workload and the level of IPC compliance')}`);
    } else {
      const t = nextTable();
      const area = model.ipcByArea;
      const areas = area.unit === 'service area' ? 'service areas' : 'wards / units';
      add(kruskalTable(`${t}: Difference in IPC Compliance across ${area.unit === 'service area' ? 'Service Areas' : 'Wards / Units'}`,
        area.unit === 'service area' ? 'Service area' : 'Ward / unit', area.result));
      para(`${t} showed the difference in compliance with IPC practices across the ${areas} of the hospital. `
        + decisionText(h, `H = ${num(h.statistic, 3)}, ${pText(h.p)}`,
          `difference in compliance with IPC practices across the ${areas}`));
    }
  }

  // Reliability belongs with the appendices at the end of the project, not in
  // the results chapter; it follows on a fresh page so it can be moved there.
  add({ kind: 'pageBreak' });
  add({ kind: 'chapterTitle', lines: ['APPENDIX', 'RELIABILITY OF THE INSTRUMENTS'] });
  add({
    kind: 'table',
    caption: "Table A1: Internal Consistency (Cronbach's Alpha) of the Instruments",
    headers: ['Instrument / subscale', 'No. of items', "Cronbach's alpha", 'Interpretation'],
    rows: [
      [cell('Nursing workload scale', true), cell(WORKLOAD_ITEMS.length), cell(num(workload.alpha, 3)), cell(workload.alphaVerdict)],
      ...workload.subscales.map(s => [cell(`   ${s.name}`), cell(s.itemCount), cell(num(s.alpha, 3)), cell('')]),
      [cell('IPC compliance scale (CSPS)', true), cell(IPC_ITEMS.length), cell(num(ipc.alpha, 3)), cell(ipc.alphaVerdict)],
      ...ipc.subscales.map(s => [cell(`   ${s.name}`), cell(s.itemCount), cell(num(s.alpha, 3)), cell('')]),
    ],
  });
  para(Number.isFinite(workload.alpha) && Number.isFinite(ipc.alpha)
    ? `The workload scale yielded a Cronbach's alpha of ${num(workload.alpha, 3)} (${workload.alphaVerdict.toLowerCase()}) `
      + `and the IPC compliance scale yielded ${num(ipc.alpha, 3)} (${ipc.alphaVerdict.toLowerCase()}), `
      + 'indicating the internal consistency of the instruments among the respondents of this study.'
    : `Cronbach's alpha is reported once at least ${model.minimumN} complete records have been submitted.`);

  return { title: 'Chapter Four - Data Analysis and Results', n, blocks };
}
