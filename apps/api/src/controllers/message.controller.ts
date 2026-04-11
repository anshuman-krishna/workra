import type { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/message.service.js';
import { unauthorized } from '../utils/errors.js';
import type { ListMessagesQuery } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function send(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await messageService.sendMessage(userId(req), req.params.id, req.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListMessagesQuery;
    const messages = await messageService.listMessages(userId(req), req.params.id, query);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.deleteMessage(userId(req), req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
