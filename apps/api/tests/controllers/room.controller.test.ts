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

async function signupAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name: 'user', email, password: 'password123456' });
  return res.body.accessToken;
}

describe('room controller (http)', () => {
  it('GET /api/v1/rooms requires auth', async () => {
    const res = await request(app).get('/api/v1/rooms');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/rooms creates a room for the authed user', async () => {
    const token = await signupAndGetToken('owner@example.com');

    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'my room' });

    expect(res.status).toBe(201);
    expect(res.body.room.name).toBe('my room');
    expect(res.body.room.role).toBe('owner');
  });

  it('GET /api/v1/rooms lists only rooms i\'m in', async () => {
    const aToken = await signupAndGetToken('a@example.com');
    const bToken = await signupAndGetToken('b@example.com');

    await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ name: 'a room' });

    const listForB = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${bToken}`);

    expect(listForB.status).toBe(200);
    expect(Array.isArray(listForB.body.rooms)).toBe(true);
    expect(listForB.body.rooms).toHaveLength(0);
  });

  it('POST /api/v1/rooms rejects missing name via zod', async () => {
    const token = await signupAndGetToken('v@example.com');

    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/rooms/join requires a real invite code', async () => {
    const token = await signupAndGetToken('j@example.com');

    const res = await request(app)
      .post('/api/v1/rooms/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'FAKE00' });

    expect(res.status).toBe(404);
  });

  it('GET /api/v1/rooms/:id/invite only works for room owner', async () => {
    const ownerToken = await signupAndGetToken('own@example.com');
    const otherToken = await signupAndGetToken('oth@example.com');

    const created = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'invite room' });

    const roomId = created.body.room.id;

    // owner sees the invite
    const ownerRes = await request(app)
      .get(`/api/v1/rooms/${roomId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.invite.code).toBeTruthy();

    // outsider gets 403 (not a member)
    const otherRes = await request(app)
      .get(`/api/v1/rooms/${roomId}/invite`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(403);
  });
});
