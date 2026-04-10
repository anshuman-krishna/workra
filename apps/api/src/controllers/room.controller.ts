import type { Request, Response, NextFunction } from 'express';
import * as roomService from '../services/room.service.js';
import { unauthorized } from '../utils/errors.js';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function createRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const room = await roomService.createRoom(userId(req), req.body.name);
    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
}

export async function listRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const rooms = await roomService.listUserRooms(userId(req));
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const room = await roomService.getRoom(userId(req), req.params.id);
    res.json({ room });
  } catch (err) {
    next(err);
  }
}

export async function joinRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const room = await roomService.joinRoom(userId(req), req.body.code);
    res.json({ room });
  } catch (err) {
    next(err);
  }
}

export async function getRoomInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const invite = await roomService.getRoomInvite(req.params.id);
    res.json({ invite });
  } catch (err) {
    next(err);
  }
}
