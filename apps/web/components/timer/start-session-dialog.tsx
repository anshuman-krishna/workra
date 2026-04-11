'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startSessionSchema, type StartSessionInput } from '@workra/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sessionsApi } from '@/lib/api/sessions';
import { roomsApi } from '@/lib/api/rooms';
import { tasksApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import { useTimerStore } from '@/lib/timer/store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRoomId?: string;
}

export function StartSessionDialog({ open, onOpenChange, defaultRoomId }: Props) {
  const qc = useQueryClient();
  const setActive = useTimerStore((s) => s.setActive);

  const { data: roomData } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list(),
    enabled: open,
  });

  const rooms = roomData?.rooms ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StartSessionInput>({
    resolver: zodResolver(startSessionSchema),
    defaultValues: { roomId: defaultRoomId ?? '', intent: '', linkedTaskId: null },
  });

  const roomId = watch('roomId');

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', roomId, 'open'],
    queryFn: () => tasksApi.listForRoom(roomId),
    enabled: open && Boolean(roomId),
  });
  // only show open tasks; finished work shouldn't get more sessions linked
  const openTasks = (tasksData?.tasks ?? []).filter((t) => t.status !== 'done');

  useEffect(() => {
    if (!open) return;
    if (defaultRoomId) {
      setValue('roomId', defaultRoomId);
    } else if (rooms.length > 0 && !roomId) {
      setValue('roomId', rooms[0].id);
    }
  }, [open, defaultRoomId, rooms, roomId, setValue]);

  // clear stale task selection when room changes; tasks belong to a single room
  useEffect(() => {
    setValue('linkedTaskId', null);
  }, [roomId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = {
        ...values,
        linkedTaskId: values.linkedTaskId ? values.linkedTaskId : null,
      };
      const { session } = await sessionsApi.start(payload);
      setActive(session);
      // backend is the source of truth; refresh anything that mirrors session state
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['session', 'active'] }),
        qc.invalidateQueries({ queryKey: ['sessions', session.roomId] }),
        qc.invalidateQueries({ queryKey: ['session-stats', session.roomId] }),
        qc.invalidateQueries({ queryKey: ['activity', session.roomId] }),
      ]);
      if (session.linkedTaskId) {
        await qc.invalidateQueries({ queryKey: ['task', session.linkedTaskId, 'sessions'] });
      }
      reset({ roomId: '', intent: '', linkedTaskId: null });
      onOpenChange(false);
      toast.success('session started');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'could not start session';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>start a session</DialogTitle>
          <DialogDescription>
            name the intent before you begin. it shapes the record afterward.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="session-room">room</Label>
            <select
              id="session-room"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('roomId')}
              disabled={Boolean(defaultRoomId) || rooms.length === 0}
            >
              {rooms.length === 0 ? (
                <option value="">no rooms yet</option>
              ) : (
                rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
            {errors.roomId && <p className="text-xs text-destructive">{errors.roomId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-intent">intent</Label>
            <Input
              id="session-intent"
              autoFocus
              maxLength={200}
              placeholder="what are you about to do?"
              {...register('intent')}
            />
            {errors.intent && <p className="text-xs text-destructive">{errors.intent.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-task">linked task (optional)</Label>
            <select
              id="session-task"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('linkedTaskId', { setValueAs: (v) => (v ? v : null) })}
              disabled={openTasks.length === 0}
            >
              <option value="">none</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || rooms.length === 0}>
              {isSubmitting ? 'starting…' : 'start'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
