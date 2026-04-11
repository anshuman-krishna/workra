export type UserRole = 'user' | 'admin';
export type RoomRole = 'owner' | 'collaborator' | 'client';

export interface PublicUser {
  id: string;
  name: string;
  displayName: string;
  avatarSeed: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicMember {
  id: string;
  displayName: string;
  avatarSeed: string;
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

export interface TaskRef {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
}

export interface PublicSession {
  id: string;
  userId: string;
  roomId: string;
  user: PublicMember;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  intent: string;
  summary: string | null;
  linkedTaskId: string | null;
  linkedTask: TaskRef | null;
  createdAt: string;
}

export interface PublicTask {
  id: string;
  roomId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  assignedTo: string | null;
  assignee: PublicMember | null;
  dueDate: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStat {
  date: string;
  totalDuration: number;
}

export interface RoomInvite {
  code: string;
  link: string;
}
