'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  File as FileIcon,
  ListChecks,
  LogIn,
  MessageSquare,
  Pencil,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityCategory, ActivityType, PublicActivity } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { activityApi } from '@/lib/api/activity';
import { cn } from '@/lib/utils';
import { formatDateLabel, localDateKey } from '@/lib/format/time';

interface Props {
  roomId: string;
}

const ICONS: Record<ActivityType, LucideIcon> = {
  session_started: Timer,
  session_completed: CheckCircle2,
  room_created: Sparkles,
  room_joined: LogIn,
  task_created: ListChecks,
  task_updated: Pencil,
  task_completed: CheckCircle2,
  task_deleted: Trash2,
  file_uploaded: Upload,
  file_versioned: FileIcon,
  file_deleted: Trash2,
  message_sent: MessageSquare,
};

const FILTERS: Array<{ value: ActivityCategory | 'all'; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'session', label: 'sessions' },
  { value: 'task', label: 'tasks' },
  { value: 'file', label: 'files' },
  { value: 'chat', label: 'chat' },
  { value: 'room', label: 'room' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupByDay(items: PublicActivity[]): Array<{ date: Date; items: PublicActivity[] }> {
  const map = new Map<string, { date: Date; items: PublicActivity[] }>();
  for (const item of items) {
    const created = new Date(item.createdAt);
    const key = localDateKey(created);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, { date: created, items: [item] });
    }
  }
  return Array.from(map.values());
}

export function ActivityTimeline({ roomId }: Props) {
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['activity', roomId, filter],
    queryFn: () =>
      activityApi.listForRoom(roomId, {
        category: filter === 'all' ? undefined : filter,
        limit: 50,
      }),
    enabled: Boolean(roomId),
    // moderate polling so the timeline reflects new actions without hammering the api
    refetchInterval: 30000,
  });

  const groups = useMemo(() => groupByDay(data?.activity ?? []), [data]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">activity</h3>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  filter === f.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">loading…</p>
        ) : error ? (
          <p className="text-xs text-destructive">could not load activity.</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">nothing here yet.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={localDateKey(group.date)}>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {formatDateLabel(group.date)}
                </h4>
                <ul className="space-y-2.5">
                  {group.items.map((item) => {
                    const Icon = ICONS[item.type] ?? Circle;
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 text-sm">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">
                                {initials(item.user.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{item.user.displayName}</span>
                            <span className="text-muted-foreground">{item.title}</span>
                          </p>
                          {item.subtitle && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
