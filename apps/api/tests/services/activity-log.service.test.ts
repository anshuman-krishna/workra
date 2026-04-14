import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
import * as taskService from '../../src/services/task.service.js';
import * as sessionService from '../../src/services/session.service.js';
import * as messageService from '../../src/services/message.service.js';
import * as activityLog from '../../src/services/activity-log.service.js';

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
    name: 'activity tester',
    email: 'activity@example.com',
    password: 'password123456',
  });
  const room = await roomService.createRoom(auth.user.id, 'activity room');
  return { userId: auth.user.id, roomId: room.id };
}

// activity.record is fire-and-forget. the call path is:
//   service -> void activityLog.record(...) -> ActivityLog.create
// we wait for the next few macrotasks so the create promise settles before
// the assertion reads from the collection.
async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  await new Promise((r) => setTimeout(r, 100));
}

describe('activity-log service', () => {
  it('records room_created on room creation', async () => {
    const { userId, roomId } = await newUserAndRoom();
    await flush();

    const logs = await activityLog.listRoomActivity(userId, roomId, { limit: 50 });
    const types = logs.map((l) => l.type);
    expect(types).toContain('room_created');
  });

  it('records task + session lifecycle events', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const task = await taskService.createTask(userId, roomId, {
      title: 'a task',
      status: 'todo',
    });
    await taskService.updateTask(userId, task.id, { status: 'in_progress' });
    await taskService.updateTask(userId, task.id, { status: 'done' });
    await sessionService.startSession(userId, roomId, { intent: 'work' });
    await sessionService.stopSession(userId, 'done');

    await flush();

    const logs = await activityLog.listRoomActivity(userId, roomId, { limit: 50 });
    const types = logs.map((l) => l.type);
    expect(types).toContain('task_created');
    expect(types).toContain('task_updated');
    expect(types).toContain('task_completed');
    expect(types).toContain('session_started');
    expect(types).toContain('session_completed');
  });

  it('default list hides chat events', async () => {
    const { userId, roomId } = await newUserAndRoom();

    await messageService.sendMessage(userId, roomId, { content: 'hi' });
    await flush();

    const defaultList = await activityLog.listRoomActivity(userId, roomId, { limit: 50 });
    const types = defaultList.map((l) => l.type);
    expect(types).not.toContain('message_sent');
  });

  it('category=chat filter reveals chat events', async () => {
    const { userId, roomId } = await newUserAndRoom();

    await messageService.sendMessage(userId, roomId, { content: 'hello' });
    await flush();

    const chatList = await activityLog.listRoomActivity(userId, roomId, {
      limit: 50,
      category: 'chat',
    });
    const types = chatList.map((l) => l.type);
    expect(types).toContain('message_sent');
  });

  it('rejects non-members from reading the log', async () => {
    const { roomId } = await newUserAndRoom();
    const intruder = await authService.signup({
      name: 'out',
      email: 'out@example.com',
      password: 'password123456',
    });

    await expect(
      activityLog.listRoomActivity(intruder.user.id, roomId, { limit: 10 }),
    ).rejects.toThrow('not a member');
  });
});
