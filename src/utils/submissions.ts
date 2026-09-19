import type { AssessmentRecord, ScaleItem } from '../types';
import { WORKLOAD_ITEMS, WORKLOAD_LABELS } from '../data/workloadItems';
import { IPC_ITEMS, IPC_LABELS } from '../data/ipcItems';

// ── Printable submissions register ────────────────────────────────────────
// The coordinator needs a paper trail of what was collected: a roster of every
// submission, and optionally each participant's item-level answers so a
// returned questionnaire can be checked against the stored record.
//
// Printing goes through a plain HTML document in a new window rather than the
// on-screen table, matching how utils/export.ts and utils/report.ts already
// print. The screen view is built for phones on the ward, and its cards,
// sticky header and bottom tab bar do not survive a print stylesheet cleanly.

const WORKLOAD_COLOR: Record<string, string> = {
  Low: '#16a34a', Moderate: '#ca8a04', High: '#ea580c', 'Very High': '#dc2626',
};
const IPC_COLOR: Record<string, string> = {
  Optimal: '#16a34a', Satisfactory: '#2563eb', Suboptimal: '#ca8a04', Poor: '#dc2626',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? esc(value) : esc(d.toLocaleString());
}

function rosterRows(records: AssessmentRecord[]): string {
  return records.map((r, i) => [
    '<tr' + (r.excluded ? ' class="excluded"' : '') + '>',
    '<td>' + (i + 1) + '</td>',
    '<td class="mono">' + esc(r.demographics.nurseCode) + '</td>',
    '<td>' + esc(r.demographics.ward) + '</td>',
    '<td>' + esc(r.demographics.shift) + '</td>',
    '<td>' + esc(r.demographics.qualification) + '</td>',
    '<td>' + esc(r.demographics.yearsExperience) + '</td>',
    '<td>' + esc(r.demographics.patientLoad) + '</td>',
    '<td class="num">' + esc(r.workloadScore) + '%</td>',
    '<td style="color:' + (WORKLOAD_COLOR[r.workloadCategory] ?? '#374151')
      + ';font-weight:600">' + esc(r.workloadCategory) + '</td>',
    '<td class="num">' + esc(r.ipcScore) + '%</td>',
    '<td style="color:' + (IPC_COLOR[r.ipcCategory] ?? '#374151')
      + ';font-weight:600">' + esc(r.ipcCategory) + '</td>',
    '<td>' + shortDate(r.timestamp) + '</td>',
    '<td>' + (r.excluded ? 'Excluded' : 'Included') + '</td>',
    '</tr>',
  ].join('')).join('');
}

function responseTable(
  items: ScaleItem[],
  labels: Record<number, string>,
  answers: Record<number, number>,
  prefix: string,
): string {
  const rows = items.map(item => {
    const value = answers?.[item.id];
    const label = value == null ? '—' : esc(value) + ' · ' + esc(labels[value] ?? '');
    return '<tr>'
      + '<td class="mono">' + prefix + item.id + '</td>'
      + '<td>' + esc(item.text)
      + (item.reversed ? ' <span class="rev">(reverse scored)</span>' : '') + '</td>'
      + '<td>' + label + '</td>'
      + '</tr>';
  }).join('');

  return '<table class="items"><thead><tr>'
    + '<th style="width:44px">Item</th><th>Statement</th>'
    + '<th style="width:150px">Response</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function subscoreList(scores: Record<string, number>): string {
  const entries = Object.entries(scores ?? {});
  if (!entries.length) return '<p class="muted">No subscale scores recorded.</p>';
  return '<ul class="subscores">'
    + entries.map(([k, v]) =>
        '<li><span>' + esc(k) + '</span><strong>' + esc(v) + '%</strong></li>').join('')
    + '</ul>';
}

function detailBlock(r: AssessmentRecord, index: number): string {
  const wColor = WORKLOAD_COLOR[r.workloadCategory] ?? '#374151';
  const iColor = IPC_COLOR[r.ipcCategory] ?? '#374151';

  return '<section class="participant">'
    + '<h2>' + (index + 1) + '. ' + esc(r.demographics.nurseCode)
    + (r.excluded ? ' <span class="flag">EXCLUDED</span>' : '') + '</h2>'
    + '<table class="meta">'
    + '<tr><th>Ward</th><td>' + esc(r.demographics.ward) + '</td>'
    + '<th>Shift</th><td>' + esc(r.demographics.shift) + '</td></tr>'
    + '<tr><th>Qualification</th><td>' + esc(r.demographics.qualification) + '</td>'
    + '<th>Experience</th><td>' + esc(r.demographics.yearsExperience) + '</td></tr>'
    + '<tr><th>Patients this shift</th><td>' + esc(r.demographics.patientLoad) + '</td>'
    + '<th>Submitted</th><td>' + shortDate(r.timestamp) + '</td></tr>'
    + '<tr><th>Workload score</th>'
    + '<td style="color:' + wColor + ';font-weight:700">'
    + esc(r.workloadScore) + '% (' + esc(r.workloadCategory) + ')</td>'
    + '<th>IPC score</th>'
    + '<td style="color:' + iColor + ';font-weight:700">'
    + esc(r.ipcScore) + '% (' + esc(r.ipcCategory) + ')</td></tr>'
    + '</table>'
    + '<h3>Workload subscales</h3>' + subscoreList(r.subscoreWorkload)
    + '<h3>IPC subscales</h3>' + subscoreList(r.subscoreIPC)
    + '<h3>Nursing Workload Scale</h3>'
    + responseTable(WORKLOAD_ITEMS, WORKLOAD_LABELS, r.workloadResponses, 'WL')
    + '<h3>IPC Compliance Scale</h3>'
    + responseTable(IPC_ITEMS, IPC_LABELS, r.ipcResponses, 'IPC')
    + '</section>';
}

