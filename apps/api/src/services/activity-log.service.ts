import mongoose from 'mongoose';
import {
  ActivityLog,
  ACTIVITY_CATEGORY,
  type ActivityCategory,
  type ActivityLogDoc,
  type ActivityType,
} from '../models/activity-log.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { forbidden, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ListActivityQuery, PublicActivity, PublicMember } from '@workra/shared';

interface RecordInput {
  userId: string;
  roomId: string;
  type: ActivityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// fire-and-forget: a failed activity write must never break the action that triggered it.
// callers may await this for tests, but production code can ignore the promise.
export async function record(input: RecordInput): Promise<void> {
  try {
    const entityId =
      input.entityId && mongoose.isValidObjectId(input.entityId)
        ? new mongoose.Types.ObjectId(input.entityId)
        : null;

    await ActivityLog.create({
      userId: input.userId,
      roomId: input.roomId,
      type: input.type,
      entityId,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    logger.warn({ err, input }, 'failed to write activity log');
  }
}

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

// human-readable title/subtitle for the timeline. metadata shape mirrors what each
// service writes; missing keys are tolerated since old rows may pre-date a field.
function formatActivity(log: ActivityLogDoc, user: PublicMember): PublicActivity {
  const type = log.type as ActivityType;
  const category = ACTIVITY_CATEGORY[type] ?? 'room';
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  const ts = log as unknown as { createdAt: Date };

  let title = type as string;
  let subtitle: string | null = null;

  switch (type) {
    case 'session_started':
      title = 'started a session';
      subtitle = (meta.intent as string) ?? null;
      break;
    case 'session_completed': {
      title = 'finished a session';
      const dur = typeof meta.duration === 'number' ? formatDurationShort(meta.duration) : null;
      const intent = (meta.intent as string) ?? null;
      subtitle = [intent, dur].filter(Boolean).join(' · ') || null;
      break;
    }
    case 'room_created':
      title = 'created the room';
      subtitle = (meta.name as string) ?? null;
      break;
    case 'room_joined':
      title = 'joined the room';
      break;
    case 'task_created':
      title = 'created a task';
      subtitle = (meta.title as string) ?? null;
      break;
    case 'task_updated':
      title = 'updated a task';
      subtitle = (meta.title as string) ?? null;
      break;
    case 'task_completed':
      title = 'completed a task';
      subtitle = (meta.title as string) ?? null;
      break;
    case 'task_deleted':
      title = 'deleted a task';
      subtitle = (meta.title as string) ?? null;
      break;
    case 'file_uploaded':
      title = 'uploaded a file';
      subtitle = (meta.name as string) ?? null;
      break;
    case 'file_versioned': {
      title = 'uploaded a new version';
      const v = typeof meta.version === 'number' ? `v${meta.version}` : null;
      const name = (meta.name as string) ?? null;
      subtitle = [name, v].filter(Boolean).join(' · ') || null;
      break;
    }
    case 'file_deleted':
      title = 'deleted a file';
      subtitle = (meta.name as string) ?? null;
      break;
  }

  return {
    id: String(log._id),
    type,
    category,
    title,
    subtitle,
    user,
    entityId: log.entityId ? String(log.entityId) : null,
    metadata: meta,
    createdAt: ts.createdAt.toISOString(),
  };
}

function formatDurationShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${totalSeconds}s`;
}

// types belonging to a category, for the room filter dropdown.
function typesForCategory(category: ActivityCategory): ActivityType[] {
  return (Object.keys(ACTIVITY_CATEGORY) as ActivityType[]).filter(
    (t) => ACTIVITY_CATEGORY[t] === category,
  );
}

export async function listRoomActivity(
  userId: string,
  roomId: string,
  query: ListActivityQuery,
): Promise<PublicActivity[]> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');

  const filter: Record<string, unknown> = { roomId };
  if (query.category) filter.type = { $in: typesForCategory(query.category) };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(query.limit ?? 50);
  if (logs.length === 0) return [];

  const userIds = Array.from(new Set(logs.map((l) => String(l.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName avatarSeed')
    .lean();
  const memberMap = new Map<string, PublicMember>(
    (users as unknown as PopulatedUser[]).map((u) => [
      String(u._id),
      { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed },
    ]),
  );

  return logs.map((log) => {
    const member = memberMap.get(String(log.userId)) ?? {
      id: String(log.userId),
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    return formatActivity(log, member);
  });
}
