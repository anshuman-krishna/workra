'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { roomsApi } from '@/lib/api/rooms';

export default function RoomOverviewPage() {
  const params = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['room', params.id],
    queryFn: () => roomsApi.get(params.id),
    enabled: Boolean(params.id),
  });

  const room = data?.room;
  if (!room) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>invite</CardTitle>
          <CardDescription>share this code to bring in a collaborator or client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-md bg-secondary px-4 py-3 font-mono text-lg uppercase tracking-[0.3em]">
            {room.inviteCode}
          </div>
          <p className="text-xs text-muted-foreground">
            invited members join as collaborators by default.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>this room</CardTitle>
          <CardDescription>a quiet place to do real work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>created</span>
            <span>{new Date(room.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>members</span>
            <span>{room.memberCount}</span>
          </div>
          <div className="flex justify-between">
            <span>your role</span>
            <span>{room.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
