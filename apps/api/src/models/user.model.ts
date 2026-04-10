import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions, baseTransform } from '../utils/schema-transform.js';
import { generateAvatarSeed } from '../utils/avatar.js';

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

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
      transform: (doc, ret) => {
        baseTransform(doc, ret);
        delete ret.passwordHash;
        delete ret.refreshTokens;
        return ret;
      },
    },
  },
);

userSchema.pre('validate', function (next) {
  if (!this.displayName && this.name) this.displayName = this.name;
  next();
});

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };

export const User: Model<UserDoc> = model<UserDoc>('User', userSchema);
