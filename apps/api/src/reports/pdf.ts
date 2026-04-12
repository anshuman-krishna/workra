import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import type { ReportResponse } from '@workra/shared';

// server-side pdf renderer. layout is intentionally plain — a client will want to
// read this, not admire it. the goal is credibility: clear header, clean totals,
// session list with intent + summary, tasks completed. no colors, no logos.
//
// returns a readable stream so the controller can pipe it to the response without
// buffering the whole document in memory.
//
// pagination strategy:
// - `bufferPages: true` lets us stamp "page n of m" after content is laid out.
// - `ensureSpace(doc, minHeight)` forces a page break before a block that would
//   otherwise be orphaned near the bottom margin.
// - every section header is guarded so it never renders alone at the end of a page.
export function renderReportPdf(report: ReportResponse): NodeJS.ReadableStream {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 56, bottom: 64, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `workra report — ${report.room.name}`,
      Author: 'workra',
      Subject: `${report.range.from} to ${report.range.to}`,
    },
  });

  const stream = new PassThrough();
  doc.pipe(stream);

  // typography: default helvetica is bundled with pdfkit so there's no asset
  // dependency to ship. the sizes below are tuned for letter paper.
  const headline = 20;
  const section = 12;
  const body = 10;
  const small = 9;

  // --- header ----------------------------------------------------------------
  doc.font('Helvetica-Bold').fontSize(headline).fillColor('#111').text('work report');
  doc.font('Helvetica').fontSize(body).fillColor('#555').text(report.room.name);
  doc
    .fontSize(small)
    .text(
      `${formatDateShort(report.range.from)} — ${formatDateShort(report.range.to)}` +
        (report.scope.user ? `  ·  ${report.scope.user.displayName}` : ''),
    );
  doc
    .fontSize(small)
    .fillColor('#888')
    .text(`generated ${new Date(report.generatedAt).toLocaleString()}`);

  doc.moveDown(1);
  horizontalRule(doc);
  doc.moveDown(0.75);

  // --- summary ---------------------------------------------------------------
  sectionHeader(doc, 'summary', section);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  const summaryRows: Array<[string, string]> = [
    ['tracked time', formatDuration(report.summary.totalDuration)],
    ['sessions', String(report.summary.sessionCount)],
    ['tasks completed', String(report.summary.taskCompletedCount)],
    ['active days', String(report.summary.activeDays)],
    ['events', String(report.summary.eventCount)],
  ];
  for (const [label, value] of summaryRows) {
    ensureSpace(doc, body * 1.6);
    doc.font('Helvetica').fillColor('#555').text(label, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#111').text(`   ${value}`);
  }

  doc.moveDown(0.6);
  ensureSpace(doc, body * 4);
  doc
    .font('Helvetica')
    .fontSize(body)
    .fillColor('#333')
    .text(report.summary.narrative, { width: textWidth(doc), align: 'left' });
  doc.moveDown(1);

  // --- top tasks -------------------------------------------------------------
  if (report.topTasks.length > 0) {
    sectionHeader(doc, 'top tasks by time', section);
    doc.font('Helvetica').fontSize(body).fillColor('#222');
    for (const t of report.topTasks) {
      ensureSpace(doc, body * 2.2);
      doc
        .font('Helvetica-Bold')
        .fillColor('#111')
        .text(t.title, { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(
          `   ${formatDuration(t.totalDuration)}  ·  ${t.sessionCount} sessions  ·  ${t.status}`,
        );
    }
    doc.moveDown(1);
  }

  // --- daily breakdown -------------------------------------------------------
  if (report.daily.length > 0) {
    sectionHeader(doc, 'daily breakdown', section);
    doc.font('Helvetica').fontSize(body).fillColor('#222');
    for (const row of report.daily) {
      ensureSpace(doc, body * 1.8);
      doc
        .font('Helvetica')
        .fillColor('#555')
        .text(formatDateShort(row.date), { continued: true })
        .font('Helvetica-Bold')
        .fillColor('#111')
        .text(
          `   ${formatDuration(row.totalDuration)}   ` +
            `${row.sessionCount} sess   ${row.completedTaskCount} tasks`,
        );
    }
    doc.moveDown(1);
  }

  // --- sessions --------------------------------------------------------------
  sectionHeader(doc, 'sessions', section);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  if (report.sessions.length === 0) {
    doc.fillColor('#888').text('no sessions in this range.');
  } else {
    for (const s of report.sessions) {
      // estimate one line for header, one or two for intent, plus optional links.
      const estimate =
        body * 1.6 +
        body * estimatedLines(s.intent, body, textWidth(doc)) +
        (s.linkedTask ? body * 1.4 : 0) +
        (s.summary ? body * estimatedLines(s.summary, body, textWidth(doc)) : 0) +
        body * 0.6;
      ensureSpace(doc, estimate);

      const start = new Date(s.startTime);
      const header = `${formatDateShort(start.toISOString())} ${formatTime(start)}  ·  ${s.user.displayName}  ·  ${formatDuration(
        s.duration ?? 0,
      )}`;
      doc.font('Helvetica-Bold').fillColor('#111').text(header);
      doc.font('Helvetica').fillColor('#333').text(`intent: ${s.intent}`, {
        width: textWidth(doc),
      });
      if (s.linkedTask) {
        doc.fillColor('#555').text(`linked task: ${s.linkedTask.title}`);
      }
      if (s.summary) {
        doc.fillColor('#444').text(`summary: ${s.summary}`, { width: textWidth(doc) });
      }
      doc.moveDown(0.5);
    }
  }

  doc.moveDown(0.5);

  // --- completed tasks -------------------------------------------------------
  sectionHeader(doc, 'completed tasks', section);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  if (report.completedTasks.length === 0) {
    doc.fillColor('#888').text('no tasks were completed in this range.');
  } else {
    for (const t of report.completedTasks) {
      ensureSpace(doc, body * 2.6);
      doc.font('Helvetica-Bold').fillColor('#111').text(t.title);
      const bits: string[] = [];
      if (t.completedAt) bits.push(formatDateShort(t.completedAt));
      if (t.assignee) bits.push(t.assignee.displayName);
      if (bits.length > 0) doc.font('Helvetica').fillColor('#555').text(bits.join('  ·  '));
      doc.moveDown(0.3);
    }
  }

  // --- page footers ----------------------------------------------------------
  // flush content so buffered pages are known before we stamp footers.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // override the page's bottom margin temporarily so .text() at footer y
    // doesn't trigger another pagination loop.
    const originalBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 40;
    doc
      .font('Helvetica')
      .fontSize(small - 1)
      .fillColor('#aaa')
      .text('workra — clarity in every working hour', doc.page.margins.left, footerY, {
        width: textWidth(doc),
        align: 'center',
        lineBreak: false,
      });
    doc
      .fontSize(small - 1)
      .fillColor('#aaa')
      .text(`page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, footerY + 12, {
        width: textWidth(doc),
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = originalBottom;
  }

  doc.end();
  return stream;
}

// forces a page break if the current y position plus `needed` would collide with
// the bottom margin. use before rendering a block you don't want to split.
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

// a header plus a tiny minimum block so a heading never ends a page alone.
function sectionHeader(doc: PDFKit.PDFDocument, title: string, size: number): void {
  ensureSpace(doc, size * 3);
  doc.font('Helvetica-Bold').fontSize(size).fillColor('#111').text(title);
  doc.moveDown(0.4);
}

function horizontalRule(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .save()
    .strokeColor('#ddd')
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
  doc.moveDown(0.2);
}

function textWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

// rough line-count estimate for a block of text at a given font size + width.
// used to decide whether to force a page break before a long session entry.
function estimatedLines(text: string, fontSize: number, width: number): number {
  if (!text) return 0;
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(10, Math.floor(width / avgCharWidth));
  const hardLines = text.split('\n');
  let total = 0;
  for (const line of hardLines) {
    total += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return Math.max(1, total);
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function buildReportFilename(report: ReportResponse): string {
  const slug = report.room.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const from = report.range.from.slice(0, 10);
  const to = report.range.to.slice(0, 10);
  return `workra-${slug || 'report'}-${from}-to-${to}.pdf`;
}
