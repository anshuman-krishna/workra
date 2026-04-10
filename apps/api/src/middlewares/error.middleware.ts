import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { isProd } from '../config/env.js';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'not_found', message: 'route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'invalid request',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (!isProd) {
    console.error(err);
  }

  res.status(500).json({
    error: { code: 'internal_error', message: 'something went wrong' },
  });
};
