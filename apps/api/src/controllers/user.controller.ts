import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import * as recapService from '../services/recap.service.js';
import { unauthorized } from '../utils/errors.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw unauthorized();
    const user = await userService.getMe(req.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function getDailyRecap(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw unauthorized();
    const tz = typeof req.query.tz === 'string' ? req.query.tz : undefined;
    const recap = await recapService.generateDailyRecap(req.userId, { tz });
    res.json({ recap });
  } catch (err) {
    next(err);
  }
}
