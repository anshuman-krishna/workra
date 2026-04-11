'use client';

import { useParams } from 'next/navigation';
import { RoomCalendar } from '@/components/room/room-calendar';

export default function RoomCalendarPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">calendar</h2>
        <p className="text-sm text-muted-foreground">
          the shape of work in this room. sessions, completed tasks, and scheduled events, one month at a time.
        </p>
      </div>
      <RoomCalendar roomId={params.id} />
    </div>
  );
}
