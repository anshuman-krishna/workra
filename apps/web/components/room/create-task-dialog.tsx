'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createTaskSchema, type CreateTaskInput } from '@workra/shared';

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
import { tasksApi } from '@/lib/api/tasks';
import { roomsApi } from '@/lib/api/rooms';
import { ApiError } from '@/lib/api/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}

// the api accepts assignedTo: string | null. our form serializes "" as
// "no one", we strip it before sending.
type FormValues = {
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
};

export function CreateTaskDialog({ open, onOpenChange, roomId }: Props) {
  const qc = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ['room', roomId, 'members'],
    queryFn: () => roomsApi.members(roomId),
    enabled: open && Boolean(roomId),
  });
  const members = membersData?.members ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { title: '', description: '', assignedTo: '', dueDate: '' },
  });

  useEffect(() => {
    if (!open) reset({ title: '', description: '', assignedTo: '', dueDate: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateTaskInput = {
      title: values.title.trim(),
      status: 'todo',
      description: values.description.trim() ? values.description.trim() : undefined,
      assignedTo: values.assignedTo || null,
      dueDate: values.dueDate || null,
    };

    const parsed = createTaskSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'invalid task');
      return;
    }

    try {
      await tasksApi.create(roomId, parsed.data);
      await qc.invalidateQueries({ queryKey: ['tasks', roomId] });
      onOpenChange(false);
      toast.success('task created');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'could not create task';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>new task</DialogTitle>
          <DialogDescription>keep it small enough to finish.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="task-title">title</Label>
            <Input
              id="task-title"
              autoFocus
              maxLength={200}
              placeholder="what needs doing?"
              {...register('title', { required: 'title is required' })}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">notes (optional)</Label>
            <Textarea
              id="task-description"
              maxLength={2000}
              placeholder="anything that helps later."
              {...register('description')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-assignee">assignee</Label>
              <select
                id="task-assignee"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('assignedTo')}
              >
                <option value="">no one</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">due date</Label>
              <Input id="task-due" type="date" {...register('dueDate')} />
            </div>
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
              {isSubmitting ? 'creating…' : 'create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
