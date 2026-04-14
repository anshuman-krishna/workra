// vitest setup file — runs before any test import so env validation passes.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-placeholder';
process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret-that-is-at-least-32-chars';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-that-is-at-least-32-chars';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'fatal';

// local storage points at a scratch dir so tests can't stomp on dev uploads
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'workra-test-'));
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = scratch;
