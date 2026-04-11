'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createEventSchema, EVENT_TYPES, type CreateEventInput, type EventType } from '@workra/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { eventsApi } from '@/lib/api/calendar';
import { ApiError } from '@/lib/api/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  defaultDate?: string;
}

type FormValues = {
  title: string;
  description: string;
  type: EventType;
  date: string;
};

export function CreateEventDialog({ open, onOpenChange, roomId, defaultDate }: Props) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      type: 'deadline',
      date: defaultDate ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({ title: '', description: '', type: 'deadline', date: defaultDate ?? '' });
    }
  }, [open, defaultDate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateEventInput = {
      title: values.title.trim(),
      description: values.description.trim() ? values.description.trim() : undefined,
      type: values.type,
      date: values.date,
    };

    const parsed = createEventSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'invalid event');
      return;
    }

    try {
      await eventsApi.create(roomId, parsed.data);
      // invalidate both the calendar rollup and the raw event list
      await qc.invalidateQueries({ queryKey: ['room-calendar', roomId] });
      await qc.invalidateQueries({ queryKey: ['events', roomId] });
      await qc.invalidateQueries({ queryKey: ['activity', roomId] });
      onOpenChange(false);
      toast.success('event scheduled');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'could not create event');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>new event</DialogTitle>
          <DialogDescription>deadline, meeting, or milestone.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="event-title">title</Label>
            <Input
              id="event-title"
              autoFocus
              maxLength={200}
              placeholder="what is it?"
              {...register('title', { required: 'title is required' })}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-type">type</Label>
              <select
                id="event-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('type')}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date">date</Label>
              <Input
                id="event-date"
                type="date"
                {...register('date', { required: 'date is required' })}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">notes (optional)</Label>
            <Textarea
              id="event-description"
              maxLength={2000}
              placeholder="context for the day."
              {...register('description')}
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'saving…' : 'save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
