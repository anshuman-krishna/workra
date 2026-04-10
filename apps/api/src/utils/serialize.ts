import type { UserDoc } from '../models/user.model.js';
import type { RoomDoc } from '../models/room.model.js';
import type { RoomRole, PublicUser, PublicRoom } from '@workra/shared';

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as PublicUser['role'],
    createdAt: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
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
    createdAt: (room as unknown as { createdAt: Date }).createdAt.toISOString(),
    role,
    memberCount,
  };
}
