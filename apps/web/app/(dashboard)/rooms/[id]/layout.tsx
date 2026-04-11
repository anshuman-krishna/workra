'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RoomTabs } from '@/components/room/room-tabs';
import { roomsApi } from '@/lib/api/rooms';
import { RoomRealtimeProvider } from '@/lib/realtime/room-provider';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['room', id],
    queryFn: () => roomsApi.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">loading room…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> back to rooms
        </Link>
        <p className="text-sm text-destructive">this room is unavailable.</p>
      </div>
    );
  }

  const room = data.room;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> rooms
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'} · you are{' '}
              {room.role}
            </p>
          </div>
          <div className="rounded-md border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {room.inviteCode}
          </div>
        </div>
      </div>

      <RoomTabs roomId={room.id} />

      <RoomRealtimeProvider roomId={room.id} />
      {children}
    </div>
  );
}
