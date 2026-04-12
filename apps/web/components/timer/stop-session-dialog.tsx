'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { stopSessionSchema, type StopSessionInput, type PublicSession } from '@workra/shared';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sessionsApi } from '@/lib/api/sessions';
import { ApiError } from '@/lib/api/client';
import { useTimerStore } from '@/lib/timer/store';
import { formatDuration } from '@/lib/format/time';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: PublicSession;
  elapsedMs: number;
}

export function StopSessionDialog({ open, onOpenChange, session, elapsedMs }: Props) {
  const qc = useQueryClient();
  const setActive = useTimerStore((s) => s.setActive);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<StopSessionInput>({
    resolver: zodResolver(stopSessionSchema),
    defaultValues: { summary: '' },
  });

  const [suggesting, setSuggesting] = useState(false);
  const [suggestionSource, setSuggestionSource] = useState<'ai' | 'system' | null>(null);
  // remembers the last elapsed we requested a suggestion for so reopening the
  // dialog in quick succession doesn't spam the ai endpoint.
  const lastRequestedRef = useRef<number | null>(null);

  // clear state when the dialog closes so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      lastRequestedRef.current = null;
      setSuggestionSource(null);
      reset({ summary: '' });
    }
  }, [open, reset]);

  const fetchSuggestion = async () => {
    // snap to the nearest 10 seconds so multiple requests in the same few
    // ticks don't all hit the endpoint. non-blocking UX: we never await before
    // showing the dialog — the user can keep typing their own summary.
    const snapped = Math.floor(elapsedMs / 10000) * 10000;
    if (lastRequestedRef.current === snapped) return;
    lastRequestedRef.current = snapped;

    setSuggesting(true);
    try {
      const res = await sessionsApi.suggestSummary(snapped);
      // only apply the suggestion if the textarea is still empty — the user may
      // have already started typing, and we never want to stomp on their input.
      const current = getValues('summary') ?? '';
      if (current.trim().length === 0) {
        setValue('summary', res.suggestion, { shouldDirty: true });
      }
      setSuggestionSource(res.aiGenerated ? 'ai' : 'system');
    } catch {
      // silent fail — suggestion is optional. the user can still type freely.
      lastRequestedRef.current = null;
    } finally {
      setSuggesting(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: StopSessionInput =
        values.summary && values.summary.trim().length > 0 ? { summary: values.summary } : {};
      await sessionsApi.stop(payload);
      setActive(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['session', 'active'] }),
        qc.invalidateQueries({ queryKey: ['sessions', session.roomId] }),
        qc.invalidateQueries({ queryKey: ['session-stats', session.roomId] }),
        qc.invalidateQueries({ queryKey: ['activity', session.roomId] }),
      ]);
      if (session.linkedTaskId) {
        await qc.invalidateQueries({ queryKey: ['task', session.linkedTaskId, 'sessions'] });
      }
      reset();
      onOpenChange(false);
      toast.success('session saved');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'could not stop session';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>stop session</DialogTitle>
          <DialogDescription>
            you worked on <span className="text-foreground">{session.intent}</span> for{' '}
            <span className="font-mono text-foreground">{formatDuration(elapsedMs)}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="session-summary">summary (optional)</Label>
              <button
                type="button"
                onClick={fetchSuggestion}
                disabled={suggesting}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {suggesting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> thinking
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> suggest
                  </>
                )}
              </button>
            </div>
            <Textarea
              id="session-summary"
              autoFocus
              maxLength={1000}
              placeholder="what got done? leave blank if you'd rather not say."
              {...register('summary')}
            />
            {suggestionSource && (
              <p className="text-xs text-muted-foreground">
                {suggestionSource === 'ai'
                  ? 'suggestion drafted by ai — edit freely.'
                  : 'suggestion drafted from your intent — edit freely.'}
              </p>
            )}
            {errors.summary && <p className="text-xs text-destructive">{errors.summary.message}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              keep going
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'saving…' : 'save and stop'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
