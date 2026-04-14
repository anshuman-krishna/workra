import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import { createApp } from '../../src/app.js';

const app = createApp();

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('auth controller (http)', () => {
  it('POST /api/v1/auth/signup returns 201 + access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'http user', email: 'http@example.com', password: 'password123456' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('http@example.com');
    expect(res.body.accessToken).toBeTruthy();
    // refresh token goes into an httpOnly cookie, not the body
    expect(res.body.refreshToken).toBeUndefined();
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('workra_refresh=');
    expect(String(setCookie)).toContain('HttpOnly');
    expect(String(setCookie)).toContain('SameSite=Strict');
  });

  it('POST /api/v1/auth/signup rejects missing fields via zod', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'noname@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /api/v1/auth/signup rejects short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'short', email: 'short@example.com', password: 'abc' });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/auth/login accepts correct password', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'login', email: 'login@example.com', password: 'password123456' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'password123456' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('POST /api/v1/auth/login rejects bad password with 401', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'bad', email: 'bad@example.com', password: 'password123456' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bad@example.com', password: 'nope-nope-nope' });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/logout returns 204 even without cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});
