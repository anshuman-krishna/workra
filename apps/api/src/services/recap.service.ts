import mongoose from 'mongoose';
import { Session } from '../models/session.model.js';
import { Task } from '../models/task.model.js';
import { Room } from '../models/room.model.js';
import { Membership } from '../models/membership.model.js';
import * as ai from './ai.service.js';
import type { DailyRecapResponse } from '@workra/shared';

// narrow row shapes — mongoose .lean() types surface as FlattenMaps noise, so
// we coerce through `unknown` and describe exactly the fields this service uses.
interface SessionRow {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  startTime: Date;
  duration: number | null;
  intent: string;
  summary: string | null;
  linkedTaskId: mongoose.Types.ObjectId | null;
}

interface TaskRow {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignedTo: mongoose.Types.ObjectId | null;
  completedAt: Date | null;
}

interface RoomRow {
  _id: mongoose.Types.ObjectId;
  name: string;
}

// recap lives in its own module because it straddles session, task, and room
// data across every room a user belongs to. putting it in session.service would
// muddy ownership; putting it in user.service would bloat that file.

interface RecapInput {
  tz?: string;
}

function safeTz(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

// returns the utc instants bracketing "today" in the caller's timezone.
function todayRangeInTz(tz: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const label = dtf.format(now); // yyyy-mm-dd

  // compute tz offset at the current instant.
  const offsetDtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = offsetDtf.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? '0' : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMin = Math.round((asUtc - now.getTime()) / 60000);

  const startWall = Date.parse(`${label}T00:00:00.000Z`);
  const endWall = Date.parse(`${label}T23:59:59.999Z`);
  return {
    start: new Date(startWall - offsetMin * 60000),
    end: new Date(endWall - offsetMin * 60000),
    label,
  };
}

function formatDurationPretty(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// deterministic fallback narrative. used when ai is disabled or slow.
function buildRecapFallback(args: {
  label: string;
  tracked: string;
  sessionCount: number;
  taskCompletedCount: number;
}): string {
  if (args.sessionCount === 0 && args.taskCompletedCount === 0) {
    return `nothing tracked yet today (${args.label}). start a session when you're ready.`;
  }
  const bits: string[] = [];
  bits.push(`today you logged ${args.tracked} across ${args.sessionCount} ${args.sessionCount === 1 ? 'session' : 'sessions'}.`);
  if (args.taskCompletedCount > 0) {
    bits.push(
      `${args.taskCompletedCount} ${args.taskCompletedCount === 1 ? 'task' : 'tasks'} completed.`,
    );
  }
  return bits.join(' ');
}

// lightweight insight engine. strict data-in/data-out — no ai, no magic.
// produces 0-3 short bullet observations. phase 4 spec asks for "busiest days,
// most worked-on tasks, gaps in tracking" — all derivable from the raw rows.
interface InsightInput {
  sessionDocs: Array<{ startTime: Date; duration: number | null; linkedTaskId: mongoose.Types.ObjectId | null }>;
  taskTitleById: Map<string, string>;
  dayTotals: Array<{ date: string; total: number }>;
  completedCount: number;
  rangeDays: number;
}

function computeInsights(input: InsightInput): string[] {
  const out: string[] = [];

  // busiest day across the selected range.
  if (input.dayTotals.length > 1) {
    const sorted = input.dayTotals.slice().sort((a, b) => b.total - a.total);
    const busiest = sorted[0];
    if (busiest && busiest.total > 0) {
      out.push(`busiest day: ${busiest.date} with ${formatDurationPretty(busiest.total)}.`);
    }
  }

  // most worked-on task by linked session duration.
  const byTask = new Map<string, number>();
  for (const s of input.sessionDocs) {
    if (!s.linkedTaskId || s.duration == null) continue;
    const key = String(s.linkedTaskId);
    byTask.set(key, (byTask.get(key) ?? 0) + s.duration);
  }
  if (byTask.size > 0) {
    const [topId, topMs] = [...byTask.entries()].sort((a, b) => b[1] - a[1])[0];
    const title = input.taskTitleById.get(topId);
    if (title) {
      out.push(`most time on "${title}" — ${formatDurationPretty(topMs)}.`);
    }
  }

  // tracking gap: days with no sessions in the selected range.
  if (input.rangeDays > 1) {
    const activeDates = new Set(input.dayTotals.filter((d) => d.total > 0).map((d) => d.date));
    const gaps = input.rangeDays - activeDates.size;
    if (gaps > 0) {
      out.push(
        `no tracking on ${gaps} ${gaps === 1 ? 'day' : 'days'} of the last ${input.rangeDays}.`,
      );
    }
  }

  return out.slice(0, 3);
}

export async function generateDailyRecap(
  userId: string,
  input: RecapInput = {},
): Promise<DailyRecapResponse> {
  const tz = safeTz(input.tz);
  const { start, end, label } = todayRangeInTz(tz);

  // rooms this user is a member of. scope everything to those rooms so a
  // multi-tenant install never leaks other users' work.
  const memberships = await Membership.find({ userId }).select('roomId').lean();
  const roomIds = memberships.map((m) => new mongoose.Types.ObjectId(String(m.roomId)));

  if (roomIds.length === 0) {
    const narrative = buildRecapFallback({
      label,
      tracked: '0m',
      sessionCount: 0,
      taskCompletedCount: 0,
    });
    return {
      date: label,
      tz,
      totalDuration: 0,
      sessionCount: 0,
      completedTaskCount: 0,
      sessions: [],
      completedTasks: [],
      narrative,
      insights: [],
      aiGenerated: false,
      generatedAt: new Date().toISOString(),
    };
  }

  // today's sessions (this user, across all their rooms). include unfinished
  // sessions too but only count their duration if they've stopped.
  const sessionDocs = (await Session.find({
    userId,
    roomId: { $in: roomIds },
    startTime: { $gte: start, $lte: end },
  })
    .sort({ startTime: 1, _id: 1 })
    .lean()) as unknown as SessionRow[];

  // tasks completed today by this user (assignedTo). keeps the recap honest —
  // tasks someone else closed don't show up on your card.
  const completedTaskDocs = (await Task.find({
    roomId: { $in: roomIds },
    assignedTo: userId,
    status: 'done',
    completedAt: { $gte: start, $lte: end },
  })
    .sort({ completedAt: 1, _id: 1 })
    .lean()) as unknown as TaskRow[];

  // hydrate room names + linked task titles. one query each.
  const rooms = (await Room.find({ _id: { $in: roomIds } })
    .select('name')
    .lean()) as unknown as RoomRow[];
  const roomNameById = new Map<string, string>(
    rooms.map((r) => [String(r._id), r.name]),
  );

  const linkedTaskIds = Array.from(
    new Set(
      sessionDocs
        .map((s) => (s.linkedTaskId ? String(s.linkedTaskId) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const linkedTasks =
    linkedTaskIds.length > 0
      ? ((await Task.find({ _id: { $in: linkedTaskIds } })
          .select('title')
          .lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; title: string }>)
      : [];
  const taskTitleById = new Map<string, string>(
    linkedTasks.map((t) => [String(t._id), t.title]),
  );

  const totalDuration = sessionDocs.reduce<number>(
    (sum, s) => sum + (s.duration ?? 0),
    0,
  );

  const sessions: DailyRecapResponse['sessions'] = sessionDocs
    .filter((s): s is SessionRow & { duration: number } => s.duration != null)
    .map((s) => ({
      id: String(s._id),
      roomId: String(s.roomId),
      roomName: roomNameById.get(String(s.roomId)) ?? 'room',
      intent: s.intent,
      summary: s.summary ?? null,
      duration: s.duration,
      linkedTaskTitle: s.linkedTaskId
        ? taskTitleById.get(String(s.linkedTaskId)) ?? null
        : null,
    }));

  const completedTasks: DailyRecapResponse['completedTasks'] = completedTaskDocs.map((t) => ({
    id: String(t._id),
    roomId: String(t.roomId),
    roomName: roomNameById.get(String(t.roomId)) ?? 'room',
    title: t.title,
  }));

  // insights computed over today only (so "busiest day" is dropped, but top task
  // and "no tracking" still apply).
  const insights = computeInsights({
    sessionDocs: sessionDocs.map((s) => ({
      startTime: s.startTime,
      duration: s.duration ?? null,
      linkedTaskId: s.linkedTaskId ?? null,
    })),
    taskTitleById,
    dayTotals: [{ date: label, total: totalDuration }],
    completedCount: completedTasks.length,
    rangeDays: 1,
  });

  const trackedLabel = formatDurationPretty(totalDuration);
  const fallback = buildRecapFallback({
    label,
    tracked: trackedLabel,
    sessionCount: sessions.length,
    taskCompletedCount: completedTasks.length,
  });

  const aiResult = await ai.generateDailyRecap({
    dateLabel: label,
    tracked: trackedLabel,
    sessionCount: sessions.length,
    taskCompletedCount: completedTasks.length,
    sessions: sessions.slice(0, 6).map((s) => ({
      intent: s.intent,
      summary: s.summary,
      duration: formatDurationPretty(s.duration),
      roomName: s.roomName,
    })),
    insights,
    fallback,
  });

  return {
    date: label,
    tz,
    totalDuration,
    sessionCount: sessions.length,
    completedTaskCount: completedTasks.length,
    sessions,
    completedTasks,
    narrative: aiResult.text,
    insights,
    aiGenerated: aiResult.aiGenerated,
    generatedAt: new Date().toISOString(),
  };
}

// expose the insight engine for other callers (e.g. future report integration).
export { computeInsights, formatDurationPretty };
