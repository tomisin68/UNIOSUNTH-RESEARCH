import type { ChapterBlock, ChapterFour, PieSlice } from './chapterFour';
import { downloadFile, stamp } from './download';

// ── Exporters for Chapter Four ────────────────────────────────────────────
// Each exporter walks the same block list. The Word and PDF libraries are
// loaded on demand so they do not weigh down the assessment screens, which
// nurses open on phones over ward Wi-Fi.

const FILE_BASE = () => `UNIOSUNTH_Chapter_Four_${stamp()}`;

// ── Pie chart, drawn once as a PNG for Word and PDF ───────────────────────

const PIE_W = 900;
const PIE_H = 520;

/** Pie with count and percentage on every slice and a legend, in the layout
 *  the template's SPSS charts use. Meaning never rests on colour alone. */
export function renderPiePNG(slices: PieSlice[], legendTitle: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = PIE_W;
  canvas.height = PIE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PIE_W, PIE_H);

  const cx = 300;
  const cy = PIE_H / 2;
  const r = 210;
  const total = slices.reduce((s, x) => s + x.count, 0);

  if (!total) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Times New Roman, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No responses yet', cx, cy);
  } else {
    let angle = -Math.PI / 2;
    const labels: { x: number; y: number; text: string[]; inside: boolean }[] = [];

    for (const slice of slices) {
      if (!slice.count) continue;
      const sweep = (slice.count / total) * Math.PI * 2;
      // A single slice holding every response is a whole disc; an arc that ends where it
      // starts draws nothing on some canvases, so draw the circle outright.
      const whole = slice.count === total;
      ctx.beginPath();
      if (whole) {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else {
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + sweep);
      }
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      const mid = angle + sweep / 2;
      const inside = sweep > 0.45;
      const dist = whole ? 0 : inside ? r * 0.62 : r + 34;
      labels.push({
        x: cx + Math.cos(mid) * dist,
        y: cy + Math.sin(mid) * dist,
        text: [`${slice.percent.toFixed(1)}%`, String(slice.count)],
        inside,
      });
      angle += sweep;
    }

    // Labels are drawn in boxes after every slice, so none is painted over.
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of labels) {
      const w = Math.max(...l.text.map(t => ctx.measureText(t).width)) + 16;
      const h = 52;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.fillRect(l.x - w / 2, l.y - h / 2, w, h);
      ctx.strokeRect(l.x - w / 2, l.y - h / 2, w, h);
      ctx.fillStyle = '#111827';
      ctx.fillText(l.text[0], l.x, l.y - 11);
      ctx.fillText(l.text[1], l.x, l.y + 13);
    }
  }

  // Legend
  const lx = 600;
  let ly = 150;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px Arial, sans-serif';
  // A title wider than the legend column breaks before its bracket, so none of it is cut off.
  const titleLines = ctx.measureText(legendTitle).width > PIE_W - lx - 12 && legendTitle.includes(' (')
    ? [legendTitle.slice(0, legendTitle.indexOf(' (')), legendTitle.slice(legendTitle.indexOf(' (') + 1)]
    : [legendTitle];
  for (const line of titleLines) {
    ctx.fillText(line, lx, ly);
    ly += 28;
  }
  ly += 12;
  ctx.font = '20px Arial, sans-serif';
  for (const slice of slices) {
    ctx.fillStyle = slice.color;
    ctx.fillRect(lx, ly - 11, 22, 22);
    ctx.fillStyle = '#111827';
    ctx.fillText(`${slice.label} (${slice.count})`, lx + 34, ly);
    ly += 36;
  }

  return canvas.toDataURL('image/png');
}

/** Column widths as fractions of the table width, from how much text each
 *  column holds, so statements get room and "19 (15.8)" columns stay even. */
