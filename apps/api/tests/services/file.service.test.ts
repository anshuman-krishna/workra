import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../setup.js';
import * as authService from '../../src/services/auth.service.js';
import * as roomService from '../../src/services/room.service.js';
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
    name: 'file tester',
    email: 'file@example.com',
    password: 'password123456',
  });
  const room = await roomService.createRoom(auth.user.id, 'file room');
  return { userId: auth.user.id, roomId: room.id };
}

describe('file service', () => {
  it('uploads a file and returns it in the list', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const uploaded = await fileService.uploadFile(userId, roomId, {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello world'),
    });

    expect(uploaded.name).toBe('notes.txt');
    expect(uploaded.version).toBe(1);
    expect(uploaded.isLatest).toBe(true);
    expect(uploaded.size).toBe(11);

    const listed = await fileService.listFiles(userId, roomId);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(uploaded.id);
  });

  it('creates a new version when uploading with the same name', async () => {
    const { userId, roomId } = await newUserAndRoom();

    const v1 = await fileService.uploadFile(userId, roomId, {
      name: 'doc.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# v1'),
    });

    const v2 = await fileService.uploadFile(userId, roomId, {
      name: 'doc.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# v2 with more content'),
    });

    expect(v2.version).toBe(2);
    expect(v2.rootFileId).toBe(v1.rootFileId);
    expect(v2.isLatest).toBe(true);

    const listed = await fileService.listFiles(userId, roomId);
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe(2);

    const versions = await fileService.listFileVersions(userId, v2.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2);
    expect(versions[1].version).toBe(1);
  });

  it('rejects empty uploads', async () => {
    const { userId, roomId } = await newUserAndRoom();

    await expect(
      fileService.uploadFile(userId, roomId, {
        name: 'empty.txt',
        mimeType: 'text/plain',
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow('file is empty');
  });

  it('rejects non-members', async () => {
    const { roomId } = await newUserAndRoom();
    const intruder = await authService.signup({
      name: 'outsider',
      email: 'out@example.com',
      password: 'password123456',
    });

    await expect(
      fileService.uploadFile(intruder.user.id, roomId, {
        name: 'hack.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('nope'),
      }),
    ).rejects.toThrow('not a member');
  });

  it('returns a signed url for download', async () => {
    const { userId, roomId } = await newUserAndRoom();
    const uploaded = await fileService.uploadFile(userId, roomId, {
      name: 'signed.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('signed data'),
    });

    const withUrl = await fileService.getFileWithUrl(userId, uploaded.id);
    expect(withUrl.downloadUrl).toBeTruthy();
    expect(new Date(withUrl.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('deletes every version in the stack', async () => {
    const { userId, roomId } = await newUserAndRoom();
    await fileService.uploadFile(userId, roomId, {
      name: 'bye.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('v1'),
    });
    const v2 = await fileService.uploadFile(userId, roomId, {
      name: 'bye.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('v2'),
    });

    await fileService.deleteFile(userId, v2.id);

    const remaining = await fileService.listFiles(userId, roomId);
    expect(remaining).toHaveLength(0);
  });
});
