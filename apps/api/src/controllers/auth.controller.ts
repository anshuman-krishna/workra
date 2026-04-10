import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { env, isProd } from '../config/env.js';

const REFRESH_COOKIE = 'workra_refresh';

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    expires: expiresAt,
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signup(req.body);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ error: { code: 'unauthorized', message: 'no refresh token' } });
      return;
    }
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
