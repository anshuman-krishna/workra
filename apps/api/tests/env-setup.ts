// vitest setup file — runs before any test import so env validation passes.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-placeholder';
process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret-that-is-at-least-32-chars';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-that-is-at-least-32-chars';
