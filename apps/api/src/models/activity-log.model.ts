import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseTransform } from '../utils/schema-transform.js';
import {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORY,
  type ActivityType,
  type ActivityCategory,
} from '@workra/shared';

// re-export so the rest of the backend can import from here without caring
// whether the source is shared or local. the shared package owns the values.
export { ACTIVITY_CATEGORY };
export type { ActivityType, ActivityCategory };

export interface IActivityLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  type: string;
  entityId: mongoose.Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    // enum validation is mirrored at the schema layer so bad writes fail close.
    type: { type: String, required: true, enum: ACTIVITY_TYPES },
    // canonical id of the thing this activity is about (sessionId, taskId, fileId, messageId).
    // null for room-scoped activities like room_joined.
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

export type ActivityLogDoc = HydratedDocument<IActivityLog>;

export const ActivityLog: Model<IActivityLog> = model<IActivityLog>(
  'ActivityLog',
  activityLogSchema,
);
