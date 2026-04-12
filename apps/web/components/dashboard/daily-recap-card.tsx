'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import type { DailyRecapResponse } from '@workra/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recapApi } from '@/lib/api/recap';
import { formatDuration } from '@/lib/format/time';

// the dashboard's "how's today going" card. shows tracked hours, session count,
// completed tasks, and a short narrative. the narrative comes from the ai layer
// when enabled, and from a deterministic fallback otherwise — the ui can't tell
// the difference except for a small badge.
export function DailyRecapCard() {
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const query = useQuery({
    queryKey: ['daily-recap', tz ?? 'utc'],
    queryFn: () => recapApi.today(tz),
    // recap numbers shift as sessions stop — refetch when the tab regains focus
    // so you never see a stale "tracked today" figure.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const recap = query.data?.recap ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">today</CardTitle>
        {recap?.aiGenerated && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> ai
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> loading your day…
          </div>
        )}

        {!query.isLoading && recap && <RecapBody recap={recap} />}

        {!query.isLoading && !recap && (
          <p className="text-sm text-muted-foreground">
            couldn&apos;t load today&apos;s recap. try refreshing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecapBody({ recap }: { recap: DailyRecapResponse }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="tracked" value={formatDuration(recap.totalDuration, { compact: true })} />
        <Stat label="sessions" value={String(recap.sessionCount)} />
        <Stat label="done" value={String(recap.completedTaskCount)} />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{recap.narrative}</p>

      {recap.insights.length > 0 && (
        <ul className="space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {recap.insights.map((insight, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50" />
              {insight}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}
