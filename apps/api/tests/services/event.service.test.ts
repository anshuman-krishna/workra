import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
import * as eventService from '../../src/services/event.service.js';

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
    name: 'event tester',
    email: 'event@example.com',
    password: 'password123456',
  });
  const room = await roomService.createRoom(auth.user.id, 'event room');
  return { userId: auth.user.id, roomId: room.id };
}

describe('event service', () => {
  it('creates and lists events', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const evt = await eventService.createEvent(userId, roomId, {
      title: 'client call',
      description: 'kickoff',
      type: 'meeting',
      date: '2026-04-20',
    });

    expect(evt.title).toBe('client call');
    expect(evt.type).toBe('meeting');
    // bare yyyy-mm-dd parsed as utc midnight
    expect(evt.date.startsWith('2026-04-20')).toBe(true);

    const events = await eventService.listEvents(userId, roomId, {});
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(evt.id);
  });

  it('filters events by date range and type', async () => {
    const { userId, roomId } = await newUserAndRoom();

    await eventService.createEvent(userId, roomId, {
      title: 'early',
      type: 'deadline',
      date: '2026-04-05',
    });
    await eventService.createEvent(userId, roomId, {
      title: 'mid',
      type: 'meeting',
      date: '2026-04-15',
    });
    await eventService.createEvent(userId, roomId, {
      title: 'late',
      type: 'deadline',
      date: '2026-04-25',
    });

    const inRange = await eventService.listEvents(userId, roomId, {
      from: '2026-04-10',
      to: '2026-04-20',
    });
    expect(inRange).toHaveLength(1);
    expect(inRange[0].title).toBe('mid');

    const deadlines = await eventService.listEvents(userId, roomId, { type: 'deadline' });
    expect(deadlines).toHaveLength(2);
  });

  it('creator can delete their own event', async () => {
    const { userId, roomId } = await newUserAndRoom();
    const evt = await eventService.createEvent(userId, roomId, {
      title: 'doomed',
      type: 'meeting',
      date: '2026-05-01',
    });

    await eventService.deleteEvent(userId, evt.id);

    const events = await eventService.listEvents(userId, roomId, {});
    expect(events).toHaveLength(0);
  });

  it('owner can delete a collaborator\'s event', async () => {
    const { userId: ownerId, roomId } = await newUserAndRoom();
    const collab = await authService.signup({
      name: 'collab',
      email: 'collab@example.com',
      password: 'password123456',
    });
    const invite = await roomService.getRoomInvite(roomId);
    await roomService.joinRoom(collab.user.id, invite.code);

    const evt = await eventService.createEvent(collab.user.id, roomId, {
      title: 'collab event',
      type: 'meeting',
      date: '2026-05-10',
    });

    await eventService.deleteEvent(ownerId, evt.id);

    const events = await eventService.listEvents(ownerId, roomId, {});
    expect(events).toHaveLength(0);
  });

  it('collaborator cannot delete owner\'s event', async () => {
    const { userId: ownerId, roomId } = await newUserAndRoom();
    const collab = await authService.signup({
      name: 'collab',
      email: 'collab@example.com',
      password: 'password123456',
    });
    const invite = await roomService.getRoomInvite(roomId);
    await roomService.joinRoom(collab.user.id, invite.code);

    const evt = await eventService.createEvent(ownerId, roomId, {
      title: 'owner event',
      type: 'meeting',
      date: '2026-05-10',
    });

    await expect(
      eventService.deleteEvent(collab.user.id, evt.id),
    ).rejects.toThrow('cannot delete');
  });
});
