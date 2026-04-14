import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
import * as messageService from '../../src/services/message.service.js';
import * as fileService from '../../src/services/file.service.js';

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
    name: 'msg tester',
    email: 'msg@example.com',
    password: 'password123456',
  });
  const room = await roomService.createRoom(auth.user.id, 'msg room');
  return { userId: auth.user.id, roomId: room.id };
}

describe('message service', () => {
  it('sends and lists messages', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const first = await messageService.sendMessage(userId, roomId, {
      content: 'hello',
    });
    const second = await messageService.sendMessage(userId, roomId, {
      content: 'world',
    });

    expect(first.content).toBe('hello');
    expect(second.content).toBe('world');
    expect(first.sender.id).toBe(userId);

    const listed = await messageService.listMessages(userId, roomId, { limit: 10 });
    expect(listed).toHaveLength(2);
    // newest-first sort
    expect(listed[0].id).toBe(second.id);
    expect(listed[1].id).toBe(first.id);
  });

  it('soft-deleted messages are hidden from list', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const sent = await messageService.sendMessage(userId, roomId, { content: 'keep' });
    const doomed = await messageService.sendMessage(userId, roomId, { content: 'delete me' });

    await messageService.deleteMessage(userId, doomed.id);

    const listed = await messageService.listMessages(userId, roomId, { limit: 10 });
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(sent.id);
  });

  it('only the sender can delete their own message', async () => {
    const { userId: ownerId, roomId } = await newUserAndRoom();
    const other = await authService.signup({
      name: 'second',
      email: 'second@example.com',
      password: 'password123456',
    });
    const invite = await roomService.getRoomInvite(roomId);
    await roomService.joinRoom(other.user.id, invite.code);

    const mine = await messageService.sendMessage(ownerId, roomId, { content: 'mine' });

    await expect(
      messageService.deleteMessage(other.user.id, mine.id),
    ).rejects.toThrow('cannot delete');
  });

  it('rejects non-members sending messages', async () => {
    const { roomId } = await newUserAndRoom();
    const intruder = await authService.signup({
      name: 'out',
      email: 'out@example.com',
      password: 'password123456',
    });

    await expect(
      messageService.sendMessage(intruder.user.id, roomId, { content: 'sneaky' }),
    ).rejects.toThrow('not a member');
  });

  it('attaches files from the same room', async () => {
    const { userId, roomId } = await newUserAndRoom();
    const file = await fileService.uploadFile(userId, roomId, {
      name: 'spec.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdfbytes'),
    });

    const msg = await messageService.sendMessage(userId, roomId, {
      content: 'see attached',
      attachmentFileIds: [file.id],
    });

    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].id).toBe(file.id);
    expect(msg.attachments[0].name).toBe('spec.pdf');
  });

  it('rejects attachments from other rooms', async () => {
    const { userId, roomId } = await newUserAndRoom();
    const secondRoom = await roomService.createRoom(userId, 'other room');
    const wrongFile = await fileService.uploadFile(userId, secondRoom.id, {
      name: 'wrong.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('x'),
    });

    await expect(
      messageService.sendMessage(userId, roomId, {
        content: 'cross-room attempt',
        attachmentFileIds: [wrongFile.id],
      }),
    ).rejects.toThrow('do not belong to this room');
  });
});
