import mongoose from 'mongoose';
import { Message, type MessageDoc } from '../models/message.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { FileModel } from '../models/file.model.js';
import { badRequest, forbidden, notFound, tooManyRequests } from '../utils/errors.js';
import * as activityLog from './activity-log.service.js';
import * as realtime from '../realtime/emit.js';
import type {
  CreateMessageInput,
  ListMessagesQuery,
  MessageAttachment,
  PublicMember,
  PublicMessage,
} from '@workra/shared';

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

interface FileRow {
  _id: mongoose.Types.ObjectId;
  name: string;
  mimeType: string;
  size: number;
  roomId: mongoose.Types.ObjectId;
}

// in-memory sliding window rate limiter for message sends.
// 20 messages per minute per (user, room). intentionally not redis-backed:
// a single process is fine for the current deployment, and we'd rather let a
// short burst through on a restart than pay the ops cost of a shared store.
// if we ever run multiple api instances, this needs to move to redis.
const MESSAGE_RATE_WINDOW_MS = 60_000;
const MESSAGE_RATE_MAX = 20;
const messageRateBuckets = new Map<string, number[]>();

function checkMessageRate(userId: string, roomId: string): void {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const windowStart = now - MESSAGE_RATE_WINDOW_MS;
  const existing = messageRateBuckets.get(key) ?? [];
  // drop anything outside the window
  const recent = existing.filter((ts) => ts > windowStart);
  if (recent.length >= MESSAGE_RATE_MAX) {
    const oldest = recent[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + MESSAGE_RATE_WINDOW_MS - now) / 1000));
    throw tooManyRequests(
      `you're sending messages too fast. take a breath and try again in ${retryAfter}s.`,
      { retryAfter },
    );
  }
  recent.push(now);
  messageRateBuckets.set(key, recent);

  // opportunistic cleanup so the map doesn't grow unbounded on a long-running process
  if (messageRateBuckets.size > 1000) {
    for (const [k, v] of messageRateBuckets) {
      const kept = v.filter((ts) => ts > windowStart);
      if (kept.length === 0) messageRateBuckets.delete(k);
      else messageRateBuckets.set(k, kept);
    }
  }
}

function toPublicMessage(
  message: MessageDoc,
  sender: PublicMember,
  attachments: MessageAttachment[],
): PublicMessage {
  return {
    id: String(message._id),
    roomId: String(message.roomId),
    content: message.content,
    sender,
    attachments,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

async function assertMember(userId: string, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('not a member of this room');
  return membership;
}

// validates attachment ids belong to the same room before persisting the message.
// callers pass user-supplied strings; anything not a valid id is rejected.
async function resolveAttachments(
  roomId: string,
  ids: string[],
): Promise<MessageAttachment[]> {
  if (ids.length === 0) return [];
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) throw badRequest('invalid attachment id');
  }
  const rows = (await FileModel.find({ _id: { $in: ids }, roomId })
    .select('name mimeType size roomId')
    .lean()) as unknown as FileRow[];
  if (rows.length !== ids.length) {
    throw badRequest('one or more attachments do not belong to this room');
  }
  return rows.map((f) => ({
    id: String(f._id),
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
  }));
}

async function loadSender(userId: mongoose.Types.ObjectId): Promise<PublicMember> {
  const user = await User.findById(userId).select('displayName avatarSeed').lean();
  if (!user) return { id: String(userId), displayName: 'unknown', avatarSeed: '00000000' };
  const u = user as unknown as PopulatedUser;
  return { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed };
}

async function loadSenderMap(
  ids: mongoose.Types.ObjectId[],
): Promise<Map<string, PublicMember>> {
  const unique = Array.from(new Set(ids.map((id) => String(id))));
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select('displayName avatarSeed')
    .lean();
  return new Map(
    (users as unknown as PopulatedUser[]).map((u) => [
      String(u._id),
      { id: String(u._id), displayName: u.displayName, avatarSeed: u.avatarSeed },
    ]),
  );
}

async function loadAttachmentMap(
  ids: mongoose.Types.ObjectId[],
): Promise<Map<string, MessageAttachment>> {
  const unique = Array.from(new Set(ids.map((id) => String(id))));
  if (unique.length === 0) return new Map();
  const rows = (await FileModel.find({ _id: { $in: unique } })
    .select('name mimeType size')
    .lean()) as unknown as FileRow[];
  return new Map(
    rows.map((f) => [
      String(f._id),
      { id: String(f._id), name: f.name, mimeType: f.mimeType, size: f.size },
    ]),
  );
}

export async function sendMessage(
  userId: string,
  roomId: string,
  input: CreateMessageInput,
): Promise<PublicMessage> {
  await assertMember(userId, roomId);
  checkMessageRate(userId, roomId);

  const attachments = await resolveAttachments(roomId, input.attachmentFileIds ?? []);

  const message = await Message.create({
    roomId: new mongoose.Types.ObjectId(roomId),
    senderId: new mongoose.Types.ObjectId(userId),
    content: input.content,
    attachmentFileIds: attachments.map((a) => new mongoose.Types.ObjectId(a.id)),
  });

  void activityLog.record({
    userId,
    roomId,
    type: 'message_sent',
    entityId: String(message._id),
    metadata: {
      preview: input.content.slice(0, 50),
      hasAttachments: attachments.length > 0,
    },
  });

  const sender = await loadSender(message.senderId);
  const payload = toPublicMessage(message, sender, attachments);

  // real-time push: clients in room:<roomId> receive the message; other rooms ignore it.
  realtime.emitMessageCreated(roomId, payload);

  return payload;
}

export async function listMessages(
  userId: string,
  roomId: string,
  query: ListMessagesQuery,
): Promise<PublicMessage[]> {
  await assertMember(userId, roomId);

  const filter: Record<string, unknown> = { roomId, deletedAt: null };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1, _id: 1 })
    .limit(query.limit ?? 30);
  if (messages.length === 0) return [];

  const senderMap = await loadSenderMap(
    messages.map((m) => m.senderId),
  );
  const attachmentMap = await loadAttachmentMap(
    messages.flatMap((m) => m.attachmentFileIds),
  );

  return messages.map((m) => {
    const sender = senderMap.get(String(m.senderId)) ?? {
      id: String(m.senderId),
      displayName: 'unknown',
      avatarSeed: '00000000',
    };
    const attachments = m.attachmentFileIds
      .map((id) => attachmentMap.get(String(id)))
      .filter((a): a is MessageAttachment => Boolean(a));
    return toPublicMessage(m, sender, attachments);
  });
}

export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  if (!mongoose.isValidObjectId(messageId)) throw notFound('message not found');
  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) throw notFound('message not found');

  // only the sender can delete their own message.
  // (room owners can revisit this later if moderation becomes a need.)
  if (String(message.senderId) !== userId) throw forbidden('cannot delete others\' messages');

  message.deletedAt = new Date();
  await message.save();

  realtime.emitMessageDeleted(String(message.roomId), {
    id: String(message._id),
    roomId: String(message.roomId),
  });
}