function columnFractions(block: Extract<ChapterBlock, { kind: 'table' }>): number[] {
  const weights = block.headers.map((header, col) => {
    const lengths = block.rows.map(r => r[col]?.text.length ?? 0);
    const average = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
    const longestWord = Math.max(...header.split(/\s+/).map(w => w.length));
    // Headers are bold and padded, so a header word needs a little more room than its letters.
    return Math.min(34, Math.max(4, average, longestWord + 6));
  });
  // Response columns ("19 (15.8)") share one width, as in the template.
  const isCount = block.headers.map((_, col) =>
    block.rows.length > 0 && block.rows.every(r => /^\d+ \(\d/.test(r[col]?.text ?? '')));
  const countWidth = Math.max(0, ...weights.filter((_, i) => isCount[i]));
  const even = weights.map((w, i) => (isCount[i] ? countWidth : w));
  const total = even.reduce((a, b) => a + b, 0);
  return even.map(w => w / total);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Word (.docx) ──────────────────────────────────────────────────────────

export async function downloadChapterDocx(chapter: ChapterFour): Promise<void> {
  saveBlob(`${FILE_BASE()}.docx`, await buildChapterDocx(chapter));
}

/** The chapter as a .docx Blob; separate from the download so page fit can be checked. */
export async function buildChapterDocx(chapter: ChapterFour): Promise<Blob> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, PageBreak,
    AlignmentType, WidthType, BorderStyle, LineRuleType,
  } = await import('docx');

  const FONT = 'Times New Roman';
  const body = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text, font: FONT, size: opts.size ?? 24, bold: opts.bold });

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borders = { top: border, bottom: border, left: border, right: border };

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  const toTable = (block: Extract<ChapterBlock, { kind: 'table' }>) => {
    const cellPara = (text: string, bold: boolean) => new Paragraph({
      spacing: block.compact
        ? { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO }
        : { before: 40, after: 40, line: 276, lineRule: LineRuleType.AUTO },
      // The paragraph mark gets the cell's size too, or an empty cell is as tall as 12pt text.
      run: { font: FONT, size: block.compact ? 18 : 22 },
      children: [body(text, { bold, size: block.compact ? 18 : 22 })],
    });
    const group = block.headerGroup;
    const inGroup = (i: number) => !!group && i >= group.start && i < group.start + group.span;
    const headerRows = group
      ? [
        new TableRow({
          tableHeader: true,
          children: block.headers.flatMap((h, i) => {
            if (i === group.start) {
              return [new TableCell({ borders, columnSpan: group.span, children: [cellPara(group.label, true)] })];
            }
            return inGroup(i) ? [] : [new TableCell({ borders, rowSpan: 2, children: [cellPara(h, true)] })];
          }),
        }),
        new TableRow({
          tableHeader: true,
          children: block.headers.filter((_, i) => inGroup(i))
            .map(h => new TableCell({ borders, children: [cellPara(h, true)] })),
        }),
      ]
      : [new TableRow({
        tableHeader: true,
        children: block.headers.map(h => new TableCell({ borders, children: [cellPara(h, true)] })),
      })];
    const rows = block.rows.map(row => new TableRow({
      cantSplit: true,
      children: row.map(c => new TableCell({ borders, children: [cellPara(c.text, !!c.bold)] })),
    }));
    const TABLE_TWIPS = 9026; // A4 width less two 1-inch margins
    return new Table({
      width: { size: TABLE_TWIPS, type: WidthType.DXA },
      ...(block.compact ? { margins: { top: 0, bottom: 0, left: 80, right: 80 } } : {}),
      columnWidths: columnFractions(block).map(f => Math.round(f * TABLE_TWIPS)),
      rows: [...headerRows, ...rows],
    });
  };

  for (const block of chapter.blocks) {
    switch (block.kind) {
      case 'chapterTitle':
        block.lines.forEach((line, i) => children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: i === 0 ? 0 : 120, after: 240 },
          children: [body(line, { bold: true })],
        })));
        break;
      case 'heading':
        children.push(new Paragraph({
          spacing: { before: 240, after: 120 },
          keepNext: true,
          children: [body(block.text, { bold: true })],
        }));
        break;
      case 'subheading':
        children.push(new Paragraph({
          spacing: { before: 200, after: 120, line: 360 },
          keepNext: true,
          children: [body(block.text, { bold: true })],
        }));
        break;
      case 'paragraph':
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 360 },
          children: [body(block.text)],
        }));
        break;
      case 'table':
        children.push(new Paragraph({
          spacing: { before: 200, after: 120 },
          keepNext: true,
          children: [body(block.caption, { bold: true })],
        }));
        children.push(toTable(block));
        if (block.note) {
          children.push(new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [new TextRun({ text: block.note, font: FONT, size: 20, italics: true })],
          }));
        }
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case 'pageBreak':
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'figure': {
        const png = renderPiePNG(block.slices, block.legendTitle);
        if (png) {
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            keepNext: true,
            children: [new ImageRun({
              type: 'png',
              data: dataUrlToBytes(png),
              transformation: { width: 540, height: Math.round(540 * PIE_H / PIE_W) },
            })],
          }));
        }
        children.push(new Paragraph({
          spacing: { before: 120, after: 200 },
          children: [body(block.caption, { bold: true })],
        }));
        break;
      }
    }
  }

  const doc = new Document({
    creator: 'UNIOSUNTH research study',
    title: chapter.title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

// ── PDF ───────────────────────────────────────────────────────────────────

/** jsPDF's built-in Times font is WinAnsi; anything outside it prints as junk. */
function pdfSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[^\x00-\xFF–—…€]/g, '');
}

