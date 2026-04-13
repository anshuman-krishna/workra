import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions, baseTransform } from '../utils/schema-transform.js';
import { generateAvatarSeed } from '../utils/avatar.js';

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  avatarSeed: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  refreshTokens: Array<{ jti: string; expiresAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    avatarSeed: { type: String, required: true, default: generateAvatarSeed },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      virtuals: false,
      versionKey: false,
      transform: (_doc, ret) => {
        baseTransform(_doc, ret);
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).refreshTokens;
        return ret;
      },
    },
  },
);

userSchema.pre('validate', function (this: IUser, next) {
  if (!this.displayName && this.name) this.displayName = this.name;
  next();
});

export type UserDoc = HydratedDocument<IUser>;

export const User: Model<IUser> = model<IUser>('User', userSchema);
