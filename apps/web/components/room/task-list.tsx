'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Circle, Loader2, Timer, Trash2 } from 'lucide-react';
import type { PublicTask, TaskStatus } from '@workra/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { tasksApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/format/time';

interface Props {
  tasks: PublicTask[];
  roomId: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'to do',
  in_progress: 'in progress',
  done: 'done',
};

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// click cycle: todo → in_progress → done → in_progress (reopen). never cycles back to todo.
function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'todo') return 'in_progress';
  if (status === 'in_progress') return 'done';
  return 'in_progress';
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return <Check className="h-4 w-4" />;
  if (status === 'in_progress') return <Loader2 className="h-4 w-4" />;
  return <Circle className="h-4 w-4" />;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdue(iso: string, status: TaskStatus): boolean {
  if (status === 'done') return false;
  return new Date(iso).getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

export function TaskList({ tasks, roomId }: Props) {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }));

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <h2 className="text-base font-medium">no tasks yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            add the first thing you need to get done in this room.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.status}>
          <header className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">{STATUS_LABEL[group.status]}</h3>
            <span className="text-xs text-muted-foreground">{group.items.length}</span>
          </header>
          {group.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">nothing here.</p>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {group.items.map((task) => (
                  <TaskRow key={task.id} task={task} roomId={roomId} />
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}

function TaskRow({ task, roomId }: { task: PublicTask; roomId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.update(task.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', roomId] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not update task');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', roomId] });
      qc.invalidateQueries({ queryKey: ['sessions', roomId] });
      toast.success('task deleted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'could not delete task');
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ['task', task.id, 'sessions'],
    queryFn: () => tasksApi.sessionsForTask(task.id),
    enabled: expanded,
  });

  const due = task.dueDate ? formatDueDate(task.dueDate) : null;
  const overdue = task.dueDate ? isOverdue(task.dueDate, task.status) : false;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => updateMutation.mutate(nextStatus(task.status))}
          disabled={updateMutation.isPending}
          aria-label={`mark ${task.title} as ${nextStatus(task.status)}`}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
            task.status === 'done'
              ? 'border-foreground bg-foreground text-background'
              : 'border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground',
          )}
        >
          <StatusIcon status={task.status} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-medium',
              task.status === 'done' && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {task.assignee && (
              <span className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {initials(task.assignee.displayName)}
                  </AvatarFallback>
                </Avatar>
                {task.assignee.displayName}
              </span>
            )}
            {due && (
              <span className={cn(overdue && 'text-destructive')}>
                due {due}
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              sessions
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm(`delete "${task.title}"?`)) deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="ml-9 mt-3 rounded-md border bg-muted/30 px-3 py-2">
          {sessionsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">loading…</p>
          ) : sessionsQuery.data?.sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">no sessions linked to this task yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {sessionsQuery.data?.sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    <span className="truncate text-foreground">{s.intent}</span>
                    <span>· {s.user.displayName}</span>
                  </span>
                  <span className="font-mono">
                    {s.duration ? formatDuration(s.duration) : 'live'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
