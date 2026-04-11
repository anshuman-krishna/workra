import mongoose from 'mongoose';
import { Task, type TaskDoc } from '../models/task.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { Session } from '../models/session.model.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import * as realtime from '../realtime/emit.js';
import type {
  CreateTaskInput,
  ListTasksQuery,
  PublicTask,
  PublicSession,
  TaskStatus,
  UpdateTaskInput,
} from '@workra/shared';
import { toPublicSession } from './session.service.js';

// allowed task state transitions. todo→in_progress→done with reopen via done→in_progress.
// any other change (todo↔done, in_progress→todo, done→todo) is rejected.
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['done'],
  done: ['in_progress'],
};

function assertValidTransition(from: TaskStatus, to: TaskStatus) {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw badRequest(`cannot move task from ${from} to ${to}`);
  }
}

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function toPublicTask(task: TaskDoc, assignee: PopulatedUser | null): PublicTask {
  const ts = task as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: String(task._id),
    roomId: String(task.roomId),
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    assignedTo: task.assignedTo ? String(task.assignedTo) : null,
    assignee: assignee
      ? {
          id: String(assignee._id),
          displayName: assignee.displayName,
          avatarSeed: assignee.avatarSeed,
        }
      : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdBy: String(task.createdBy),
    createdAt: ts.createdAt.toISOString(),
    updatedAt: ts.updatedAt.toISOString(),
  };
}

async function loadAssignee(userId: mongoose.Types.ObjectId | null): Promise<PopulatedUser | null> {
  if (!userId) return null;
  const user = await User.findById(userId).select('displayName avatarSeed').lean();
  return (user as unknown as PopulatedUser) ?? null;
}

async function assertMember(userId: string, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');
  return membership;
}

async function assertAssigneeIsMember(roomId: string, assigneeId: string) {
  if (!mongoose.isValidObjectId(assigneeId)) throw badRequest('invalid assignee');
  const membership = await Membership.findOne({ userId: assigneeId, roomId });
  if (!membership) throw badRequest('assignee is not a member of this room');
}

export async function createTask(
  userId: string,
  roomId: string,
  input: CreateTaskInput,
): Promise<PublicTask> {
  await assertMember(userId, roomId);

  if (input.assignedTo) {
    await assertAssigneeIsMember(roomId, input.assignedTo);
  }

  const task = await Task.create({
    roomId: new mongoose.Types.ObjectId(roomId),
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? 'todo',
    assignedTo: input.assignedTo ? new mongoose.Types.ObjectId(input.assignedTo) : null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  void activityLog.record({
    userId,
    roomId,
    type: 'task_created',
    entityId: String(task._id),
    metadata: { title: task.title },
  });

  const assignee = await loadAssignee(task.assignedTo as mongoose.Types.ObjectId | null);
  const payload = toPublicTask(task, assignee);
  realtime.emitTaskChanged(roomId, { type: 'created', task: payload });
  return payload;
}

export async function listTasks(
  userId: string,
  roomId: string,
  query: ListTasksQuery,
): Promise<PublicTask[]> {
  await assertMember(userId, roomId);

  const filter: Record<string, unknown> = { roomId };
  if (query.status) filter.status = query.status;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;

  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  if (tasks.length === 0) return [];

  const assigneeIds = Array.from(
    new Set(
      tasks
        .map((t) => (t.assignedTo ? String(t.assignedTo) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const users = assigneeIds.length
    ? await User.find({ _id: { $in: assigneeIds } })
        .select('displayName avatarSeed')
        .lean()
    : [];

  const userMap = new Map<string, PopulatedUser>(
    users.map((u) => [String(u._id), u as unknown as PopulatedUser]),
  );

  return tasks.map((t) => {
    const assignee = t.assignedTo ? userMap.get(String(t.assignedTo)) ?? null : null;
    return toPublicTask(t, assignee);
  });
}

async function loadTaskOrThrow(taskId: string): Promise<TaskDoc> {
  if (!mongoose.isValidObjectId(taskId)) throw notFound('task not found');
  const task = await Task.findById(taskId);
  if (!task) throw notFound('task not found');
  return task;
}

export async function getTask(userId: string, taskId: string): Promise<PublicTask> {
  const task = await loadTaskOrThrow(taskId);
  await assertMember(userId, String(task.roomId));
  const assignee = await loadAssignee(task.assignedTo as mongoose.Types.ObjectId | null);
  return toPublicTask(task, assignee);
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<PublicTask> {
  const task = await loadTaskOrThrow(taskId);
  const roomId = String(task.roomId);
  await assertMember(userId, roomId);

  const wasComplete = task.status === 'done';

  if (input.status !== undefined) {
    assertValidTransition(task.status, input.status);
  }

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.status !== undefined) task.status = input.status;
  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }
  if (input.assignedTo !== undefined) {
    if (input.assignedTo) {
      await assertAssigneeIsMember(roomId, input.assignedTo);
      task.assignedTo = new mongoose.Types.ObjectId(input.assignedTo);
    } else {
      task.assignedTo = null;
    }
  }

  // completedAt bookkeeping
  if (input.status === 'done' && !wasComplete) {
    task.completedAt = new Date();
  } else if (input.status !== undefined && input.status !== 'done' && wasComplete) {
    task.completedAt = null;
  }

  await task.save();

  const becameComplete = !wasComplete && task.status === 'done';
  void activityLog.record({
    userId,
    roomId,
    type: becameComplete ? 'task_completed' : 'task_updated',
    entityId: String(task._id),
    metadata: { title: task.title, status: task.status },
  });

  const assignee = await loadAssignee(task.assignedTo as mongoose.Types.ObjectId | null);
  const payload = toPublicTask(task, assignee);
  realtime.emitTaskChanged(roomId, { type: 'updated', task: payload });
  return payload;
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const task = await loadTaskOrThrow(taskId);
  const roomId = String(task.roomId);
  await assertMember(userId, roomId);

  await task.deleteOne();
  // unlink any sessions that pointed at this task so foreign refs don't dangle
  await Session.updateMany({ linkedTaskId: task._id }, { $set: { linkedTaskId: null } });

  void activityLog.record({
    userId,
    roomId,
    type: 'task_deleted',
    entityId: String(task._id),
    metadata: { title: task.title },
  });

  realtime.emitTaskChanged(roomId, { type: 'deleted', taskId: String(task._id) });
}

export async function listSessionsForTask(
  userId: string,
  taskId: string,
): Promise<PublicSession[]> {
  const task = await loadTaskOrThrow(taskId);
  await assertMember(userId, String(task.roomId));

  const sessions = await Session.find({ linkedTaskId: task._id }).sort({ startTime: -1 });
  if (sessions.length === 0) return [];

  const userIds = Array.from(new Set(sessions.map((s) => String(s.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName avatarSeed')
    .lean();
  const userMap = new Map<string, PopulatedUser>(
    users.map((u) => [String(u._id), u as unknown as PopulatedUser]),
  );

  return sessions.map((s) => {
    const u = userMap.get(String(s.userId));
    const member = u ?? {
      _id: s.userId as unknown as mongoose.Types.ObjectId,
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    // sessions linked to this task share the same task ref
    return toPublicSession(s, member, { id: String(task._id), title: task.title, status: task.status });
  });
}
