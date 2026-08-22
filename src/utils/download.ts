/** Saves text content to the user's device as a file. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has started the download first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`)
    .join(',');
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  // The BOM makes Excel open UTF-8 exports without mangling accents.
  return '\uFEFF' + rows.map(csvRow).join('\r\n');
}

export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
