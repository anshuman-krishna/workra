'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TimerButton } from '@/components/timer/timer-button';
import { SessionList } from '@/components/room/session-list';
import { sessionsApi } from '@/lib/api/sessions';
import { formatDuration } from '@/lib/format/time';

export default function RoomTimePage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', roomId],
    queryFn: () => sessionsApi.listForRoom(roomId, { limit: 100 }),
    enabled: Boolean(roomId),
  });

  const { data: statsData } = useQuery({
    queryKey: ['session-stats', roomId],
    queryFn: () => sessionsApi.statsForRoom(roomId),
    enabled: Boolean(roomId),
  });

  const sessions = data?.sessions ?? [];
  const stats = statsData?.stats ?? [];
  const totalAllTime = stats.reduce((sum, s) => sum + s.totalDuration, 0);
  const sessionCount = sessions.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">time</h2>
          <p className="text-sm text-muted-foreground">
            every session in this room, with the intent and what came of it.
          </p>
        </div>
        <TimerButton defaultRoomId={roomId} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">total tracked</p>
            <p className="mt-1 font-mono text-2xl">{formatDuration(totalAllTime)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">sessions</p>
            <p className="mt-1 font-mono text-2xl">{sessionCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">loading sessions…</p>
      ) : error ? (
        <p className="text-sm text-destructive">could not load sessions.</p>
      ) : (
        <SessionList sessions={sessions} />
      )}
    </div>
  );
}
