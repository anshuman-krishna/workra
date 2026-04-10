import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

const roomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviteCode: { type: String, required: true, unique: true, index: true, uppercase: true },
  },
  baseSchemaOptions,
);

export type RoomDoc = InferSchemaType<typeof roomSchema> & { _id: Schema.Types.ObjectId };

export const Room: Model<RoomDoc> = model<RoomDoc>('Room', roomSchema);
