'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { roomsApi } from '@/lib/api/rooms';
import { useAuthStore } from '@/lib/auth/store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list(),
  });

  const rooms = data?.rooms ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          hello{user?.name ? `, ${user.name.split(' ')[0].toLowerCase()}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          here is a quiet corner to begin your work.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>active rooms</CardDescription>
            <CardTitle className="text-3xl">{rooms.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>tracked today</CardDescription>
            <CardTitle className="text-3xl font-mono">00:00</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>open tasks</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>your rooms</CardTitle>
            <CardDescription>jump back into a workspace</CardDescription>
          </div>
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            see all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              no rooms yet.{' '}
              <Link href="/rooms" className="text-foreground underline-offset-4 hover:underline">
                create your first one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {rooms.slice(0, 5).map((room) => (
                <li key={room.id}>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="flex items-center justify-between py-3 text-sm transition-colors hover:text-foreground"
                  >
                    <span className="font-medium">{room.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {room.inviteCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
