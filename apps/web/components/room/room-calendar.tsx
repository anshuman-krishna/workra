'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CalendarDay, PublicEvent, PublicSession } from '@workra/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { calendarApi } from '@/lib/api/calendar';
import { sessionsApi } from '@/lib/api/sessions';
import { tasksApi } from '@/lib/api/tasks';
import { formatDuration, localDateKey } from '@/lib/format/time';
import { buildMonthGrid, monthGridBounds, monthLabel, shiftMonth } from '@/lib/calendar/grid';
import { HEAT_CLASSES, heatLevel } from '@/lib/calendar/heatmap';
import { cn } from '@/lib/utils';
import { CreateEventDialog } from './create-event-dialog';

interface Props {
  roomId: string;
}

type Filter = 'all' | 'sessions' | 'tasks' | 'events';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'sessions', label: 'sessions' },
  { value: 'tasks', label: 'tasks' },
  { value: 'events', label: 'events' },
];

const EVENT_DOT: Record<PublicEvent['type'], string> = {
  deadline: 'bg-red-500/80',
  meeting: 'bg-amber-500/80',
  milestone: 'bg-emerald-500/80',
};

function dayHasContent(day: CalendarDay, filter: Filter): boolean {
  if (filter === 'sessions') return day.sessionCount > 0;
  if (filter === 'tasks') return day.completedTaskCount > 0;
  if (filter === 'events') return day.eventCount > 0;
  return (
    day.sessionCount > 0 ||
    day.completedTaskCount > 0 ||
    day.eventCount > 0
  );
}

