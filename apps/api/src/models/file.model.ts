import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export interface IFile {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  rootFileId: mongoose.Types.ObjectId;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  version: number;
  isLatest: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// versioning model: every uploaded blob is a row.
// the first version of a file points rootFileId at its own _id and version=1.
// subsequent uploads with the same name in the same room create a new row that
// shares rootFileId with version=N+1, and demote the previous latest.
// listFiles returns one row per stack (the latest version) with a versionCount.
const fileSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    // root of the version stack. equals _id for v1, otherwise points back at v1's id.
    rootFileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true },
    version: { type: Number, required: true, min: 1, default: 1 },
    isLatest: { type: Boolean, required: true, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

// list-by-room (latest only) is the dominant query
fileSchema.index({ roomId: 1, isLatest: 1, createdAt: -1 });
// version stack lookups
fileSchema.index({ rootFileId: 1, version: -1 });
// dedupe / lookup-by-name when uploading new versions
fileSchema.index({ roomId: 1, name: 1, isLatest: 1 });

export type FileDoc = HydratedDocument<IFile>;

export const FileModel: Model<IFile> = model<IFile>('File', fileSchema);
