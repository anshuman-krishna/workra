import mongoose from 'mongoose';
import crypto from 'node:crypto';
import path from 'node:path';
import { FileModel, type FileDoc } from '../models/file.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { storage } from '../storage/index.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import type { FileWithUrl, PublicFile, PublicMember } from '@workra/shared';

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

function toPublicFile(file: FileDoc, uploader: PublicMember): PublicFile {
  const ts = file as unknown as { createdAt: Date };
  return {
    id: String(file._id),
    roomId: String(file.roomId),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    version: file.version,
    rootFileId: String(file.rootFileId),
    isLatest: file.isLatest,
    uploadedBy: uploader,
    createdAt: ts.createdAt.toISOString(),
  };
}

async function loadUploader(userId: mongoose.Types.ObjectId): Promise<PublicMember> {
  const user = await User.findById(userId).select('displayName avatarSeed').lean();
  if (!user) {
    return { id: String(userId), displayName: 'unknown', avatarSeed: '00000000' };
  }
  const u = user as unknown as PopulatedUser;
  return { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed };
}

async function loadUploaderMap(userIds: mongoose.Types.ObjectId[]): Promise<Map<string, PublicMember>> {
  const ids = Array.from(new Set(userIds.map((id) => String(id))));
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select('displayName avatarSeed')
    .lean();
  const rows = users as unknown as PopulatedUser[];
  return new Map(
    rows.map((u) => [
      String(u._id),
      { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed },
    ]),
  );
}

async function assertMember(userId: string, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');
  return membership;
}

function buildStorageKey(roomId: string, name: string): string {
  // collision-resistant key independent of display name. extension preserved for content sniffing.
  const ext = path.extname(name).slice(0, 16).toLowerCase();
  const id = crypto.randomBytes(16).toString('hex');
  return `rooms/${roomId}/${id}${ext}`;
}

interface UploadInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export async function uploadFile(
  userId: string,
  roomId: string,
  input: UploadInput,
): Promise<PublicFile> {
  await assertMember(userId, roomId);

  const trimmedName = input.name.trim();
  if (!trimmedName) throw badRequest('file name required');
  if (trimmedName.length > 255) throw badRequest('file name too long');
  if (input.buffer.length === 0) throw badRequest('file is empty');

  // is there an existing version stack with this name?
  const existingLatest = await FileModel.findOne({
    roomId,
    name: trimmedName,
    isLatest: true,
  });

  const storageKey = buildStorageKey(roomId, trimmedName);
  // upload bytes first; only commit the row once storage is durable.
  await storage.put({
    key: storageKey,
    body: input.buffer,
    contentType: input.mimeType,
  });

  let saved: FileDoc;
  try {
    if (existingLatest) {
      // demote previous latest, then create new version sharing the root id.
      existingLatest.isLatest = false;
      await existingLatest.save();

      saved = await FileModel.create({
        roomId: new mongoose.Types.ObjectId(roomId),
        rootFileId: existingLatest.rootFileId,
        name: trimmedName,
        mimeType: input.mimeType,
        size: input.buffer.length,
        storageKey,
        version: existingLatest.version + 1,
        isLatest: true,
        uploadedBy: new mongoose.Types.ObjectId(userId),
      });
    } else {
      const created = await FileModel.create({
        roomId: new mongoose.Types.ObjectId(roomId),
        // placeholder, replaced below; required field can't start null
        rootFileId: new mongoose.Types.ObjectId(),
        name: trimmedName,
        mimeType: input.mimeType,
        size: input.buffer.length,
        storageKey,
        version: 1,
        isLatest: true,
        uploadedBy: new mongoose.Types.ObjectId(userId),
      });
      created.rootFileId = created._id as unknown as mongoose.Types.ObjectId;
      await created.save();
      saved = created;
    }
  } catch (err) {
    // rollback the uploaded blob if we couldn't persist its row
    await storage.delete(storageKey).catch(() => undefined);
    throw err;
  }

  void activityLog.record({
    userId,
    roomId,
    type: existingLatest ? 'file_versioned' : 'file_uploaded',
    entityId: String(saved._id),
    metadata: { name: saved.name, version: saved.version, size: saved.size },
  });

  const uploader = await loadUploader(saved.uploadedBy as mongoose.Types.ObjectId);
  return toPublicFile(saved, uploader);
}

export async function listFiles(userId: string, roomId: string): Promise<PublicFile[]> {
  await assertMember(userId, roomId);

  // one row per stack: the latest version
  const files = await FileModel.find({ roomId, isLatest: true }).sort({ createdAt: -1 });
  if (files.length === 0) return [];

  const uploaderMap = await loadUploaderMap(
    files.map((f) => f.uploadedBy as mongoose.Types.ObjectId),
  );

  return files.map((f) => {
    const uploader = uploaderMap.get(String(f.uploadedBy)) ?? {
      id: String(f.uploadedBy),
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    return toPublicFile(f, uploader);
  });
}

async function loadFileOrThrow(fileId: string): Promise<FileDoc> {
  if (!mongoose.isValidObjectId(fileId)) throw notFound('file not found');
  const file = await FileModel.findById(fileId);
  if (!file) throw notFound('file not found');
  return file;
}

export async function getFileWithUrl(userId: string, fileId: string): Promise<FileWithUrl> {
  const file = await loadFileOrThrow(fileId);
  await assertMember(userId, String(file.roomId));

  const signed = await storage.getSignedUrl(file.storageKey, file.name);
  const uploader = await loadUploader(file.uploadedBy as mongoose.Types.ObjectId);
  return {
    ...toPublicFile(file, uploader),
    downloadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function listFileVersions(userId: string, fileId: string): Promise<PublicFile[]> {
  const file = await loadFileOrThrow(fileId);
  await assertMember(userId, String(file.roomId));

  const versions = await FileModel.find({ rootFileId: file.rootFileId }).sort({ version: -1 });
  if (versions.length === 0) return [];

  const uploaderMap = await loadUploaderMap(
    versions.map((v) => v.uploadedBy as mongoose.Types.ObjectId),
  );

  return versions.map((v) => {
    const uploader = uploaderMap.get(String(v.uploadedBy)) ?? {
      id: String(v.uploadedBy),
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    return toPublicFile(v, uploader);
  });
}

export async function deleteFile(userId: string, fileId: string): Promise<void> {
  const file = await loadFileOrThrow(fileId);
  const roomId = String(file.roomId);
  await assertMember(userId, roomId);

  // entire version stack is removed when any version is deleted; the alternative
  // (per-version deletes with promotion logic) adds complexity nobody asked for.
  const versions = await FileModel.find({ rootFileId: file.rootFileId });

  for (const v of versions) {
    await storage.delete(v.storageKey).catch(() => undefined);
  }
  await FileModel.deleteMany({ rootFileId: file.rootFileId });

  void activityLog.record({
    userId,
    roomId,
    type: 'file_deleted',
    entityId: String(file._id),
    metadata: { name: file.name, versions: versions.length },
  });
}
