import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import { createApp } from '../../src/app.js';
import { initRealtime, shutdownRealtime } from '../../src/realtime/io.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
import * as messageService from '../../src/services/message.service.js';

let httpServer: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await setupTestDb();
  const app = createApp();
  httpServer = http.createServer(app);
  initRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await shutdownRealtime();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

function join(socket: ClientSocket, roomId: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit('room:join', roomId, (res: { ok: boolean; error?: string }) => {
      resolve(res);
    });
  });
}

describe('socket realtime', () => {
  it('rejects connections without a token', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const s = ioClient(baseUrl, {
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        s.once('connect', () => {
          s.close();
          reject(new Error('unexpected connection without token'));
        });
        s.once('connect_error', (err) => {
          s.close();
          resolve(err);
        });
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects connections with a bad token', async () => {
    await expect(connect('not-a-valid-jwt')).rejects.toThrow();
  });

  it('authed socket can join its own room', async () => {
    const auth = await authService.signup({
      name: 'sock',
      email: 'sock@example.com',
      password: 'password123456',
    });
    const room = await roomService.createRoom(auth.user.id, 'sock room');

    const socket = await connect(auth.accessToken);
    try {
      const res = await join(socket, room.id);
      expect(res.ok).toBe(true);
    } finally {
      socket.close();
    }
  });

  it('room:join rejects a non-member', async () => {
    const owner = await authService.signup({
      name: 'owner',
      email: 'owner@example.com',
      password: 'password123456',
    });
    const outsider = await authService.signup({
      name: 'out',
      email: 'out@example.com',
      password: 'password123456',
    });
    const room = await roomService.createRoom(owner.user.id, 'locked');

    const socket = await connect(outsider.accessToken);
    try {
      const res = await join(socket, room.id);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not a member/);
    } finally {
      socket.close();
    }
  });

  it('broadcasts message:created to sockets in the room', async () => {
    const auth = await authService.signup({
      name: 'bcast',
      email: 'bcast@example.com',
      password: 'password123456',
    });
    const room = await roomService.createRoom(auth.user.id, 'broadcast room');

    const listener = await connect(auth.accessToken);
    try {
      const joinRes = await join(listener, room.id);
      expect(joinRes.ok).toBe(true);

      const received = new Promise<{ message: { content: string } }>((resolve) => {
        listener.once('message:created', (payload) => {
          resolve(payload as { message: { content: string } });
        });
      });

      // send through the service; it calls emitMessageCreated internally
      await messageService.sendMessage(auth.user.id, room.id, { content: 'realtime hi' });

      const payload = await Promise.race([
        received,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('broadcast timeout')), 2000),
        ),
      ]);
      expect(payload.message.content).toBe('realtime hi');
    } finally {
      listener.close();
    }
  });
});