/** Header rows for autoTable, with the optional grouped heading above its columns. */
function pdfHead(block: Extract<ChapterBlock, { kind: 'table' }>) {
  const group = block.headerGroup;
  if (!group) return [block.headers.map(pdfSafe)];
  const end = group.start + group.span;
  return [
    block.headers.flatMap((h, i): Record<string, unknown>[] => {
      if (i === group.start) return [{ content: pdfSafe(group.label), colSpan: group.span, styles: { halign: 'center' } }];
      return i > group.start && i < end ? [] : [{ content: pdfSafe(h), rowSpan: 2 }];
    }),
    block.headers.slice(group.start, end).map(pdfSafe),
  ];
}

export async function downloadChapterPdf(chapter: ChapterFour): Promise<void> {
  (await buildChapterPdf(chapter)).save(`${FILE_BASE()}.pdf`);
}

export async function buildChapterPdf(chapter: ChapterFour) {
  const [{ jsPDF }, { applyPlugin }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ]);
  // applyPlugin is exported identically by the ESM and CommonJS builds, unlike
  // the default export, so the same code works in the app and under Node.
  applyPlugin(jsPDF);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const autoTable = (options: Record<string, unknown>) =>
    (doc as unknown as { autoTable: (o: Record<string, unknown>) => void }).autoTable(options);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 25;
  const width = pageW - margin * 2;
  const LINE = 7; // 12pt at 1.5 spacing
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const write = (text: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'justify'; lineH?: number } = {}) => {
    doc.setFont('times', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 12);
    const lineH = opts.lineH ?? LINE;
    const lines: string[] = doc.splitTextToSize(pdfSafe(text), width);
    lines.forEach((line, i) => {
      ensure(lineH);
      const last = i === lines.length - 1;
      if (opts.align === 'center') {
        doc.text(line, pageW / 2, y, { align: 'center' });
      } else if (opts.align === 'justify' && !last) {
        doc.text(line, margin, y, { align: 'justify', maxWidth: width });
      } else {
        doc.text(line, margin, y);
      }
      y += lineH;
    });
  };

  for (const block of chapter.blocks) {
    switch (block.kind) {
      case 'chapterTitle':
        block.lines.forEach(line => { write(line, { bold: true, align: 'center' }); y += 2; });
        y += 4;
        break;
      case 'heading':
        // A section heading is followed by a caption and table or a paragraph;
        // keep room for some of it so the heading never ends a page alone.
        ensure(LINE * 7);
        y += 3;
        write(block.text, { bold: true });
        break;
      case 'subheading':
        ensure(LINE * 3);
        y += 2;
        write(block.text, { bold: true });
        break;
      case 'paragraph':
        write(block.text, { align: 'justify' });
        y += 2;
        break;
      case 'table':
        ensure(LINE * 4);
        y += 2;
        write(block.caption, { bold: true });
        autoTable({
          startY: y - 3,
          margin: { left: margin, right: margin },
          head: pdfHead(block),
          body: block.rows.map(row => row.map(c => ({
            content: pdfSafe(c.text),
            styles: { fontStyle: c.bold ? 'bold' : 'normal' },
          }))),
          theme: 'grid',
          styles: {
            font: 'times', fontSize: block.compact ? 7.5 : 10, textColor: 20, lineColor: 0, lineWidth: 0.2,
            cellPadding: block.compact ? { top: 0.3, bottom: 0.3, left: 1.2, right: 1.2 } : 1.6, valign: 'top',
          },
          headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
          rowPageBreak: 'avoid',
          columnStyles: Object.fromEntries(
            columnFractions(block).map((f, i) => [i, { cellWidth: f * width }]),
          ),
        });
        // autoTable records where it finished on the document instance.
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
        if (block.note) write(block.note, { size: 10, lineH: 5 });
        y += 3;
        break;
      case 'figure': {
        const png = renderPiePNG(block.slices, block.legendTitle);
        const imgW = width * 0.9;
        const imgH = imgW * PIE_H / PIE_W;
        ensure(imgH + LINE * 2);
        if (png) doc.addImage(png, 'PNG', margin + (width - imgW) / 2, y, imgW, imgH);
        y += imgH + 4;
        write(block.caption, { bold: true });
        y += 2;
        break;
      }
      case 'pageBreak':
        doc.addPage();
        y = margin;
        break;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(String(i), pageW / 2, pageH - 12, { align: 'center' });
  }

  return doc;
}

