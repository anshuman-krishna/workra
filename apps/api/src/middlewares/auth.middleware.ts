import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { Membership } from '../models/membership.model.js';
import type { RoomRole } from '@workra/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: 'user' | 'admin';
      roomRole?: RoomRole;
    }
  }
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('missing access token'));
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    next(unauthorized('invalid or expired access token'));
  }
};

// system roles (User.role)
export const requireRole =
  (roles: Array<'user' | 'admin'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(forbidden());
    }
    next();
  };

// room-scoped roles (Membership.role). reads :id from params by default.
export const requireRoomRole =
  (roles: RoomRole[], paramName = 'id'): RequestHandler =>
  async (req, _res, next) => {
    try {
      if (!req.userId) return next(unauthorized());
      const roomId = req.params[paramName];
      if (!roomId) return next(forbidden('room id missing'));

      const membership = await Membership.findOne({ userId: req.userId, roomId });
      if (!membership) return next(forbidden('not a member of this room'));
      if (!roles.includes(membership.role as unknown as RoomRole)) {
        return next(forbidden(`requires room role: ${roles.join(' or ')}`));
      }

      req.roomRole = membership.role as unknown as RoomRole;
      next();
    } catch (err) {
      next(err);
    }
  };
