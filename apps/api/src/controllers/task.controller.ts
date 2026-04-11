import type { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service.js';
import { unauthorized } from '../utils/errors.js';
import type { ListTasksQuery } from '@workra/shared';

function userId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.createTask(userId(req), req.params.id, req.body);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = (req.validatedQuery ?? req.query) as ListTasksQuery;
    const tasks = await taskService.listTasks(userId(req), req.params.id, query);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.getTask(userId(req), req.params.id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await taskService.updateTask(userId(req), req.params.id, req.body);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await taskService.deleteTask(userId(req), req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listSessionsForTask(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await taskService.listSessionsForTask(userId(req), req.params.id);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}
