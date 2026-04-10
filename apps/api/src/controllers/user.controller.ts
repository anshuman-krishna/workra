import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
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
