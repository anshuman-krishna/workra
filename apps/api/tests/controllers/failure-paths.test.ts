import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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

async function signup(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name: 'u', email, password: 'password123456' });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

describe('failure paths', () => {
  it('protected endpoint without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('protected endpoint with a malformed token returns 401', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('protected endpoint with an expired token returns 401', async () => {
    const expired = jwt.sign(
      { sub: '507f1f77bcf86cd799439011', role: 'user' },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: '-1s' },
    );
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('protected endpoint with a token signed by the wrong secret returns 401', async () => {
    const wrongSig = jwt.sign({ sub: '507f1f77bcf86cd799439011', role: 'user' }, 'some-other-secret');
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${wrongSig}`);
    expect(res.status).toBe(401);
  });

  it('non-member cannot read a different user\'s room', async () => {
    const owner = await signup('owner@example.com');
    const outsider = await signup('out@example.com');

    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'private' });

    const readRes = await request(app)
      .get(`/api/v1/rooms/${createRes.body.room.id}/tasks`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(readRes.status).toBe(403);
  });

  it('malformed room ids return 404, not 500', async () => {
    const u = await signup('oid@example.com');

    const res = await request(app)
      .get('/api/v1/rooms/not-a-valid-id/tasks')
      .set('Authorization', `Bearer ${u.token}`);

    // requireRoomRole rejects bad id format before mongoose can CastError
    expect(res.status).toBe(404);
  });

  it('unknown route returns 404 via the notFound handler', async () => {
    const res = await request(app).get('/api/v1/this-does-not-exist');
    expect(res.status).toBe(404);
  });
});
