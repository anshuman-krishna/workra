import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export interface IRoom {
  _id: mongoose.Types.ObjectId;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviteCode: { type: String, required: true, unique: true, index: true, uppercase: true },
  },
  baseSchemaOptions,
);

export type RoomDoc = HydratedDocument<IRoom>;

export const Room: Model<IRoom> = model<IRoom>('Room', roomSchema);
