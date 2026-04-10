import type { UserDoc } from '../models/user.model.js';
import type { RoomDoc } from '../models/room.model.js';
import type { RoomRole, PublicUser, PublicRoom, PublicMember } from '@workra/shared';

interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: UserDoc): PublicUser {
  const ts = user as unknown as Timestamped;
  return {
    id: String(user._id),
    name: user.name,
    displayName: user.displayName,
    avatarSeed: user.avatarSeed,
    email: user.email,
    role: user.role as PublicUser['role'],
    createdAt: ts.createdAt.toISOString(),
  };
}

export function toPublicMember(user: Pick<UserDoc, '_id' | 'displayName' | 'avatarSeed'>): PublicMember {
  return {
    id: String(user._id),
    displayName: user.displayName,
    avatarSeed: user.avatarSeed,
  };
}

export function toPublicRoom(
  room: RoomDoc,
  role: RoomRole,
  memberCount: number,
): PublicRoom {
  const ts = room as unknown as Timestamped;
  return {
    id: String(room._id),
    name: room.name,
    ownerId: String(room.ownerId),
    inviteCode: room.inviteCode,
    createdAt: ts.createdAt.toISOString(),
    role,
    memberCount,
  };
}
