import type { AssessmentRecord } from '../types';

// Single-participant report. Aggregate exports live in utils/report.ts.

export function exportSinglePDF(record: AssessmentRecord): void {
  // Build a printable HTML page and open print dialog
  const html = buildParticipantReportHTML(record);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function buildParticipantReportHTML(r: AssessmentRecord): string {
  const wCat = r.workloadCategory;
  const iCat = r.ipcCategory;

  const wColor = { Low: '#16a34a', Moderate: '#ca8a04', High: '#ea580c', 'Very High': '#dc2626' }[wCat];
  const iColor = { Optimal: '#16a34a', Satisfactory: '#2563eb', Suboptimal: '#ca8a04', Poor: '#dc2626' }[iCat];

  const subscoreRows = (obj: Record<string, number>) =>
    Object.entries(obj)
      .map(([k, v]) => `<tr><td style="padding:4px 8px;">${k}</td><td style="padding:4px 8px;font-weight:600;">${v}%</td></tr>`)
      .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Assessment Report – ${r.demographics.nurseCode}</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#1f2937;font-size:13px}
  h1{color:#1e3a8a;font-size:18px;margin-bottom:4px}
  h2{color:#374151;font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-top:20px}
  table{border-collapse:collapse;width:100%;margin-top:8px}
  td,th{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}
  th{background:#f3f4f6;font-weight:600}
  .badge{display:inline-block;padding:3px 10px;border-radius:4px;color:#fff;font-weight:bold}
  .score{font-size:28px;font-weight:bold}
</style></head><body>
<h1>UNIOSUNTH Nursing Research Tool</h1>
<p style="color:#6b7280;font-size:11px">Generated: ${new Date().toLocaleString()} | Record ID: ${r.id}</p>

<h2>Participant Information</h2>
<table><tr><th>Field</th><th>Value</th></tr>
<tr><td>Nurse Code</td><td>${r.demographics.nurseCode}</td></tr>
<tr><td>Ward</td><td>${r.demographics.ward}</td></tr>
<tr><td>Shift</td><td>${r.demographics.shift}</td></tr>
<tr><td>Qualification</td><td>${r.demographics.qualification}</td></tr>
<tr><td>Years of Experience</td><td>${r.demographics.yearsExperience}</td></tr>
<tr><td>Patient Load</td><td>${r.demographics.patientLoad}</td></tr>
<tr><td>Assessment Date</td><td>${r.timestamp}</td></tr>
</table>

<h2>Results Summary</h2>
<table><tr><th>Scale</th><th>Score</th><th>Category</th></tr>
<tr>
  <td>Nursing Workload</td>
  <td><span class="score" style="color:${wColor}">${r.workloadScore}%</span></td>
  <td><span class="badge" style="background:${wColor}">${wCat}</span></td>
</tr>
<tr>
  <td>IPC Compliance (CSPS)</td>
  <td><span class="score" style="color:${iColor}">${r.ipcScore}%</span></td>
  <td><span class="badge" style="background:${iColor}">${iCat}</span></td>
</tr>
</table>

<h2>Workload Subscores</h2>
<table><tr><th>Subscale</th><th>Score</th></tr>${subscoreRows(r.subscoreWorkload)}</table>

<h2>IPC Compliance Subscores</h2>
<table><tr><th>Subscale</th><th>Score</th></tr>${subscoreRows(r.subscoreIPC)}</table>

<p style="margin-top:30px;color:#9ca3af;font-size:10px">
UNIOSUNTH Medical Wards Research Study • Workload-IPC Compliance Assessment Tool<br>
CSPS adapted from Lam (2004). Workload scale adapted from NAS & NASA-TLX for medical wards.
</p>
</body></html>`;
}
