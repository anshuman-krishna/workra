import type { Request, Response, NextFunction } from 'express';
import * as activityLog from '../services/activity-log.service.js';
import { unauthorized } from '../utils/errors.js';
import type { ListActivityQuery } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function listRoomActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListActivityQuery;
    const items = await activityLog.listRoomActivity(userId(req), req.params.id, query);
    res.json({ activity: items });
  } catch (err) {
    next(err);
  }
}
