import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

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

export type MembershipDoc = InferSchemaType<typeof membershipSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Membership: Model<MembershipDoc> = model<MembershipDoc>(
  'Membership',
  membershipSchema,
);
