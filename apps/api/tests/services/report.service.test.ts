import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
import * as taskService from '../../src/services/task.service.js';
import * as reportService from '../../src/services/report.service.js';
import { Session } from '../../src/models/session.model.js';
import { Task } from '../../src/models/task.model.js';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

async function newUserAndRoom() {
  const auth = await authService.signup({
    name: 'report tester',
    email: 'report@example.com',
    password: 'password123456',
  });
  const room = await roomService.createRoom(auth.user.id, 'report room');
  return { userId: auth.user.id, roomId: room.id };
}

// seed deterministic sessions so the report aggregations have known inputs.
// we bypass the service so we can set specific startTime / duration values.
async function seedSession(opts: {
  userId: string;
  roomId: string;
  startTime: Date;
  durationMs: number;
  intent: string;
  linkedTaskId?: string;
}) {
  const endTime = new Date(opts.startTime.getTime() + opts.durationMs);
  return Session.create({
    userId: new mongoose.Types.ObjectId(opts.userId),
    roomId: new mongoose.Types.ObjectId(opts.roomId),
    startTime: opts.startTime,
    endTime,
    duration: opts.durationMs,
    intent: opts.intent,
    summary: null,
    linkedTaskId: opts.linkedTaskId
      ? new mongoose.Types.ObjectId(opts.linkedTaskId)
      : null,
  });
}

describe('report service', () => {
  it('aggregates totals across sessions in range', async () => {
    const { userId, roomId } = await newUserAndRoom();

    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-04-10T10:00:00Z'),
      durationMs: 60 * 60_000,
      intent: 'feature a',
    });
    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-04-12T09:00:00Z'),
      durationMs: 30 * 60_000,
      intent: 'feature b',
    });
    // out-of-range, should be excluded
    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-05-01T09:00:00Z'),
      durationMs: 60 * 60_000,
      intent: 'later',
    });

    const report = await reportService.generateRoomReport(userId, roomId, {
      from: '2026-04-01',
      to: '2026-04-30',
    });

    expect(report.summary.sessionCount).toBe(2);
    expect(report.summary.totalDuration).toBe(90 * 60_000);
    expect(report.summary.activeDays).toBe(2);
    expect(report.daily.length).toBeGreaterThanOrEqual(2);
  });

  it('rolls up top tasks by linked session duration', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const t1 = await taskService.createTask(userId, roomId, {
      title: 'heavy task',
      status: 'todo',
    });
    const t2 = await taskService.createTask(userId, roomId, {
      title: 'light task',
      status: 'todo',
    });

    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-04-10T10:00:00Z'),
      durationMs: 120 * 60_000,
      intent: 'work heavy',
      linkedTaskId: t1.id,
    });
    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-04-11T10:00:00Z'),
      durationMs: 60 * 60_000,
      intent: 'work heavy more',
      linkedTaskId: t1.id,
    });
    await seedSession({
      userId,
      roomId,
      startTime: new Date('2026-04-12T10:00:00Z'),
      durationMs: 15 * 60_000,
      intent: 'work light',
      linkedTaskId: t2.id,
    });

    const report = await reportService.generateRoomReport(userId, roomId, {
      from: '2026-04-01',
      to: '2026-04-30',
    });

    expect(report.topTasks).toHaveLength(2);
    expect(report.topTasks[0].taskId).toBe(t1.id);
    expect(report.topTasks[0].totalDuration).toBe(180 * 60_000);
    expect(report.topTasks[0].sessionCount).toBe(2);
    expect(report.topTasks[1].taskId).toBe(t2.id);
  });

  it('counts completed tasks in range', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const task = await taskService.createTask(userId, roomId, {
      title: 'ship it',
      status: 'todo',
    });
    await taskService.updateTask(userId, task.id, { status: 'in_progress' });
    await taskService.updateTask(userId, task.id, { status: 'done' });

    // manually pin completedAt into the range
    await Task.updateOne(
      { _id: task.id },
      { $set: { completedAt: new Date('2026-04-15T12:00:00Z') } },
    );

    const report = await reportService.generateRoomReport(userId, roomId, {
      from: '2026-04-01',
      to: '2026-04-30',
    });

    expect(report.summary.taskCompletedCount).toBe(1);
    expect(report.completedTasks).toHaveLength(1);
    expect(report.completedTasks[0].id).toBe(task.id);
  });

  it('returns an empty-range narrative when there is no activity', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const report = await reportService.generateRoomReport(userId, roomId, {
      from: '2026-04-01',
      to: '2026-04-07',
    });

    expect(report.summary.sessionCount).toBe(0);
    expect(report.summary.totalDuration).toBe(0);
    expect(report.summary.narrative).toMatch(/no tracked work/);
  });

  it('rejects non-members', async () => {
    const { roomId } = await newUserAndRoom();
    const intruder = await authService.signup({
      name: 'out',
      email: 'out@example.com',
      password: 'password123456',
    });

    await expect(
      reportService.generateRoomReport(intruder.user.id, roomId, {
        from: '2026-04-01',
        to: '2026-04-30',
      }),
    ).rejects.toThrow('not a member');
  });
});
