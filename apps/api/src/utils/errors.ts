export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const unauthorized = (message = 'unauthorized') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'forbidden') => new AppError(403, 'forbidden', message);

export const notFound = (message = 'not found') => new AppError(404, 'not_found', message);

export const conflict = (message: string) => new AppError(409, 'conflict', message);

export const tooManyRequests = (message: string, details?: unknown) =>
  new AppError(429, 'too_many_requests', message, details);
