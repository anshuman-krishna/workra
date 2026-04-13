import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const rateLimitMessage = {
  error: { code: 'rate_limited', message: 'too many requests, slow down' },
};

// key by authenticated userId when available, fall back to IP.
// requireAuth populates req.userId before these limiters run on protected routes.
const userOrIpKey = (req: Request): string => req.userId ?? req.ip ?? 'unknown';

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// tighter limit for write operations (create/update/delete)
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});

// ai endpoints: per-minute burst limiter
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
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
});

// file uploads: even tighter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});
