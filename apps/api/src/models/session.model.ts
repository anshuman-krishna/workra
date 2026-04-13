import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export interface ISession {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  intent: string;
  summary: string | null;
  linkedTaskId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

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
// listSessionsForTask + deleteTask cleanup
sessionSchema.index({ linkedTaskId: 1 });
// hard guarantee: at most one active session per user (race-safe)
sessionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { endTime: null } },
);

export type SessionDoc = HydratedDocument<ISession>;

export const Session: Model<ISession> = model<ISession>('Session', sessionSchema);
