export type UserRole = 'user' | 'admin';
export type RoomRole = 'owner' | 'collaborator' | 'client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicRoom {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
  role: RoomRole;
  memberCount: number;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
