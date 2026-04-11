import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseTransform } from '../utils/schema-transform.js';

export type ActivityType =
  | 'session_started'
  | 'session_completed'
  | 'room_created'
  | 'room_joined'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_deleted'
  | 'file_uploaded'
  | 'file_versioned'
  | 'file_deleted';

// category groups activity types for filtering. derived, never stored.
export type ActivityCategory = 'session' | 'task' | 'file' | 'room';

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
};

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    type: { type: String, required: true },
    // entityId is the canonical id of the thing this activity is about
    // (sessionId, taskId, fileId). null for room-scoped activities like room_joined.
    entityId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    // append-only: createdAt only, no updatedAt
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: false, versionKey: false, transform: baseTransform },
    toObject: { virtuals: false, versionKey: false, transform: baseTransform },
  },
);

activityLogSchema.index({ roomId: 1, createdAt: -1 });
activityLogSchema.index({ roomId: 1, type: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ActivityLog: Model<ActivityLogDoc> = model<ActivityLogDoc>(
  'ActivityLog',
  activityLogSchema,
);
