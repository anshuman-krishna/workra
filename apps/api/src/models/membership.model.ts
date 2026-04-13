import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export interface IMembership {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  role: 'owner' | 'collaborator' | 'client';
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    role: {
      type: String,
      enum: ['owner', 'collaborator', 'client'],
      required: true,
      default: 'collaborator',
    },
    joinedAt: { type: Date, default: () => new Date() },
  },
  baseSchemaOptions,
);

membershipSchema.index({ userId: 1, roomId: 1 }, { unique: true });

export type MembershipDoc = HydratedDocument<IMembership>;

export const Membership: Model<IMembership> = model<IMembership>(
  'Membership',
  membershipSchema,
);
