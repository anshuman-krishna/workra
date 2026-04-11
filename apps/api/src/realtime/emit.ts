import { getIO } from './io.js';
import type { PublicMessage, PublicSession, PublicTask } from '@workra/shared';

// central emit surface. services call these instead of touching the io instance directly,
// so realtime can be disabled (e.g., in tests) or swapped out without touching the service layer.
//
// all events are scoped to room:<roomId>. sockets subscribed to that channel receive them;
// everyone else ignores them. if io isn't initialized yet, emits are silently dropped so
// service code stays linear.

function channel(roomId: string): string {
  return `room:${roomId}`;
}

function emit(roomId: string, event: string, payload: unknown): void {
  const io = getIO();
  if (!io) return;
  io.to(channel(roomId)).emit(event, payload);
}

export function emitMessageCreated(roomId: string, message: PublicMessage): void {
  emit(roomId, 'message:created', { message });
}

export function emitMessageDeleted(
  roomId: string,
  info: { id: string; roomId: string },
): void {
  emit(roomId, 'message:deleted', info);
}

export function emitSessionStarted(roomId: string, session: PublicSession): void {
  emit(roomId, 'session:started', { session });
}

export function emitSessionStopped(roomId: string, session: PublicSession): void {
  emit(roomId, 'session:stopped', { session });
}

// covers create/update/complete/delete. frontend invalidates the task list on any of these.
export function emitTaskChanged(
  roomId: string,
  change: { type: 'created' | 'updated' | 'deleted'; task?: PublicTask; taskId?: string },
): void {
  emit(roomId, 'task:changed', change);
}
