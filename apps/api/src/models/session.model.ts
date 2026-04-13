import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    startTime: { type: Date, required: true, default: () => new Date() },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: null },
    intent: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    summary: { type: String, default: null, trim: true, maxlength: 1000 },
    linkedTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  baseSchemaOptions,
);

// "active session" lookups
sessionSchema.index({ userId: 1, endTime: 1 });
// room timeline scans
sessionSchema.index({ roomId: 1, startTime: -1 });
// cross-room recap: user's sessions in a date range
sessionSchema.index({ userId: 1, startTime: 1 });
// hard guarantee: at most one active session per user (race-safe)
sessionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { endTime: null } },
);

export type SessionDoc = InferSchemaType<typeof sessionSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Session: Model<SessionDoc> = model<SessionDoc>('Session', sessionSchema);
