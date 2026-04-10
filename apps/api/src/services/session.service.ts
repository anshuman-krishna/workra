import mongoose from 'mongoose';
import { Session, type SessionDoc } from '../models/session.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import type { ListSessionsQuery, PublicSession, SessionStat } from '@workra/shared';

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function toPublicSession(session: SessionDoc, user: PopulatedUser): PublicSession {
  const ts = session as unknown as { createdAt: Date };
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
    createdAt: ts.createdAt.toISOString(),
  };
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

export async function startSession(
  userId: string,
  roomId: string,
  intent: string,
): Promise<PublicSession> {
  await assertMember(userId, roomId);

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
      intent,
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
    metadata: { intent, sessionId: String(session._id) },
  });

  const member = await loadUserMember(userId);
  return toPublicSession(session, member);
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
    metadata: {
      sessionId: String(active._id),
      intent: active.intent,
      duration,
    },
  });

  const member = await loadUserMember(userId);
  return toPublicSession(active, member);
}

export async function getActiveSession(userId: string): Promise<PublicSession | null> {
  const active = await Session.findOne({ userId, endTime: null });
  if (!active) return null;
  const member = await loadUserMember(userId);
  return toPublicSession(active, member);
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
  const sessions = await Session.find(filter).sort({ startTime: -1 }).limit(limit);
  if (sessions.length === 0) return [];

  const userIds = Array.from(new Set(sessions.map((s) => String(s.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName avatarSeed')
    .lean();
  const memberMap = new Map<string, PopulatedUser>(
    users.map((u) => [String(u._id), u as unknown as PopulatedUser]),
  );

  return sessions.map((s) => {
    const u = memberMap.get(String(s.userId));
    if (!u) {
      // user deleted but session lingers — synthesize a placeholder member
      return toPublicSession(s, {
        _id: s.userId as unknown as mongoose.Types.ObjectId,
        displayName: 'unknown',
        avatarSeed: '00000000',
      });
    }
    return toPublicSession(s, u);
  });
}

export async function getRoomSessionStats(roomId: string): Promise<SessionStat[]> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const stats = await Session.aggregate<{ _id: string; totalDuration: number }>([
    {
      $match: {
        roomId: new mongoose.Types.ObjectId(roomId),
        endTime: { $ne: null },
        duration: { $ne: null },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
        totalDuration: { $sum: '$duration' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return stats.map((s) => ({ date: s._id, totalDuration: s.totalDuration }));
}

// exported for tests / future need
export { toPublicSession };
