'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/components/room/task-list';
import { CreateTaskDialog } from '@/components/room/create-task-dialog';
import { tasksApi } from '@/lib/api/tasks';

export default function RoomTasksPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', roomId],
    queryFn: () => tasksApi.listForRoom(roomId),
    enabled: Boolean(roomId),
  });

  const tasks = data?.tasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">tasks</h2>
          <p className="text-sm text-muted-foreground">
            small enough to finish, structured enough to track.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          new task
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">loading tasks…</p>
      ) : error ? (
        <p className="text-sm text-destructive">could not load tasks.</p>
      ) : (
        <TaskList tasks={tasks} roomId={roomId} />
      )}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} roomId={roomId} />
    </div>
  );
}
