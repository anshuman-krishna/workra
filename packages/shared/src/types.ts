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
  sessionCount: number;
}

export interface RoomInvite {
  code: string;
  link: string;
}

export interface PublicFile {
  id: string;
  roomId: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  rootFileId: string;
  isLatest: boolean;
  uploadedBy: PublicMember;
  createdAt: string;
}

export interface FileWithUrl extends PublicFile {
  downloadUrl: string;
  expiresAt: string;
}

export const ACTIVITY_CATEGORIES = ['session', 'task', 'file', 'room', 'chat', 'event'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

// single source of truth for activity events. both backend and frontend import from here.
// adding an event: add it to ACTIVITY_TYPES and ACTIVITY_CATEGORY so both sides stay in sync.
export const ACTIVITY_TYPES = [
  'session_started',
  'session_completed',
  'room_created',
  'room_joined',
  'task_created',
  'task_updated',
  'task_completed',
  'task_deleted',
  'file_uploaded',
  'file_versioned',
  'file_deleted',
  'message_sent',
  'event_created',
  'event_deleted',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_CATEGORY: Record<ActivityType, ActivityCategory> = {
  session_started: 'session',
  session_completed: 'session',
  room_created: 'room',
  room_joined: 'room',
  task_created: 'task',
  task_updated: 'task',
  task_completed: 'task',
  task_deleted: 'task',
  file_uploaded: 'file',
  file_versioned: 'file',
  file_deleted: 'file',
  message_sent: 'chat',
  event_created: 'event',
  event_deleted: 'event',
};

export interface PublicActivity {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  subtitle: string | null;
  user: PublicMember;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// minimal file summary embedded inside messages. keeps the chat payload self-sufficient
// so the client doesn't need a second round-trip to render attachments.
export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface PublicMessage {
  id: string;
  roomId: string;
  content: string;
  sender: PublicMember;
  attachments: MessageAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicEvent {
  id: string;
  roomId: string;
  title: string;
  description: string | null;
  type: 'deadline' | 'meeting' | 'milestone';
  date: string;
  createdBy: PublicMember;
  createdAt: string;
}

// per-day calendar rollup used by both the room and dashboard calendars.
// date is yyyy-mm-dd in the user's local timezone (the server returns utc grouping;
// the frontend re-groups when it needs local days).
export interface CalendarDay {
  date: string;
  totalDuration: number;
  sessionCount: number;
  completedTaskCount: number;
  eventCount: number;
}

export interface RoomCalendarResponse {
  days: CalendarDay[];
  events: PublicEvent[];
}

// per-day rollup for the dashboard, with a breakdown of which rooms contributed.
export interface DashboardCalendarDay {
  date: string;
  totalDuration: number;
  sessionCount: number;
  rooms: Array<{
    roomId: string;
    roomName: string;
    totalDuration: number;
    sessionCount: number;
  }>;
}

export interface DashboardCalendarResponse {
  days: DashboardCalendarDay[];
}
