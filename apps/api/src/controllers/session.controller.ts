import type { Request, Response, NextFunction } from 'express';
import * as sessionService from '../services/session.service.js';
import { unauthorized } from '../utils/errors.js';
import type { ListSessionsQuery, SuggestSessionSummaryInput } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function start(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.startSession(userId(req), req.body.roomId, {
      intent: req.body.intent,
      linkedTaskId: req.body.linkedTaskId ?? null,
    });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

export async function stop(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.stopSession(userId(req), req.body.summary);
    res.json({ session });
  } catch (err) {
    next(err);
  }
}

export async function active(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await sessionService.getActiveSession(userId(req));
    res.json({ session });
  } catch (err) {
    next(err);
  }
}

export async function listRoomSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListSessionsQuery;
    const sessions = await sessionService.listRoomSessions(req.params.id, query);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}

export async function getRoomSessionStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await sessionService.getRoomSessionStats(req.params.id);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
}

export async function suggestActiveSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = (req.body ?? {}) as SuggestSessionSummaryInput;
    const result = await sessionService.suggestActiveSessionSummary(
      userId(req),
      body.elapsedMs,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
