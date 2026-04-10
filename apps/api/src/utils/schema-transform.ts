import type { SchemaOptions, ToObjectOptions } from 'mongoose';

// strips _id, __v, and any internally-marked fields when serializing.
// applied via toJSON/toObject so it cannot be forgotten in a controller.
export const baseTransform: NonNullable<ToObjectOptions['transform']> = (_doc, ret) => {
  if (ret._id !== undefined) {
    ret.id = String(ret._id);
    delete ret._id;
  }
  delete ret.__v;
  return ret;
};

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: false, versionKey: false, transform: baseTransform },
  toObject: { virtuals: false, versionKey: false, transform: baseTransform },
};
