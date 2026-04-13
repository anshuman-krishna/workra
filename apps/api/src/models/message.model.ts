import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  attachmentFileIds: mongoose.Types.ObjectId[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// soft delete: deletedAt preserves context for sibling messages and activity logs.
// listMessages filters these out; the stored row remains so the log metadata stays honest.
const messageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    // attachments live in the file system; we only store refs so versioning still works.
    attachmentFileIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'File' }],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

// room timeline scan: newest first, paginated by createdAt
messageSchema.index({ roomId: 1, createdAt: -1 });
// listMessages filters soft-deleted rows
messageSchema.index({ roomId: 1, deletedAt: 1, createdAt: -1 });

export type MessageDoc = HydratedDocument<IMessage>;

export const Message: Model<IMessage> = model<IMessage>('Message', messageSchema);
