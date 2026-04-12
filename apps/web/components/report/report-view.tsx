'use client';

import type { ReportResponse } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration, localDateKey } from '@/lib/format/time';
import { cn } from '@/lib/utils';

interface Props {
  report: ReportResponse;
}

export function ReportView({ report }: Props) {
  const { summary, daily, topTasks, sessions, completedTasks } = report;

  // a report with nothing to show collapses into a single calm card rather than
  // a five-card tombstone wall. the header already displays room + range so the
  // reader knows what they were looking at.
  const isEmpty =
    summary.totalDuration === 0 &&
    summary.sessionCount === 0 &&
    summary.taskCompletedCount === 0 &&
    summary.eventCount === 0;

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8 text-center">
          <h3 className="text-sm font-medium">nothing to report yet</h3>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {summary.narrative}
          </p>
          <p className="text-xs text-muted-foreground">
            try a wider range, or start a session in this room.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryRow summary={summary} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-medium">narrative</h3>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {summary.narrative}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopTasks tasks={topTasks} />
        <DailyBreakdown daily={daily} />
      </div>

      <SessionList sessions={sessions} />

      <CompletedTasks tasks={completedTasks} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ summary }: { summary: ReportResponse['summary'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="tracked" value={formatDuration(summary.totalDuration)} />
      <Stat label="sessions" value={String(summary.sessionCount)} />
      <Stat label="tasks done" value={String(summary.taskCompletedCount)} />
      <Stat label="active days" value={String(summary.activeDays)} />
      <Stat label="events" value={String(summary.eventCount)} />
    </div>
  );
}

function TopTasks({ tasks }: { tasks: ReportResponse['topTasks'] }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-medium">top tasks by time</h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">no linked task time in this range.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.map((t) => (
              <li key={t.taskId} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.sessionCount} sessions · {t.status}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDuration(t.totalDuration)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DailyBreakdown({ daily }: { daily: ReportResponse['daily'] }) {
  const maxDuration = daily.reduce((max, d) => Math.max(max, d.totalDuration), 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-medium">daily breakdown</h3>
        {daily.length === 0 ? (
          <p className="text-xs text-muted-foreground">no work on any day in this range.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {daily.map((row) => {
              const pct =
                maxDuration > 0 ? Math.max(4, Math.round((row.totalDuration / maxDuration) * 100)) : 0;
              return (
                <li key={row.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{row.date}</span>
                    <span className="font-mono">
                      {formatDuration(row.totalDuration)}
                      {row.completedTaskCount > 0 && (
                        <span className="ml-2 text-muted-foreground">
                          · {row.completedTaskCount} done
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SessionList({ sessions }: { sessions: ReportResponse['sessions'] }) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-2 text-sm font-medium">sessions</h3>
          <p className="text-xs text-muted-foreground">no sessions in this range.</p>
        </CardContent>
      </Card>
    );
  }

  // group by local day for readable scanning
  const groups = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = localDateKey(new Date(s.startTime));
    const bucket = groups.get(key) ?? [];
    bucket.push(s);
    groups.set(key, bucket);
  }
  const ordered = Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-sm font-medium">sessions</h3>
        <div className="space-y-5">
          {ordered.map(([key, items]) => (
            <section key={key}>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </h4>
              <ul className="space-y-3">
                {items.map((s) => (
                  <li key={s.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium', 'truncate')}>{s.intent}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.user.displayName} ·{' '}
                          {new Date(s.startTime).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs">
                        {s.duration !== null ? formatDuration(s.duration) : '—'}
                      </span>
                    </div>
                    {s.linkedTask && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        linked task: {s.linkedTask.title}
                      </p>
                    )}
                    {s.summary && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {s.summary}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedTasks({ tasks }: { tasks: ReportResponse['completedTasks'] }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-medium">tasks completed</h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">no tasks were completed in this range.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.completedAt
                      ? new Date(t.completedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''}
                    {t.assignee ? ` · ${t.assignee.displayName}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