export function RoomCalendar({ roomId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedKey, setSelectedKey] = useState<string>(localDateKey(today));
  const [createOpen, setCreateOpen] = useState(false);

  const grid = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);
  const bounds = useMemo(() => monthGridBounds(year, monthIndex), [year, monthIndex]);

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['room-calendar', roomId, bounds.from, bounds.to],
    queryFn: () => calendarApi.roomCalendar(roomId, bounds),
    enabled: Boolean(roomId),
  });

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of calendarData?.days ?? []) map.set(d.date, d);
    return map;
  }, [calendarData]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PublicEvent[]>();
    for (const e of calendarData?.events ?? []) {
      // events are stored at utc midnight, so the yyyy-mm-dd prefix matches
      // the bucket we grouped by server-side. slicing avoids timezone drift.
      const key = e.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [calendarData]);

  const maxDuration = useMemo(() => {
    let max = 0;
    for (const d of dayMap.values()) if (d.totalDuration > max) max = d.totalDuration;
    return max;
  }, [dayMap]);

  // month totals for the header summary
  const monthSummary = useMemo(() => {
    let totalDuration = 0;
    let sessionCount = 0;
    let taskCount = 0;
    let eventCount = 0;
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      const day = dayMap.get(cell.key);
      if (!day) continue;
      totalDuration += day.totalDuration;
      sessionCount += day.sessionCount;
      taskCount += day.completedTaskCount;
      eventCount += day.eventCount;
    }
    return { totalDuration, sessionCount, taskCount, eventCount };
  }, [grid, dayMap]);

  const goPrev = () => {
    const next = shiftMonth(year, monthIndex, -1);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  };
  const goNext = () => {
    const next = shiftMonth(year, monthIndex, 1);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonthIndex(today.getMonth());
    setSelectedKey(localDateKey(today));
  };

  const todayKey = localDateKey(today);
  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  return (
    <div className="space-y-4">
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roomId={roomId}
        defaultDate={selectedKey}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[10ch] text-center text-sm font-medium">
            {monthLabel(year, monthIndex)}
          </p>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            today
          </Button>
        </div>

        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            event
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">loading calendar…</p>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {grid.map((cell) => {
                    const day = dayMap.get(cell.key);
                    const level = day ? heatLevel(day.totalDuration, maxDuration) : 0;
                    const visible = day ? dayHasContent(day, filter) : false;
                    const heatClass =
                      filter === 'all' || filter === 'sessions'
                        ? visible
                          ? HEAT_CLASSES[level]
                          : HEAT_CLASSES[0]
                        : HEAT_CLASSES[0];
                    const events = eventsByDay.get(cell.key) ?? [];
                    const isToday = cell.key === todayKey;
                    const isSelected = cell.key === selectedKey;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedKey(cell.key)}
                        className={cn(
                          'group relative flex aspect-square flex-col items-start justify-between rounded-md border p-1.5 text-left text-xs transition-colors',
                          cell.inMonth
                            ? 'border-border/60'
                            : 'border-transparent text-muted-foreground/50',
                          isSelected && 'ring-2 ring-foreground',
                          !isSelected && 'hover:border-foreground/40',
                          heatClass,
                        )}
                      >
                        <span
                          className={cn(
                            'font-mono',
                            isToday && 'font-semibold text-foreground',
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {(filter === 'all' || filter === 'events') &&
                            events.slice(0, 3).map((e) => (
                              <span
                                key={e.id}
                                className={cn('h-1.5 w-1.5 rounded-full', EVENT_DOT[e.type])}
                                aria-hidden
                              />
                            ))}
                          {(filter === 'all' || filter === 'tasks') &&
                            day &&
                            day.completedTaskCount > 0 && (
                              <span className="ml-0.5 text-[9px] text-foreground/70">
                                ✓{day.completedTaskCount}
                              </span>
                            )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    tracked:{' '}
                    <span className="font-mono text-foreground">
                      {formatDuration(monthSummary.totalDuration)}
                    </span>
                  </div>
                  <div>
                    sessions:{' '}
                    <span className="font-mono text-foreground">{monthSummary.sessionCount}</span>
                  </div>
                  <div>
                    tasks done:{' '}
                    <span className="font-mono text-foreground">{monthSummary.taskCount}</span>
                  </div>
                  <div>
                    events:{' '}
                    <span className="font-mono text-foreground">{monthSummary.eventCount}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <DayDetail
          roomId={roomId}
          dateKey={selectedKey}
          date={selectedDate}
          events={eventsByDay.get(selectedKey) ?? []}
          day={dayMap.get(selectedKey)}
        />
      </div>
    </div>
  );
}

interface DetailProps {
  roomId: string;
  dateKey: string;
  date: Date;
  events: PublicEvent[];
  day: CalendarDay | undefined;
}

function DayDetail({ roomId, dateKey, date, events, day }: DetailProps) {
  // day scoped session + task fetches. cheap because the range is one day.
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(`${dateKey}T23:59:59.999Z`).toISOString();

  const { data: sessionsData } = useQuery({
    queryKey: ['room-calendar-day-sessions', roomId, dateKey],
    queryFn: () =>
      sessionsApi.listForRoom(roomId, { from: dayStart, to: dayEnd, limit: 50 }),
    enabled: Boolean(day && day.sessionCount > 0),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['room-calendar-day-tasks', roomId, dateKey],
    queryFn: () => tasksApi.listForRoom(roomId, { status: 'done' }),
    enabled: Boolean(day && day.completedTaskCount > 0),
  });

  const completedOnThisDay = useMemo(() => {
    const all = tasksData?.tasks ?? [];
    return all.filter(
      (t) => t.completedAt && localDateKey(new Date(t.completedAt)) === dateKey,
    );
  }, [tasksData, dateKey]);

  const sessionsOnThisDay = useMemo<PublicSession[]>(() => {
    return sessionsData?.sessions ?? [];
  }, [sessionsData]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">selected</p>
          <h3 className="text-base font-medium">
            {date.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          {day && (
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {formatDuration(day.totalDuration)} tracked
            </p>
          )}
        </div>

        <Section title="events" emptyLabel={events.length === 0 ? 'nothing scheduled' : null}>
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-sm">
              <span
                className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', EVENT_DOT[e.type])}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.type} · by {e.createdBy.displayName}
                </p>
              </div>
            </div>
          ))}
        </Section>

        <Section
          title="sessions"
          emptyLabel={sessionsOnThisDay.length === 0 ? 'no tracked work' : null}
        >
          {sessionsOnThisDay.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{s.intent}</p>
                <p className="text-xs text-muted-foreground">{s.user.displayName}</p>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {s.duration !== null ? formatDuration(s.duration, { compact: true }) : '—'}
              </span>
            </div>
          ))}
        </Section>

        <Section
          title="tasks done"
          emptyLabel={completedOnThisDay.length === 0 ? 'none yet' : null}
        >
          {completedOnThisDay.map((t) => (
            <div key={t.id} className="text-sm">
              <p className="truncate">{t.title}</p>
              {t.assignee && (
                <p className="text-xs text-muted-foreground">{t.assignee.displayName}</p>
              )}
            </div>
          ))}
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {emptyLabel ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
