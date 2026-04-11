import type { Request, Response, NextFunction } from 'express';
import * as eventService from '../services/event.service.js';
import { unauthorized } from '../utils/errors.js';
import type { ListEventsQuery } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await eventService.createEvent(userId(req), req.params.id, req.body);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListEventsQuery;
    const events = await eventService.listEvents(userId(req), req.params.id, query);
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await eventService.deleteEvent(userId(req), req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
