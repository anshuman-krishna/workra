import mongoose from 'mongoose';
import { Session } from '../models/session.model.js';
import { Task } from '../models/task.model.js';
import { EventModel } from '../models/event.model.js';
import { Membership } from '../models/membership.model.js';
import { Room } from '../models/room.model.js';
import { forbidden, notFound } from '../utils/errors.js';
import { listEvents } from './event.service.js';
import type {
  CalendarDay,
  DashboardCalendarDay,
  DashboardCalendarResponse,
  PublicEvent,
  RoomCalendarResponse,
} from '@workra/shared';

interface Range {
  from?: string;
  to?: string;
}

interface AggRow {
  _id: string;
  count: number;
  totalDuration?: number;
}

// parses the inclusive range the frontend passes. the frontend always sends full
// month bounds, but we tolerate partial / missing inputs and fall back to "all time".
function parseRange(range: Range): { from?: Date; to?: Date } {
  const out: { from?: Date; to?: Date } = {};
  if (range.from) {
    out.from = /^\d{4}-\d{2}-\d{2}$/.test(range.from)
      ? new Date(`${range.from}T00:00:00.000Z`)
      : new Date(range.from);
  }
  if (range.to) {
    out.to = /^\d{4}-\d{2}-\d{2}$/.test(range.to)
      ? new Date(`${range.to}T23:59:59.999Z`)
      : new Date(range.to);
  }
  return out;
}

function emptyDay(date: string): CalendarDay {
  return {
    date,
    totalDuration: 0,
    sessionCount: 0,
    completedTaskCount: 0,
    eventCount: 0,
  };
}

// merges rows from three independent aggregations (sessions, completed tasks, events)
// into one row per date. sort order is ascending by date.
function mergeDays(
  sessionRows: Array<{ _id: string; totalDuration: number; sessionCount: number }>,
  taskRows: AggRow[],
  eventRows: AggRow[],
): CalendarDay[] {
  const map = new Map<string, CalendarDay>();

  for (const r of sessionRows) {
    const day = map.get(r._id) ?? emptyDay(r._id);
    day.totalDuration = r.totalDuration;
    day.sessionCount = r.sessionCount;
    map.set(r._id, day);
  }
  for (const r of taskRows) {
    const day = map.get(r._id) ?? emptyDay(r._id);
    day.completedTaskCount = r.count;
    map.set(r._id, day);
  }
  for (const r of eventRows) {
    const day = map.get(r._id) ?? emptyDay(r._id);
    day.eventCount = r.count;
    map.set(r._id, day);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRoomCalendar(
  userId: string,
  roomId: string,
  range: Range,
): Promise<RoomCalendarResponse> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');

  const { from, to } = parseRange(range);
  const roomObjectId = new mongoose.Types.ObjectId(roomId);

  // sessions: sum duration + count, grouped by start date (utc day)
  const sessionMatch: Record<string, unknown> = {
    roomId: roomObjectId,
    endTime: { $ne: null },
    duration: { $ne: null },
  };
  if (from || to) {
    const startRange: Record<string, Date> = {};
    if (from) startRange.$gte = from;
    if (to) startRange.$lte = to;
    sessionMatch.startTime = startRange;
  }

  const sessionRows = await Session.aggregate<{
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
  ]);

  // completed tasks: grouped by completion date
  const taskMatch: Record<string, unknown> = {
    roomId: roomObjectId,
    status: 'done',
    completedAt: { $ne: null },
  };
  if (from || to) {
    const cRange: Record<string, Date> = {};
    if (from) cRange.$gte = from;
    if (to) cRange.$lte = to;
    (taskMatch.completedAt as Record<string, unknown>) = {
      ...(taskMatch.completedAt as Record<string, unknown>),
      ...cRange,
    };
  }

  const taskRows = await Task.aggregate<AggRow>([
    { $match: taskMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
        count: { $sum: 1 },
      },
    },
  ]);

  // events: grouped by their scheduled date
  const eventMatch: Record<string, unknown> = { roomId: roomObjectId };
  if (from || to) {
    const eRange: Record<string, Date> = {};
    if (from) eRange.$gte = from;
    if (to) eRange.$lte = to;
    eventMatch.date = eRange;
  }

  const eventRows = await EventModel.aggregate<AggRow>([
    { $match: eventMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 },
      },
    },
  ]);

  const days = mergeDays(sessionRows, taskRows, eventRows);

  // also return the full event list so the day panel can render titles without a
  // second round trip. reuses the normal list path so serialization stays identical.
  const events: PublicEvent[] = await listEvents(userId, roomId, {
    from: range.from,
    to: range.to,
  });

  return { days, events };
}

interface RoomRow {
  _id: mongoose.Types.ObjectId;
  name: string;
}

export async function getDashboardCalendar(
  userId: string,
  range: Range,
): Promise<DashboardCalendarResponse> {
  const { from, to } = parseRange(range);

  // rooms the user is a member of — the aggregation only considers these
  const memberships = await Membership.find({ userId }).select('roomId').lean();
  const roomIds = memberships.map((m) => m.roomId as unknown as mongoose.Types.ObjectId);
  if (roomIds.length === 0) return { days: [] };

  const rooms = (await Room.find({ _id: { $in: roomIds } })
    .select('name')
    .lean()) as unknown as RoomRow[];
  const roomNameMap = new Map<string, string>(
    rooms.map((r) => [String(r._id), r.name]),
  );

  const sessionMatch: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    roomId: { $in: roomIds },
    endTime: { $ne: null },
    duration: { $ne: null },
  };
  if (from || to) {
    const startRange: Record<string, Date> = {};
    if (from) startRange.$gte = from;
    if (to) startRange.$lte = to;
    sessionMatch.startTime = startRange;
  }

  const rows = await Session.aggregate<{
    _id: { date: string; roomId: mongoose.Types.ObjectId };
    totalDuration: number;
    sessionCount: number;
  }>([
    { $match: sessionMatch },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          roomId: '$roomId',
        },
        totalDuration: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
      },
    },
  ]);

  // fold per-room rows into per-day rollups with a breakdown
  const dayMap = new Map<string, DashboardCalendarDay>();
  for (const row of rows) {
    const date = row._id.date;
    const roomId = String(row._id.roomId);
    const existing =
      dayMap.get(date) ?? { date, totalDuration: 0, sessionCount: 0, rooms: [] };
    existing.totalDuration += row.totalDuration;
    existing.sessionCount += row.sessionCount;
    existing.rooms.push({
      roomId,
      roomName: roomNameMap.get(roomId) ?? 'unknown',
      totalDuration: row.totalDuration,
      sessionCount: row.sessionCount,
    });
    dayMap.set(date, existing);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { days };
}