// ── HTML (opens in a browser or Word, prints cleanly) ─────────────────────

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlHead(block: Extract<ChapterBlock, { kind: 'table' }>): string {
  const group = block.headerGroup;
  if (!group) return `<tr>${block.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const end = group.start + group.span;
  const top = block.headers.map((h, i) => {
    if (i === group.start) return `<th colspan="${group.span}" class="group">${esc(group.label)}</th>`;
    return i > group.start && i < end ? '' : `<th rowspan="2">${esc(h)}</th>`;
  }).join('');
  return `<tr>${top}</tr><tr>${block.headers.slice(group.start, end).map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
}

export function buildChapterHTML(chapter: ChapterFour): string {
  const parts = chapter.blocks.map(block => {
    switch (block.kind) {
      case 'chapterTitle':
        return block.lines.map(l => `<p class="chapter">${esc(l)}</p>`).join('');
      case 'heading':
        return `<h2>${esc(block.text)}</h2>`;
      case 'subheading':
        return `<h3>${esc(block.text)}</h3>`;
      case 'paragraph':
        return `<p>${esc(block.text)}</p>`;
      case 'table':
        return `<p class="caption">${esc(block.caption)}</p><table${block.compact ? ' class="compact"' : ''}><thead>${
          htmlHead(block)
        }</thead><tbody>${
          block.rows.map(r => `<tr>${r.map(c => `<td${c.bold ? ' class="b"' : ''}>${esc(c.text)}</td>`).join('')}</tr>`).join('')
        }</tbody></table>${block.note ? `<p class="note">${esc(block.note)}</p>` : ''}`;
      case 'figure': {
        const png = renderPiePNG(block.slices, block.legendTitle);
        return `<figure>${png ? `<img src="${png}" alt="${esc(block.caption)}">` : ''}`
          + `<figcaption>${esc(block.caption)}</figcaption></figure>`;
      }
      case 'pageBreak':
        return '<hr class="page-break">';
    }
  });

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(chapter.title)}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5;
         color: #000; background: #fff; max-width: 820px; margin: 0 auto; padding: 32px 24px 64px; }
  .chapter { text-align: center; font-weight: bold; margin: 0 0 14px; }
  h2 { font-size: 12pt; margin: 22px 0 8px; }
  h3 { font-size: 12pt; margin: 16px 0 8px; }
  p { text-align: justify; margin: 0 0 12px; }
  .caption { font-weight: bold; text-align: left; margin: 18px 0 6px; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 12px; font-size: 11pt; line-height: 1.3; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
  th, td.b { font-weight: bold; }
  th.group { text-align: center; }
  table.compact { font-size: 8pt; line-height: 1.1; }
  table.compact th, table.compact td { padding: 1px 5px; }
  .note { font-size: 10pt; font-style: italic; }
  .page-break { border: 0; border-top: 1px dashed #999; margin: 40px 0; page-break-after: always; }
  figure { margin: 18px 0; text-align: center; page-break-inside: avoid; }
  figure img { max-width: 100%; }
  figcaption { font-weight: bold; text-align: left; margin-top: 8px; }
  @media print { body { padding: 0; max-width: none; } .page-break { border: 0; margin: 0; } h2, h3, .caption { page-break-after: avoid; }
                 tr { page-break-inside: avoid; } }
</style></head>
<body>
${parts.join('\n')}
</body></html>`;
}

export function downloadChapterHTML(chapter: ChapterFour): void {
  downloadFile(`${FILE_BASE()}.html`, buildChapterHTML(chapter), 'text/html');
}
