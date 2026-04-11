import mongoose from 'mongoose';
import { Session } from '../models/session.model.js';
import { Task } from '../models/task.model.js';
import { Room } from '../models/room.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { forbidden, notFound } from '../utils/errors.js';
import { listRoomSessions } from './session.service.js';
import { listEvents } from './event.service.js';
import type {
  PublicMember,
  PublicSession,
  PublicTask,
  ReportDailyEntry,
  ReportResponse,
  ReportTopTask,
} from '@workra/shared';

interface ReportInput {
  from: string;
  to: string;
  userId?: string;
}

interface RoomRow {
  _id: mongoose.Types.ObjectId;
  name: string;
}

interface TaskRow {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  assignedTo: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function parseRangeBoundary(input: string, end: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  return new Date(input);
}

function formatDurationPretty(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function toPublicTaskRow(row: TaskRow, assignee: PublicMember | null): PublicTask {
  return {
    id: String(row._id),
    roomId: String(row.roomId),
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    assignedTo: row.assignedTo ? String(row.assignedTo) : null,
    assignee,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdBy: String(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildNarrative(summary: {
  totalDuration: number;
  sessionCount: number;
  taskCompletedCount: number;
  activeDays: number;
  rangeDays: number;
  roomName: string;
  scopeLabel: string;
}): string {
  const { totalDuration, sessionCount, taskCompletedCount, activeDays, rangeDays, roomName, scopeLabel } =
    summary;

  if (totalDuration === 0 && sessionCount === 0 && taskCompletedCount === 0) {
    return `no tracked work for ${scopeLabel} in ${roomName} over the selected ${rangeDays} day range.`;
  }

  const pretty = formatDurationPretty(totalDuration);
  const daysLabel = activeDays === 1 ? 'day' : 'days';
  const sessionsLabel = sessionCount === 1 ? 'session' : 'sessions';
  const tasksLabel = taskCompletedCount === 1 ? 'task' : 'tasks';

  const pieces: string[] = [];
  pieces.push(
    `${scopeLabel} logged ${pretty} of focused work across ${sessionCount} ${sessionsLabel} in ${roomName}.`,
  );
  if (activeDays > 0) {
    pieces.push(`active on ${activeDays} ${daysLabel} of the ${rangeDays} day range.`);
  }
  if (taskCompletedCount > 0) {
    pieces.push(`${taskCompletedCount} ${tasksLabel} completed during this period.`);
  }
  return pieces.join(' ');
}

export async function generateRoomReport(
  viewerId: string,
  roomId: string,
  input: ReportInput,
): Promise<ReportResponse> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');

  const membership = await Membership.findOne({ userId: viewerId, roomId });
  if (!membership) throw forbidden('not a member of this room');

  const room = (await Room.findById(roomId).select('name').lean()) as unknown as RoomRow | null;
  if (!room) throw notFound('room not found');

  const from = parseRangeBoundary(input.from, false);
  const to = parseRangeBoundary(input.to, true);
  const roomObjectId = new mongoose.Types.ObjectId(roomId);

  // scope resolution: if userId is passed and not the viewer, ensure they're a
  // member of the same room. otherwise the report would leak.
  let scopeUserId: string | null = null;
  let scopeUser: PublicMember | null = null;
  if (input.userId) {
    if (!mongoose.isValidObjectId(input.userId)) throw notFound('user not found');
    const targetMember = await Membership.findOne({ userId: input.userId, roomId });
    if (!targetMember) throw notFound('that user is not in this room');
    const userRow = (await User.findById(input.userId)
      .select('displayName avatarSeed')
      .lean()) as unknown as UserRow | null;
    if (!userRow) throw notFound('user not found');
    scopeUserId = String(userRow._id);
    scopeUser = {
      id: scopeUserId,
      displayName: userRow.displayName,
      avatarSeed: userRow.avatarSeed,
    };
  }

  // shared session match — reused below for both the list fetch and the aggregations.
  const sessionMatch: Record<string, unknown> = {
    roomId: roomObjectId,
    endTime: { $ne: null },
    duration: { $ne: null },
    startTime: { $gte: from, $lte: to },
  };
  if (scopeUserId) sessionMatch.userId = new mongoose.Types.ObjectId(scopeUserId);

  // headline totals + per-day rollup in one aggregation so we don't scan twice.
  const [daily] = await Promise.all([
    Session.aggregate<{
      _id: string;
      totalDuration: number;
      sessionCount: number;
    }>([
      { $match: sessionMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // top tasks: sum session duration grouped by linkedTaskId, then hydrate titles.
  const topRows = await Session.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalDuration: number;
    sessionCount: number;
  }>([
    { $match: { ...sessionMatch, linkedTaskId: { $ne: null } } },
    {
      $group: {
        _id: '$linkedTaskId',
        totalDuration: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
      },
    },
    { $sort: { totalDuration: -1 } },
    { $limit: 5 },
  ]);

  const topTaskIds = topRows.map((r) => r._id);
  const topTaskDocs =
    topTaskIds.length > 0
      ? ((await Task.find({ _id: { $in: topTaskIds } })
          .select('title status')
          .lean()) as unknown as Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          status: 'todo' | 'in_progress' | 'done';
        }>)
      : [];
  const topTaskMap = new Map(topTaskDocs.map((t) => [String(t._id), t]));

  const topTasks: ReportTopTask[] = topRows.flatMap((r) => {
    const meta = topTaskMap.get(String(r._id));
    if (!meta) return [];
    return [
      {
        taskId: String(r._id),
        title: meta.title,
        status: meta.status,
        totalDuration: r.totalDuration,
        sessionCount: r.sessionCount,
      },
    ];
  });

  // completed tasks in range. we query by completedAt within [from, to]
  // because reporting "what got done this period" is the honest framing.
  const completedTaskFilter: Record<string, unknown> = {
    roomId: roomObjectId,
    status: 'done',
    completedAt: { $gte: from, $lte: to },
  };
  if (scopeUserId) {
    // when scoped to a user, count tasks they were assigned to.
    completedTaskFilter.assignedTo = new mongoose.Types.ObjectId(scopeUserId);
  }
  const completedRows = (await Task.find(completedTaskFilter)
    .sort({ completedAt: -1 })
    .lean()) as unknown as TaskRow[];

  // hydrate assignees for completed tasks in one query
  const assigneeIds = Array.from(
    new Set(
      completedRows
        .map((t) => (t.assignedTo ? String(t.assignedTo) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const assigneeRows =
    assigneeIds.length > 0
      ? ((await User.find({ _id: { $in: assigneeIds } })
          .select('displayName avatarSeed')
          .lean()) as unknown as UserRow[])
      : [];
  const assigneeMap = new Map<string, PublicMember>(
    assigneeRows.map((u) => [
      String(u._id),
      { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed },
    ]),
  );

  const completedTasks: PublicTask[] = completedRows.map((t) =>
    toPublicTaskRow(t, t.assignedTo ? assigneeMap.get(String(t.assignedTo)) ?? null : null),
  );

  // session list for the narrative — reuses listRoomSessions for consistent shape
  const sessions: PublicSession[] = await listRoomSessions(roomId, {
    from: input.from,
    to: input.to,
    userId: scopeUserId ?? undefined,
    limit: 200,
  });

  // events in range. reuse listEvents so membership + serialization stay identical.
  const events = await listEvents(viewerId, roomId, {
    from: input.from,
    to: input.to,
  });

  const totalDuration = daily.reduce((sum, d) => sum + d.totalDuration, 0);
  const sessionCount = daily.reduce((sum, d) => sum + d.sessionCount, 0);
  const activeDays = daily.length;
  const rangeDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const dailyWithTasks: ReportDailyEntry[] = daily.map((d) => ({
    date: d._id,
    totalDuration: d.totalDuration,
    sessionCount: d.sessionCount,
    completedTaskCount: 0,
  }));
  const dailyMap = new Map(dailyWithTasks.map((d) => [d.date, d]));
  // fold completed task counts into the same daily rows
  for (const task of completedRows) {
    if (!task.completedAt) continue;
    const key = task.completedAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(key);
    if (existing) {
      existing.completedTaskCount += 1;
    } else {
      const row: ReportDailyEntry = {
        date: key,
        totalDuration: 0,
        sessionCount: 0,
        completedTaskCount: 1,
      };
      dailyMap.set(key, row);
      dailyWithTasks.push(row);
    }
  }
  dailyWithTasks.sort((a, b) => a.date.localeCompare(b.date));

  const scopeLabel = scopeUser ? scopeUser.displayName : 'the team';
  const narrative = buildNarrative({
    totalDuration,
    sessionCount,
    taskCompletedCount: completedTasks.length,
    activeDays,
    rangeDays,
    roomName: room.name,
    scopeLabel,
  });

  return {
    room: { id: String(room._id), name: room.name },
    range: { from: input.from, to: input.to },
    scope: { userId: scopeUserId, user: scopeUser },
    summary: {
      totalDuration,
      sessionCount,
      taskCompletedCount: completedTasks.length,
      activeDays,
      eventCount: events.length,
      narrative,
    },
    daily: dailyWithTasks,
    topTasks,
    sessions,
    completedTasks,
    events,
    generatedAt: new Date().toISOString(),
  };
}