const PRINT_STYLES = [
  '@page { size: A4 landscape; margin: 14mm; }',
  'body { font-family: Arial, Helvetica, sans-serif; color:#1f2937; font-size:11px; margin:0; }',
  'h1 { color:#1e3a8a; font-size:18px; margin:0 0 2px; }',
  '.sub { color:#6b7280; font-size:11px; margin-bottom:14px; }',
  '.counts { margin:10px 0 16px; font-size:11px; }',
  '.counts strong { font-size:15px; color:#1e3a8a; }',
  'table { border-collapse:collapse; width:100%; }',
  'th, td { border:1px solid #d1d5db; padding:4px 6px; text-align:left; vertical-align:top; }',
  'thead th { background:#eff6ff; color:#1e3a8a; font-weight:700; }',
  'tbody tr:nth-child(even) { background:#f9fafb; }',
  '.num { text-align:right; font-variant-numeric:tabular-nums; }',
  '.mono { font-family:"Courier New",monospace; }',
  'tr.excluded td { color:#9ca3af; text-decoration:line-through; }',
  '.muted { color:#9ca3af; font-style:italic; }',
  '.participant { page-break-before:always; break-before:page; }',
  '.participant h2 { color:#1e3a8a; font-size:15px; border-bottom:2px solid #1e3a8a;',
  '                  padding-bottom:3px; margin:0 0 10px; }',
  '.participant h3 { font-size:12px; color:#374151; margin:14px 0 5px;',
  '                  text-transform:uppercase; letter-spacing:.04em; }',
  '.flag { background:#dc2626; color:#fff; font-size:9px; padding:2px 6px;',
  '        border-radius:3px; vertical-align:middle; }',
  'table.meta th { background:#f3f4f6; width:110px; }',
  'table.items thead th { background:#f3f4f6; color:#374151; }',
  '.rev { color:#9ca3af; font-size:10px; }',
  'ul.subscores { list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:6px; }',
  'ul.subscores li { border:1px solid #e5e7eb; border-radius:4px; padding:3px 8px; background:#f9fafb; }',
  'ul.subscores li span { color:#6b7280; margin-right:6px; }',
].join('\n');

const ROSTER_HEAD = '<thead><tr>'
  + '<th>#</th><th>Nurse code</th><th>Ward</th><th>Shift</th><th>Qual.</th>'
  + '<th>Exp.</th><th>Patients</th><th>Workload</th><th>Band</th>'
  + '<th>IPC</th><th>Band</th><th>Submitted</th><th>Status</th>'
  + '</tr></thead>';

export function buildSubmissionsHTML(
  records: AssessmentRecord[],
  options: { includeDetail: boolean },
): string {
  const included = records.filter(r => !r.excluded).length;
  const generated = new Date().toLocaleString();

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>UNIOSUNTH Submissions Register</title>'
    + '<style>' + PRINT_STYLES + '</style></head><body>'
    + '<h1>UNIOSUNTH Nursing Research Tool</h1>'
    + '<div class="sub">Submissions register &middot; generated ' + esc(generated) + '</div>'
    + '<div class="counts">'
    + 'Total submissions: <strong>' + records.length + '</strong> &nbsp;&middot;&nbsp; '
    + 'Included in analysis: <strong>' + included + '</strong> &nbsp;&middot;&nbsp; '
    + 'Excluded: <strong>' + (records.length - included) + '</strong>'
    + '</div>'
    + '<table>' + ROSTER_HEAD + '<tbody>' + rosterRows(records) + '</tbody></table>'
    + (options.includeDetail ? records.map(detailBlock).join('') : '')
    + '</body></html>';
}

/**
 * Opens the register in a new window and triggers the print dialog.
 * Returns false when the browser blocked the popup, so the caller can say so.
 */
export function printSubmissions(
  records: AssessmentRecord[],
  options: { includeDetail: boolean },
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildSubmissionsHTML(records, options));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
  return true;
}
