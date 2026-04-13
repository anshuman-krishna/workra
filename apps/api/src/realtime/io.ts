import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import { Membership } from '../models/membership.model.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// one shared io instance owned by the process. emit helpers read this via getIO().
let io: IOServer | null = null;

interface SocketData {
  userId: string;
  // rooms the socket is currently subscribed to; used to enforce leave on logout.
  joinedRooms: Set<string>;
}

type AppSocket = Socket<DefaultEvents, DefaultEvents, DefaultEvents, SocketData>;

// socket.io's event types accept any shape; we only use string channels.
interface DefaultEvents {
  [event: string]: (...args: unknown[]) => void;
}

export function initRealtime(server: HttpServer): IOServer {
  const instance = new IOServer(server, {
    // mirror the cors rules of the http api; credentials for the future cookie story.
    cors: {
      origin: env.WEB_ORIGIN,
      credentials: true,
    },
    // keep the default path so clients can reach it without extra config
    path: '/socket.io',
  });

  // auth middleware: token passed via handshake.auth.token OR Authorization header.
  // failures close the connection before any event fires.
  instance.use((socket, next) => {
    try {
      const raw = (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);
      if (!raw) return next(new Error('missing access token'));
      const payload = verifyAccessToken(raw);
      (socket.data as SocketData).userId = payload.sub;
      (socket.data as SocketData).joinedRooms = new Set();
      next();
    } catch {
      next(new Error('invalid access token'));
    }
  });

  instance.on('connection', (socket: AppSocket) => {
    logger.debug({ sid: socket.id, userId: socket.data.userId }, 'socket connected');

    // room:join — client asks to subscribe to a room channel.
    // we verify membership fresh every time so revoked access takes effect immediately.
    socket.on('room:join', async (...args: unknown[]) => {
      const roomId = args[0] as unknown;
      const ack = args[1] as ((res: { ok: boolean; error?: string }) => void) | undefined;
      try {
        if (typeof roomId !== 'string' || roomId.length === 0) {
          ack?.({ ok: false, error: 'invalid room id' });
          return;
        }
        const membership = await Membership.findOne({
          userId: socket.data.userId,
          roomId,
        });
        if (!membership) {
          ack?.({ ok: false, error: 'not a member of this room' });
          return;
        }
        const channel = `room:${roomId}`;
        await socket.join(channel);
        socket.data.joinedRooms.add(channel);
        ack?.({ ok: true });
      } catch (err) {
        logger.warn({ err }, 'room:join failed');
        ack?.({ ok: false, error: 'join failed' });
      }
    });

    socket.on('room:leave', async (...args: unknown[]) => {
      const roomId = args[0] as unknown;
      const ack = args[1] as ((res: { ok: boolean }) => void) | undefined;
      if (typeof roomId !== 'string') {
        ack?.({ ok: false });
        return;
      }
      const channel = `room:${roomId}`;
      await socket.leave(channel);
      socket.data.joinedRooms.delete(channel);
      ack?.({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ sid: socket.id, reason }, 'socket disconnected');
    });
  });

  io = instance;
  return instance;
}

export function getIO(): IOServer | null {
  return io;
}

export function shutdownRealtime(): Promise<void> {
  if (!io) return Promise.resolve();
  return new Promise((resolve) => {
    io!.close(() => {
      io = null;
      resolve();
    });
  });
}
