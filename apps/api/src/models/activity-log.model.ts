import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseTransform } from '../utils/schema-transform.js';

export type ActivityType =
  | 'session_started'
  | 'session_completed'
  | 'room_created'
  | 'room_joined';

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    type: { type: String, required: true },
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

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & {
  _id: Schema.Types.ObjectId;
};

export const ActivityLog: Model<ActivityLogDoc> = model<ActivityLogDoc>(
  'ActivityLog',
  activityLogSchema,
);
