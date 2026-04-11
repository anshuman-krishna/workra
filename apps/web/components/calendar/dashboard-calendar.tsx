'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardCalendarDay } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { calendarApi } from '@/lib/api/calendar';
import { formatDuration, localDateKey } from '@/lib/format/time';
import { HEAT_CLASSES, heatLevel } from '@/lib/calendar/heatmap';
import { cn } from '@/lib/utils';

// builds a 53-week x 7-day grid ending on today, rolling back a full year.
// columns are weeks (sunday->saturday); rows are days.
interface Cell {
  date: Date;
  key: string;
  inRange: boolean;
}

function buildYearGrid(end: Date): Cell[][] {
  // align end to the saturday of its week so the last column is complete
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  last.setDate(last.getDate() + (6 - last.getDay()));

  const rangeStart = new Date(end);
  rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  rangeStart.setHours(0, 0, 0, 0);

  // 53 weeks is the standard contribution graph width
  const columns: Cell[][] = [];
  const cursor = new Date(last);
  // step back 52 weeks (53 columns total once we include the final one)
  cursor.setDate(cursor.getDate() - 52 * 7 - 6);

  for (let w = 0; w < 53; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(cursor);
      cellDate.setDate(cursor.getDate() + w * 7 + d);
      col.push({
        date: cellDate,
        key: localDateKey(cellDate),
        inRange: cellDate >= rangeStart && cellDate <= end,
      });
    }
    columns.push(col);
  }
  return columns;
}

export function DashboardCalendar() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const grid = useMemo(() => buildYearGrid(today), [today]);
  const rangeStart = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [today]);

  const [hovered, setHovered] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-calendar', localDateKey(rangeStart), localDateKey(today)],
    queryFn: () =>
      calendarApi.dashboardCalendar({
        from: localDateKey(rangeStart),
        to: localDateKey(today),
      }),
  });

  const dayMap = useMemo(() => {
    const map = new Map<string, DashboardCalendarDay>();
    for (const d of data?.days ?? []) map.set(d.date, d);
    return map;
  }, [data]);

  const maxDuration = useMemo(() => {
    let max = 0;
    for (const d of dayMap.values()) if (d.totalDuration > max) max = d.totalDuration;
    return max;
  }, [dayMap]);

  const totals = useMemo(() => {
    let totalDuration = 0;
    let sessionCount = 0;
    let activeDays = 0;
    for (const d of dayMap.values()) {
      totalDuration += d.totalDuration;
      sessionCount += d.sessionCount;
      if (d.totalDuration > 0) activeDays += 1;
    }
    return { totalDuration, sessionCount, activeDays };
  }, [dayMap]);

  const hoveredDay = hovered ? dayMap.get(hovered) : null;
  const hoveredDate = hovered ? new Date(`${hovered}T00:00:00`) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              last 12 months
            </p>
            <p className="mt-1 font-mono text-2xl">{formatDuration(totals.totalDuration)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">sessions</p>
            <p className="mt-1 font-mono text-2xl">{totals.sessionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">active days</p>
            <p className="mt-1 font-mono text-2xl">{totals.activeDays}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">loading…</p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <div className="inline-flex gap-[3px]">
                  {grid.map((column, i) => (
                    <div key={i} className="flex flex-col gap-[3px]">
                      {column.map((cell) => {
                        if (!cell.inRange) {
                          return (
                            <div
                              key={cell.key}
                              className="h-3 w-3 rounded-[2px] bg-transparent"
                              aria-hidden
                            />
                          );
                        }
                        const day = dayMap.get(cell.key);
                        const level = day ? heatLevel(day.totalDuration, maxDuration) : 0;
                        return (
                          <button
                            type="button"
                            key={cell.key}
                            onMouseEnter={() => setHovered(cell.key)}
                            onMouseLeave={() => setHovered((h) => (h === cell.key ? null : h))}
                            onFocus={() => setHovered(cell.key)}
                            className={cn(
                              'h-3 w-3 rounded-[2px] border border-border/30 transition-transform hover:scale-110 focus:outline-none focus:ring-1 focus:ring-foreground',
                              HEAT_CLASSES[level],
                            )}
                            aria-label={`${cell.key}: ${
                              day ? formatDuration(day.totalDuration) : 'no work'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>less</span>
                  {[0, 1, 2, 3, 4].map((l) => (
                    <span
                      key={l}
                      className={cn('h-3 w-3 rounded-[2px] border border-border/30', HEAT_CLASSES[l as 0 | 1 | 2 | 3 | 4])}
                    />
                  ))}
                  <span>more</span>
                </div>
                {hoveredDay && hoveredDate ? (
                  <p className="font-mono">
                    {hoveredDate.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    · {formatDuration(hoveredDay.totalDuration)} · {hoveredDay.sessionCount} session
                    {hoveredDay.sessionCount === 1 ? '' : 's'}
                  </p>
                ) : (
                  <p>hover a day for details</p>
                )}
              </div>

              {hoveredDay && hoveredDay.rooms.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    by room
                  </p>
                  <ul className="space-y-1 text-sm">
                    {hoveredDay.rooms.map((r) => (
                      <li
                        key={r.roomId}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{r.roomName}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {formatDuration(r.totalDuration)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
