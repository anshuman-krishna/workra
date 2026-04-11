import type { Request, Response, NextFunction } from 'express';
import * as calendarService from '../services/calendar.service.js';
import { unauthorized } from '../utils/errors.js';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function getRoomCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const result = await calendarService.getRoomCalendar(userId(req), req.params.id, {
      from,
      to,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDashboardCalendar(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const result = await calendarService.getDashboardCalendar(userId(req), { from, to });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
