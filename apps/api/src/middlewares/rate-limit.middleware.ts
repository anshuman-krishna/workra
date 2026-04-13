import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

const rateLimitMessage = {
  error: { code: 'rate_limited', message: 'too many requests, slow down' },
};

// key by authenticated userId when available, fall back to IP.
// requireAuth populates req.userId before these limiters run on protected routes.
const userOrIpKey = (req: Request): string => req.userId ?? req.ip ?? 'unknown';

function logRateLimit(label: string) {
  return (_req: Request, _res: Response) => {
    const key = userOrIpKey(_req);
    logger.warn({ key, limiter: label, path: _req.path }, 'rate limit hit');
  };
}

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req, res, _next, options) => {
    logRateLimit('auth')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logRateLimit('global')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});

// tighter limit for write operations (create/update/delete)
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req, res, _next, options) => {
    logRateLimit('write')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});

// ai endpoints: per-minute burst limiter
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req, res, _next, options) => {
    logRateLimit('ai')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});

// ai daily cap: 200 requests per user per day
export const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 200,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'daily ai request limit reached. try again tomorrow.' },
  },
  handler: (req, res, _next, options) => {
    logRateLimit('ai_daily')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});

// file uploads: even tighter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req, res, _next, options) => {
    logRateLimit('upload')(req, res);
    res.status(options.statusCode).json(options.message);
  },
});
