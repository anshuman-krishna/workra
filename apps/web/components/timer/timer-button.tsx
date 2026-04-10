'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, Square, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimerStore } from '@/lib/timer/store';
import { formatDuration } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import { StartSessionDialog } from './start-session-dialog';
import { StopSessionDialog } from './stop-session-dialog';

export function TimerButton({ defaultRoomId }: { defaultRoomId?: string } = {}) {
  const active = useTimerStore((s) => s.active);
  const hydrated = useTimerStore((s) => s.hydrated);
  const [now, setNow] = useState(() => Date.now());
  const [startOpen, setStartOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedMs = useMemo(() => {
    if (!active) return 0;
    return now - new Date(active.startTime).getTime();
  }, [active, now]);

  if (!hydrated) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        <span className="font-mono">--:--:--</span>
      </div>
    );
  }

  if (!active) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => setStartOpen(true)}
        >
          <Play className="h-3.5 w-3.5" />
          start session
        </Button>
        <StartSessionDialog open={startOpen} onOpenChange={setStartOpen} defaultRoomId={defaultRoomId} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStopOpen(true)}
        className={cn(
          'group flex items-center gap-3 rounded-md border bg-card px-3 py-1.5 text-left transition-colors hover:border-foreground/30',
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
        </span>
        <span className="hidden flex-col leading-tight md:flex">
          <span className="max-w-[160px] truncate text-xs text-muted-foreground">{active.intent}</span>
          <span className="font-mono text-sm">{formatDuration(elapsedMs)}</span>
        </span>
        <span className="font-mono text-sm md:hidden">{formatDuration(elapsedMs, { compact: true })}</span>
        <Square className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </button>
      <StopSessionDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        session={active}
        elapsedMs={elapsedMs}
      />
    </>
  );
}
