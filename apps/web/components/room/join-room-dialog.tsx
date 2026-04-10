'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { joinRoomSchema, type JoinRoomInput } from '@workra/shared';

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

export function JoinRoomDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JoinRoomInput>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { room } = await roomsApi.join(values);
      await qc.invalidateQueries({ queryKey: ['rooms'] });
      reset();
      onOpenChange(false);
      toast.success(`joined ${room.name}`);
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'could not join room';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>join a room</DialogTitle>
          <DialogDescription>enter the 6-character invite code.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-code">invite code</Label>
            <Input
              id="invite-code"
              autoFocus
              maxLength={6}
              className="font-mono uppercase tracking-widest"
              {...register('code')}
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
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
              {isSubmitting ? 'joining…' : 'join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
