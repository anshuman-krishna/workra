import mongoose from 'mongoose';
import { Session, type SessionDoc } from '../models/session.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { Task } from '../models/task.model.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import * as ai from './ai.service.js';
import * as realtime from '../realtime/emit.js';
import type {
  ListSessionsQuery,
  PublicSession,
  SessionStat,
  SuggestSessionSummaryResponse,
  TaskRef,
} from '@workra/shared';

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function toPublicSession(
  session: SessionDoc,
  user: PopulatedUser,
  linkedTask: TaskRef | null = null,
): PublicSession {
  return {
    id: String(session._id),
    userId: String(session.userId),
    roomId: String(session.roomId),
    user: {
      id: String(user._id),
      displayName: user.displayName,
      avatarSeed: user.avatarSeed,
    },
    startTime: session.startTime.toISOString(),
    endTime: session.endTime ? session.endTime.toISOString() : null,
    duration: session.duration ?? null,
    intent: session.intent,
    summary: session.summary ?? null,
    linkedTaskId: session.linkedTaskId ? String(session.linkedTaskId) : null,
    linkedTask,
    createdAt: session.createdAt.toISOString(),
  };
}

interface TaskRefRow {
  _id: mongoose.Types.ObjectId;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
}

async function loadTaskRefMap(taskIds: string[]): Promise<Map<string, TaskRef>> {
  if (taskIds.length === 0) return new Map();
  const rows = await Task.find({ _id: { $in: taskIds } })
    .select('title status')
    .lean();
  const refs = rows as unknown as TaskRefRow[];
  return new Map(
    refs.map((t) => [
      String(t._id),
      { id: String(t._id), title: t.title, status: t.status },
    ]),
  );
}

async function loadTaskRef(taskId: mongoose.Types.ObjectId | null): Promise<TaskRef | null> {
  if (!taskId) return null;
  const row = (await Task.findById(taskId).select('title status').lean()) as unknown as
    | TaskRefRow
    | null;
  if (!row) return null;
  return { id: String(row._id), title: row.title, status: row.status };
}

async function loadUserMember(userId: string): Promise<PopulatedUser> {
  const user = await User.findById(userId).select('displayName avatarSeed').lean();
  if (!user) throw notFound('user not found');
  return user as unknown as PopulatedUser;
}

async function assertMember(userId: string, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');
  return membership;
}

interface StartSessionInput {
  intent: string;
  linkedTaskId?: string | null;
}

export async function startSession(
  userId: string,
  roomId: string,
  input: StartSessionInput,
): Promise<PublicSession> {
  await assertMember(userId, roomId);

  // validate the linked task lives in the same room before we touch sessions
  let linkedTaskRef: TaskRef | null = null;
  let linkedTaskObjectId: mongoose.Types.ObjectId | null = null;
  if (input.linkedTaskId) {
    if (!mongoose.isValidObjectId(input.linkedTaskId)) {
      throw badRequest('invalid task id');
    }
    const task = await Task.findOne({ _id: input.linkedTaskId, roomId });
    if (!task) throw badRequest('task does not belong to this room');
    linkedTaskObjectId = task._id as mongoose.Types.ObjectId;
    linkedTaskRef = { id: String(task._id), title: task.title, status: task.status };
  }

  // soft check first for a clean error message
  const existing = await Session.findOne({ userId, endTime: null });
  if (existing) {
    throw conflict('you already have an active session');
  }

  let session: SessionDoc;
  try {
    session = await Session.create({
      userId: new mongoose.Types.ObjectId(userId),
      roomId: new mongoose.Types.ObjectId(roomId),
      startTime: new Date(),
      intent: input.intent,
      linkedTaskId: linkedTaskObjectId,
    });
  } catch (err) {
    // partial unique index race
    if ((err as { code?: number }).code === 11000) {
      throw conflict('you already have an active session');
    }
    throw err;
  }

  void activityLog.record({
    userId,
    roomId,
    type: 'session_started',
    entityId: String(session._id),
    metadata: {
      intent: input.intent,
      linkedTaskId: linkedTaskRef?.id ?? null,
    },
  });

  const member = await loadUserMember(userId);
  const payload = toPublicSession(session, member, linkedTaskRef);
  realtime.emitSessionStarted(roomId, payload);
  return payload;
}

export async function stopSession(
  userId: string,
  summary?: string,
): Promise<PublicSession> {
  const active = await Session.findOne({ userId, endTime: null });
  if (!active) {
    throw badRequest('no active session to stop');
  }

  const endTime = new Date();
  const duration = Math.max(0, endTime.getTime() - active.startTime.getTime());

  active.endTime = endTime;
  active.duration = duration;
  if (summary !== undefined) active.summary = summary;
  await active.save();

  void activityLog.record({
    userId,
    roomId: String(active.roomId),
    type: 'session_completed',
    entityId: String(active._id),
    metadata: {
      intent: active.intent,
      duration,
      linkedTaskId: active.linkedTaskId ? String(active.linkedTaskId) : null,
    },
  });

  const member = await loadUserMember(userId);
  const linkedTask = await loadTaskRef(active.linkedTaskId);
  const payload = toPublicSession(active, member, linkedTask);
  realtime.emitSessionStopped(String(active.roomId), payload);
  return payload;
}

