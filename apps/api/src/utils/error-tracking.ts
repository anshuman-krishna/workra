import { env } from '../config/env.js';
import { logger } from './logger.js';

// thin integration point for sentry or any compatible error tracker.
// when SENTRY_DSN is set and @sentry/node is installed, this module
// initializes it. otherwise errors are logged via pino and nothing
// external happens. this lets us flip error tracking on with a single
// env var and an npm install.

let initialized = false;
let sentryCaptureException: ((err: unknown) => void) | null = null;

export function initErrorTracking(): void {
  if (!env.SENTRY_DSN) return;

  try {
    // dynamic import so @sentry/node is optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (opts: { dsn: string; environment: string; tracesSampleRate: number }) => void;
      captureException: (err: unknown) => void;
    };

    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });

    sentryCaptureException = Sentry.captureException.bind(Sentry);
    initialized = true;
    logger.info('error tracking initialized');
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed. run: npm install @sentry/node');
  }
}

export function captureError(err: unknown): void {
  if (sentryCaptureException) {
    sentryCaptureException(err);
  }
}

export function isTracking(): boolean {
  return initialized;
}
