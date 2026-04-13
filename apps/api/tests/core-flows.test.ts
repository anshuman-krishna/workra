import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearCollections } from './setup.js';
import * as authService from '../src/services/auth.service.js';
import * as sessionService from '../src/services/session.service.js';
import * as taskService from '../src/services/task.service.js';
import * as roomService from '../src/services/room.service.js';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('auth', () => {
  it('signup returns user and tokens', async () => {
    const result = await authService.signup({
      name: 'test user',
      email: 'test@example.com',
      password: 'securepassword123',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.user.name).toBe('test user');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('signup rejects duplicate email', async () => {
    await authService.signup({
      name: 'first',
      email: 'dupe@example.com',
      password: 'password123456',
    });

    await expect(
      authService.signup({
        name: 'second',
        email: 'dupe@example.com',
        password: 'password654321',
      }),
    ).rejects.toThrow('already exists');
  });

  it('login succeeds with correct credentials', async () => {
    await authService.signup({
      name: 'login test',
      email: 'login@example.com',
      password: 'correctpassword',
    });

    const result = await authService.login({
      email: 'login@example.com',
      password: 'correctpassword',
    });

    expect(result.user.email).toBe('login@example.com');
    expect(result.accessToken).toBeTruthy();
  });

  it('login rejects wrong password', async () => {
    await authService.signup({
      name: 'login test',
      email: 'wrong@example.com',
      password: 'correctpassword',
    });

    await expect(
      authService.login({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow('invalid email or password');
  });
});

describe('rooms', () => {
  let userId: string;

  beforeEach(async () => {
    await clearCollections();
    const result = await authService.signup({
      name: 'room tester',
      email: 'room@example.com',
      password: 'password123456',
    });
    userId = result.user.id;
  });

  it('create room and list it', async () => {
    const room = await roomService.createRoom(userId, 'test room');
    expect(room.name).toBe('test room');
    expect(room.role).toBe('owner');
    expect(room.memberCount).toBe(1);

    const rooms = await roomService.listUserRooms(userId);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe(room.id);
  });

  it('join room by invite code', async () => {
    const room = await roomService.createRoom(userId, 'invite test');
    const invite = await roomService.getRoomInvite(room.id);

    // create a second user
    const other = await authService.signup({
      name: 'joiner',
      email: 'joiner@example.com',
      password: 'password123456',
    });

    const joined = await roomService.joinRoom(other.user.id, invite.code);
    expect(joined.id).toBe(room.id);
    expect(joined.role).toBe('collaborator');
    expect(joined.memberCount).toBe(2);
  });
});

describe('sessions', () => {
  let userId: string;
  let roomId: string;

  beforeEach(async () => {
    await clearCollections();
    const auth = await authService.signup({
      name: 'session tester',
      email: 'session@example.com',
      password: 'password123456',
    });
    userId = auth.user.id;
    const room = await roomService.createRoom(userId, 'work room');
    roomId = room.id;
  });

  it('start and stop session', async () => {
    const session = await sessionService.startSession(userId, roomId, {
      intent: 'working on feature x',
    });

    expect(session.intent).toBe('working on feature x');
    expect(session.endTime).toBeNull();
    expect(session.duration).toBeNull();

    const stopped = await sessionService.stopSession(userId, 'finished feature x');
    expect(stopped.endTime).toBeTruthy();
    expect(stopped.duration).toBeGreaterThanOrEqual(0);
    expect(stopped.summary).toBe('finished feature x');
  });

  it('cannot start two sessions', async () => {
    await sessionService.startSession(userId, roomId, { intent: 'first' });

    await expect(
      sessionService.startSession(userId, roomId, { intent: 'second' }),
    ).rejects.toThrow('already have an active session');
  });

  it('get active session', async () => {
    expect(await sessionService.getActiveSession(userId)).toBeNull();

    await sessionService.startSession(userId, roomId, { intent: 'test' });
    const active = await sessionService.getActiveSession(userId);
    expect(active).not.toBeNull();
    expect(active!.intent).toBe('test');
  });
});

describe('tasks', () => {
  let userId: string;
  let roomId: string;

  beforeEach(async () => {
    await clearCollections();
    const auth = await authService.signup({
      name: 'task tester',
      email: 'task@example.com',
      password: 'password123456',
    });
    userId = auth.user.id;
    const room = await roomService.createRoom(userId, 'task room');
    roomId = room.id;
  });

  it('create task', async () => {
    const task = await taskService.createTask(userId, roomId, {
      title: 'build feature',
      status: 'todo',
    });

    expect(task.title).toBe('build feature');
    expect(task.status).toBe('todo');
    expect(task.roomId).toBe(roomId);
  });

  it('list tasks', async () => {
    await taskService.createTask(userId, roomId, { title: 'task 1', status: 'todo' });
    await taskService.createTask(userId, roomId, { title: 'task 2', status: 'todo' });

    const tasks = await taskService.listTasks(userId, roomId, {});
    expect(tasks).toHaveLength(2);
  });

  it('update task status through valid transitions', async () => {
    const task = await taskService.createTask(userId, roomId, {
      title: 'transition test',
      status: 'todo',
    });

    const inProgress = await taskService.updateTask(userId, task.id, {
      status: 'in_progress',
    });
    expect(inProgress.status).toBe('in_progress');

    const done = await taskService.updateTask(userId, task.id, {
      status: 'done',
    });
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeTruthy();
  });

  it('reject invalid task transition', async () => {
    const task = await taskService.createTask(userId, roomId, {
      title: 'bad transition',
      status: 'todo',
    });

    await expect(
      taskService.updateTask(userId, task.id, { status: 'done' }),
    ).rejects.toThrow('cannot move task');
  });

  it('delete task', async () => {
    const task = await taskService.createTask(userId, roomId, {
      title: 'to delete',
      status: 'todo',
    });

    await taskService.deleteTask(userId, task.id);

    const tasks = await taskService.listTasks(userId, roomId, {});
    expect(tasks).toHaveLength(0);
  });

  it('session linked to task is unlinked on task delete', async () => {
    const task = await taskService.createTask(userId, roomId, {
      title: 'linked task',
      status: 'todo',
    });

    await sessionService.startSession(userId, roomId, {
      intent: 'working on linked task',
      linkedTaskId: task.id,
    });
    await sessionService.stopSession(userId);

    await taskService.deleteTask(userId, task.id);

    const sessions = await sessionService.listRoomSessions(roomId, { limit: 100 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].linkedTaskId).toBeNull();
  });
});
