'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateRoomDialog } from '@/components/room/create-room-dialog';
import { JoinRoomDialog } from '@/components/room/join-room-dialog';
import { roomsApi } from '@/lib/api/rooms';

export default function RoomsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list(),
  });

  const rooms = data?.rooms ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            each room is a client, project, or workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" />
            join
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            new room
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">loading rooms…</p>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              no rooms yet. create one to start tracking work, or join with an invite code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link key={room.id} href={`/rooms/${room.id}`}>
              <Card className="transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{room.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'} ·{' '}
                        {room.role}
                      </CardDescription>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {room.inviteCode}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
