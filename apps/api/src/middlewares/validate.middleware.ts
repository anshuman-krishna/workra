import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

export const validateBody =
  <T>(schema: ZodType<T, ZodTypeDef, unknown>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };

export const validateQuery =
  <T>(schema: ZodType<T, ZodTypeDef, unknown>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    // express 4 query is read-only via replace; mutate via assign instead
    Object.assign(req.query, result.data as Record<string, unknown>);
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}
