'use client';

import { useMemo } from 'react';
import type { PublicSession } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDuration, localDateKey, formatDateLabel } from '@/lib/format/time';
import { cn } from '@/lib/utils';

interface DayGroup {
  key: string;
  date: Date;
  sessions: PublicSession[];
  total: number;
}

function groupByDay(sessions: PublicSession[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of sessions) {
    const date = new Date(s.startTime);
    const key = localDateKey(date);
    let group = map.get(key);
    if (!group) {
      group = { key, date, sessions: [], total: 0 };
      map.set(key, group);
    }
    group.sessions.push(s);
    if (s.duration) group.total += s.duration;
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTimeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SessionList({ sessions }: { sessions: PublicSession[] }) {
  const groups = useMemo(() => groupByDay(sessions), [sessions]);

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <h2 className="text-base font-medium">no sessions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            start a session from the top bar. each one keeps an intent and a summary.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">{formatDateLabel(group.date)}</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {formatDuration(group.total)}
            </span>
          </header>
          <Card>
            <CardContent className="divide-y p-0">
              {group.sessions.map((session) => {
                const live = session.endTime === null;
                return (
                  <article key={session.id} className="flex gap-4 px-5 py-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {initials(session.user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-medium">{session.intent}</p>
                        <span
                          className={cn(
                            'shrink-0 font-mono text-xs',
                            live ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {live ? 'live' : formatDuration(session.duration ?? 0)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.user.displayName} · {formatTimeOfDay(session.startTime)}
                        {session.endTime && ` – ${formatTimeOfDay(session.endTime)}`}
                      </p>
                      {session.summary && (
                        <p className="whitespace-pre-wrap pt-1 text-sm text-muted-foreground">
                          {session.summary}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
