'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createRoomSchema, type CreateRoomInput } from '@workra/shared';

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
import { roomsApi } from '@/lib/api/rooms';
import { ApiError } from '@/lib/api/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { room } = await roomsApi.create(values);
      await qc.invalidateQueries({ queryKey: ['rooms'] });
      reset();
      onOpenChange(false);
      toast.success(`created ${room.name}`);
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'could not create room';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>new room</DialogTitle>
          <DialogDescription>name the client, project, or workspace.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="room-name">name</Label>
            <Input id="room-name" autoFocus {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
