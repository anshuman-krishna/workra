import type { Request, Response, NextFunction } from 'express';
import * as reportService from '../services/report.service.js';
import { renderReportPdf, buildReportFilename } from '../reports/pdf.js';
import { unauthorized } from '../utils/errors.js';
import type { ReportQuery } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function getRoomReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ReportQuery;
    const report = await reportService.generateRoomReport(userId(req), req.params.id, {
      from: query.from,
      to: query.to,
      userId: query.userId,
    });

    if (query.format === 'pdf') {
      const stream = renderReportPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildReportFilename(report)}"`,
      );
      stream.pipe(res);
      return;
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
}
