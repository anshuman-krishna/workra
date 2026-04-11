import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import type { ReportResponse } from '@workra/shared';

// server-side pdf renderer. layout is intentionally plain — a client will want to
// read this, not admire it. the goal is credibility: clear header, clean totals,
// session list with intent + summary, tasks completed. no colors, no logos.
//
// returns a readable stream so the controller can pipe it to the response without
// buffering the whole document in memory.
export function renderReportPdf(report: ReportResponse): NodeJS.ReadableStream {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
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
  doc.font('Helvetica-Bold').fontSize(headline).text('work report', { continued: false });
  doc
    .font('Helvetica')
    .fontSize(body)
    .fillColor('#555')
    .text(report.room.name);
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
  doc.font('Helvetica-Bold').fontSize(section).fillColor('#111').text('summary');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  const summaryRows: Array<[string, string]> = [
    ['tracked time', formatDuration(report.summary.totalDuration)],
    ['sessions', String(report.summary.sessionCount)],
    ['tasks completed', String(report.summary.taskCompletedCount)],
    ['active days', String(report.summary.activeDays)],
    ['events', String(report.summary.eventCount)],
  ];
  for (const [label, value] of summaryRows) {
    doc.font('Helvetica').fillColor('#555').text(label, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#111').text(`   ${value}`);
  }

  doc.moveDown(0.6);
  doc
    .font('Helvetica')
    .fontSize(body)
    .fillColor('#333')
    .text(report.summary.narrative, { width: textWidth(doc), align: 'left' });
  doc.moveDown(1);

  // --- top tasks -------------------------------------------------------------
  if (report.topTasks.length > 0) {
    doc.font('Helvetica-Bold').fontSize(section).fillColor('#111').text('top tasks by time');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(body).fillColor('#222');
    for (const t of report.topTasks) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#111')
        .text(t.title, { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(`   ${formatDuration(t.totalDuration)}  ·  ${t.sessionCount} sessions  ·  ${t.status}`);
    }
    doc.moveDown(1);
  }

  // --- daily breakdown -------------------------------------------------------
  if (report.daily.length > 0) {
    doc.font('Helvetica-Bold').fontSize(section).fillColor('#111').text('daily breakdown');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(body).fillColor('#222');
    for (const row of report.daily) {
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
  doc.font('Helvetica-Bold').fontSize(section).fillColor('#111').text('sessions');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  if (report.sessions.length === 0) {
    doc.fillColor('#888').text('no sessions in this range.');
  } else {
    for (const s of report.sessions) {
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
  doc.font('Helvetica-Bold').fontSize(section).fillColor('#111').text('completed tasks');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(body).fillColor('#222');

  if (report.completedTasks.length === 0) {
    doc.fillColor('#888').text('no tasks were completed in this range.');
  } else {
    for (const t of report.completedTasks) {
      doc.font('Helvetica-Bold').fillColor('#111').text(t.title);
      const bits: string[] = [];
      if (t.completedAt) bits.push(formatDateShort(t.completedAt));
      if (t.assignee) bits.push(t.assignee.displayName);
      if (bits.length > 0) doc.font('Helvetica').fillColor('#555').text(bits.join('  ·  '));
      doc.moveDown(0.3);
    }
  }

  // --- footer ----------------------------------------------------------------
  doc.moveDown(1);
  horizontalRule(doc);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(small).fillColor('#888').text(
    'workra — clarity in every working hour',
    { align: 'center' },
  );

  doc.end();
  return stream;
}

function horizontalRule(doc: PDFKit.PDFDocument) {
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