export async function getActiveSession(userId: string): Promise<PublicSession | null> {
  const active = await Session.findOne({ userId, endTime: null });
  if (!active) return null;
  const member = await loadUserMember(userId);
  const linkedTask = await loadTaskRef(active.linkedTaskId);
  return toPublicSession(active, member, linkedTask);
}

export async function listRoomSessions(
  roomId: string,
  query: ListSessionsQuery,
): Promise<PublicSession[]> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');

  const filter: Record<string, unknown> = { roomId };
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    filter.startTime = range;
  }
  if (query.userId) filter.userId = query.userId;
  if (query.hasSummary !== undefined) {
    filter.summary = query.hasSummary
      ? { $ne: null, $exists: true }
      : { $in: [null, ''] };
  }

  const limit = query.limit ?? 100;
  // secondary sort on _id keeps ordering deterministic when two sessions share a
  // start instant (happens when imported from timers that snap to the minute).
  const sessions = await Session.find(filter).sort({ startTime: -1, _id: 1 }).limit(limit);
  if (sessions.length === 0) return [];

  const userIds = Array.from(new Set(sessions.map((s) => String(s.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName avatarSeed')
    .lean();
  const memberMap = new Map<string, PopulatedUser>(
    users.map((u) => [String(u._id), u as unknown as PopulatedUser]),
  );

  const taskIds = Array.from(
    new Set(
      sessions
        .map((s) => (s.linkedTaskId ? String(s.linkedTaskId) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const taskMap = await loadTaskRefMap(taskIds);

  return sessions.map((s) => {
    const u = memberMap.get(String(s.userId));
    const member = u ?? {
      _id: s.userId as unknown as mongoose.Types.ObjectId,
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    const taskRef = s.linkedTaskId ? taskMap.get(String(s.linkedTaskId)) ?? null : null;
    return toPublicSession(s, member, taskRef);
  });
}

interface StatsRange {
  from?: Date;
  to?: Date;
}

export async function getRoomSessionStats(
  roomId: string,
  range: StatsRange = {},
): Promise<SessionStat[]> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');

  const match: Record<string, unknown> = {
    roomId: new mongoose.Types.ObjectId(roomId),
    endTime: { $ne: null },
    duration: { $ne: null },
  };
  if (range.from || range.to) {
    const startRange: Record<string, Date> = {};
    if (range.from) startRange.$gte = range.from;
    if (range.to) startRange.$lte = range.to;
    match.startTime = startRange;
  }

  const stats = await Session.aggregate<{
    _id: string;
    totalDuration: number;
    sessionCount: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
        totalDuration: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return stats.map((s) => ({
    date: s._id,
    totalDuration: s.totalDuration,
    sessionCount: s.sessionCount,
  }));
}

// ask the ai layer for a draft summary of the user's active session. the caller
// can pass the elapsed ms they've already computed on the client so the duration
// label in the prompt matches what the user is staring at. falls back to a
// deterministic single-sentence synthesis when the ai layer is disabled.
export async function suggestActiveSessionSummary(
  userId: string,
  elapsedMsOverride?: number,
): Promise<SuggestSessionSummaryResponse> {
  const active = await Session.findOne({ userId, endTime: null });
  if (!active) throw badRequest('no active session to summarise');

  const linkedTask = await loadTaskRef(active.linkedTaskId);
  const elapsedMs =
    elapsedMsOverride ?? Math.max(0, Date.now() - active.startTime.getTime());

  const durationLabel = formatElapsed(elapsedMs);
  const fallback = buildFallbackSummary(active.intent, linkedTask?.title ?? null);

  const result = await ai.suggestSessionSummary({
    intent: active.intent,
    linkedTaskTitle: linkedTask?.title ?? null,
    durationLabel,
    fallback,
  });

  return { suggestion: result.text, aiGenerated: result.aiGenerated };
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// deterministic fallback used when ai is disabled or unreachable. keeps the
// user productive without ever throwing. uses the intent verbatim so the user
// sees "something reasonable" rather than a blank textarea.
function buildFallbackSummary(intent: string, linkedTaskTitle: string | null): string {
  const cleaned = intent.trim().replace(/[.!?]+$/, '');
  if (linkedTaskTitle) {
    return `worked on ${linkedTaskTitle}: ${cleaned}.`;
  }
  return `${cleaned}.`;
}

// exported for tests / future need
export { toPublicSession };
