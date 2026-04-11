import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../api/client';

// single process-wide socket, lazily created. re-uses the same connection across
// multiple room providers so opening a second tab or navigating between rooms
// doesn't spin up new handshakes.
let socket: Socket | null = null;

function buildSocket(token: string): Socket {
  return io(API_URL, {
    path: '/socket.io',
    auth: { token },
    // let the transport upgrade from polling → websocket naturally. if the browser
    // or a proxy blocks websockets, socket.io keeps polling and we still receive events.
    transports: ['websocket', 'polling'],
    // automatic reconnect with exponential backoff is the default; this just documents it.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 10_000,
    // don't auto-connect until we have a token
    autoConnect: false,
  });
}

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = buildSocket(token);
  }
  // token may have rotated (refresh flow). update handshake auth before the next connect.
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

// ask the server to add this socket to a room channel. returns a promise that resolves
// once the server acks. callers can ignore rejection and fall back to polling.
export function joinRoom(socket: Socket, roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.timeout(5_000).emit('room:join', roomId, (err: unknown, res: { ok: boolean; error?: string } | undefined) => {
      if (err || !res?.ok) {
        reject(new Error(res?.error ?? 'join failed'));
        return;
      }
      resolve();
    });
  });
}

export function leaveRoom(socket: Socket, roomId: string): void {
  socket.emit('room:leave', roomId);
}
