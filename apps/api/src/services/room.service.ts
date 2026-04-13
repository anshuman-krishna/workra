import mongoose from 'mongoose';
import { Room } from '../models/room.model.js';
import { Membership } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { generateInviteCode } from '../utils/invite-code.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { toPublicRoom } from '../utils/serialize.js';
import { env } from '../config/env.js';
import * as activityLog from './activity-log.service.js';
import type { RoomRole, PublicRoom, PublicMember } from '@workra/shared';

interface MemberRow {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  avatarSeed: string;
}

async function createUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const exists = await Room.exists({ inviteCode: code });
    if (!exists) return code;
  }
  throw conflict('could not generate a unique invite code');
}

export async function createRoom(userId: string, name: string): Promise<PublicRoom> {
  const inviteCode = await createUniqueInviteCode();
  const room = await Room.create({
    name,
    ownerId: new mongoose.Types.ObjectId(userId),
    inviteCode,
  });

  await Membership.create({
    userId: new mongoose.Types.ObjectId(userId),
    roomId: room._id,
    role: 'owner',
  });

  void activityLog.record({
    userId,
    roomId: String(room._id),
    type: 'room_created',
    entityId: String(room._id),
    metadata: { name },
  });

  return toPublicRoom(room, 'owner', 1);
}

export async function listUserRooms(userId: string): Promise<PublicRoom[]> {
  const memberships = await Membership.find({ userId }).lean();
  if (memberships.length === 0) return [];

  const roomIds = memberships.map((m) => m.roomId);
  const rooms = await Room.find({ _id: { $in: roomIds } });

  const counts = await Membership.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { roomId: { $in: roomIds } } },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const roleMap = new Map(memberships.map((m) => [String(m.roomId), m.role as RoomRole]));

  return rooms.map((room) =>
    toPublicRoom(
      room,
      roleMap.get(String(room._id)) ?? 'collaborator',
      countMap.get(String(room._id)) ?? 1,
    ),
  );
}

export async function getRoom(userId: string, roomId: string): Promise<PublicRoom> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');

  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('you are not a member of this room');

  const room = await Room.findById(roomId);
  if (!room) throw notFound('room not found');

  const memberCount = await Membership.countDocuments({ roomId });
  return toPublicRoom(room, membership.role as RoomRole, memberCount);
}

export async function joinRoom(userId: string, code: string): Promise<PublicRoom> {
  const room = await Room.findOne({ inviteCode: code.toUpperCase() });
  if (!room) throw notFound('invalid invite code');

  const existing = await Membership.findOne({ userId, roomId: room._id });
  if (existing) {
    const memberCount = await Membership.countDocuments({ roomId: room._id });
    return toPublicRoom(room, existing.role as RoomRole, memberCount);
  }

  await Membership.create({
    userId: new mongoose.Types.ObjectId(userId),
    roomId: room._id,
    role: 'collaborator',
  });

  void activityLog.record({
    userId,
    roomId: String(room._id),
    type: 'room_joined',
    entityId: String(room._id),
    metadata: {},
  });

  const memberCount = await Membership.countDocuments({ roomId: room._id });
  return toPublicRoom(room, 'collaborator', memberCount);
}

export async function listRoomMembers(userId: string, roomId: string): Promise<PublicMember[]> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const membership = await Membership.findOne({ userId, roomId });
  if (!membership) throw forbidden('you are not a member of this room');

  const memberships = await Membership.find({ roomId }).lean().limit(500);
  if (memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName avatarSeed')
    .lean();
  const rows = users as unknown as MemberRow[];

  return rows.map((u) => ({
    id: String(u._id),
    displayName: u.displayName,
    avatarSeed: u.avatarSeed,
  }));
}

export async function getRoomInvite(roomId: string): Promise<{ code: string; link: string }> {
  if (!mongoose.isValidObjectId(roomId)) throw notFound('room not found');
  const room = await Room.findById(roomId);
  if (!room) throw notFound('room not found');
  return {
    code: room.inviteCode,
    link: `${env.WEB_ORIGIN}/join/${room.inviteCode}`,
  };
}
