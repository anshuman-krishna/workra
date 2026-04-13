import type { UserDoc } from '../models/user.model.js';
import type { RoomDoc } from '../models/room.model.js';
import type { RoomRole, PublicUser, PublicRoom, PublicMember } from '@workra/shared';

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    displayName: user.displayName,
    avatarSeed: user.avatarSeed,
    email: user.email,
    role: user.role as PublicUser['role'],
    createdAt: user.createdAt.toISOString(),
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
  return {
    id: String(room._id),
    name: room.name,
    ownerId: String(room.ownerId),
    inviteCode: room.inviteCode,
    createdAt: room.createdAt.toISOString(),
    role,
    memberCount,
  };
}
