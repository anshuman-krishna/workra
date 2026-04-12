import type { Request, Response, NextFunction } from 'express';
import * as reportService from '../services/report.service.js';
import { renderReportPdf, buildReportFilename } from '../reports/pdf.js';
import { unauthorized } from '../utils/errors.js';
import type { AiSummaryRequest, ReportQuery } from '@workra/shared';

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
      tz: query.tz,
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

export async function getRoomReportAiSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body as AiSummaryRequest;
    const result = await reportService.generateAiReportNarrative(
      userId(req),
      req.params.id,
      {
        from: body.from,
        to: body.to,
        userId: body.userId,
        tz: body.tz,
      },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
