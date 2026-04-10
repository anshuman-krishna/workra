'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
    formState: { errors, isSubmitting },
  } = useForm<StopSessionInput>({
    resolver: zodResolver(stopSessionSchema),
    defaultValues: { summary: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: StopSessionInput =
        values.summary && values.summary.trim().length > 0 ? { summary: values.summary } : {};
      await sessionsApi.stop(payload);
      setActive(null);
      await qc.invalidateQueries({ queryKey: ['session', 'active'] });
      await qc.invalidateQueries({ queryKey: ['sessions', session.roomId] });
      await qc.invalidateQueries({ queryKey: ['session-stats', session.roomId] });
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
            <Label htmlFor="session-summary">summary (optional)</Label>
            <Textarea
              id="session-summary"
              autoFocus
              maxLength={1000}
              placeholder="what got done? leave blank if you'd rather not say."
              {...register('summary')}
            />
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
