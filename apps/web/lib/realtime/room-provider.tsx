'use client';

import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { PublicMessage, PublicSession, PublicTask } from '@workra/shared';
import { useAuthStore } from '@/lib/auth/store';
import { useTimerStore } from '@/lib/timer/store';
import { getSocket, joinRoom, leaveRoom } from './socket';

interface Props {
  roomId: string;
}

// mounted by the room layout. opens (or reuses) the shared socket, subscribes to the
// room channel, and patches react-query caches in-place so the UI updates instantly.
// polling remains active as the fallback, so if the socket drops the user still sees updates.
export function RoomRealtimeProvider({ roomId }: Props) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setActive = useTimerStore((s) => s.setActive);

  useEffect(() => {
    if (!token || !roomId) return;

    let cancelled = false;
    const socket = getSocket(token);

    // handlers close over the current roomId/qc; we'll unregister on cleanup.
    const onMessageCreated = ({ message }: { message: PublicMessage }) => {
      if (message.roomId !== roomId) return;
      // chat uses an infinite list keyed by ['messages', roomId]. each page is an array
      // of messages in newest-first order. push the new message onto page 0 so it appears
      // at the bottom of the rendered (reversed) list without refetching.
      qc.setQueryData<InfiniteData<{ messages: PublicMessage[] }>>(
        ['messages', roomId],
        (old) => {
          if (!old) return old;
          const [first, ...rest] = old.pages;
          if (!first) return old;
          // dedupe in case the sender also got the http response first
          if (first.messages.some((m) => m.id === message.id)) return old;
          return {
            ...old,
            pages: [{ messages: [message, ...first.messages] }, ...rest],
          };
        },
      );
      // nudge activity so the overview timeline catches up
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
    };

    const onMessageDeleted = ({ id }: { id: string; roomId: string }) => {
      qc.setQueryData<InfiniteData<{ messages: PublicMessage[] }>>(
        ['messages', roomId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              messages: p.messages.filter((m) => m.id !== id),
            })),
          };
        },
      );
    };

    const onSessionStarted = ({ session }: { session: PublicSession }) => {
      if (session.roomId !== roomId) return;
      qc.invalidateQueries({ queryKey: ['sessions', roomId] });
      qc.invalidateQueries({ queryKey: ['session-stats', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
      // if it's our own session, hydrate the local timer store immediately
      if (currentUserId && session.userId === currentUserId) {
        setActive(session);
        qc.invalidateQueries({ queryKey: ['session', 'active'] });
      }
    };

    const onSessionStopped = ({ session }: { session: PublicSession }) => {
      if (session.roomId !== roomId) return;
      qc.invalidateQueries({ queryKey: ['sessions', roomId] });
      qc.invalidateQueries({ queryKey: ['session-stats', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
      if (currentUserId && session.userId === currentUserId) {
        setActive(null);
        qc.invalidateQueries({ queryKey: ['session', 'active'] });
      }
      if (session.linkedTaskId) {
        qc.invalidateQueries({ queryKey: ['task', session.linkedTaskId, 'sessions'] });
      }
    };

    const onTaskChanged = (_change: {
      type: 'created' | 'updated' | 'deleted';
      task?: PublicTask;
      taskId?: string;
    }) => {
      // invalidate-once covers create/update/delete uniformly. the tasks query refetches.
      qc.invalidateQueries({ queryKey: ['tasks', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
    };

    socket.on('message:created', onMessageCreated);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('session:started', onSessionStarted);
    socket.on('session:stopped', onSessionStopped);
    socket.on('task:changed', onTaskChanged);

    const subscribe = async () => {
      try {
        await joinRoom(socket, roomId);
      } catch {
        // polling fallback stays active; nothing else to do.
      }
    };

    if (socket.connected) {
      void subscribe();
    } else {
      socket.once('connect', () => {
        if (!cancelled) void subscribe();
      });
    }

    // re-join after a reconnect so the server-side room membership is restored,
    // then force-refetch the room-scoped caches so we pick up anything that
    // happened during the disconnect window.
    const onReconnect = () => {
      if (cancelled) return;
      void subscribe();
      qc.invalidateQueries({ queryKey: ['messages', roomId] });
      qc.invalidateQueries({ queryKey: ['sessions', roomId] });
      qc.invalidateQueries({ queryKey: ['session-stats', roomId] });
      qc.invalidateQueries({ queryKey: ['tasks', roomId] });
      qc.invalidateQueries({ queryKey: ['activity', roomId] });
      qc.invalidateQueries({ queryKey: ['session', 'active'] });
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      cancelled = true;
      socket.off('message:created', onMessageCreated);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('session:started', onSessionStarted);
      socket.off('session:stopped', onSessionStopped);
      socket.off('task:changed', onTaskChanged);
      socket.io.off('reconnect', onReconnect);
      // leave the room channel but keep the socket open for other rooms
      if (socket.connected) leaveRoom(socket, roomId);
    };
  }, [roomId, token, qc, currentUserId, setActive]);

  return null;
}
