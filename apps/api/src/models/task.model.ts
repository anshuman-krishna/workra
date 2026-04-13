import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ITask {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: TASK_STATUSES,
      required: true,
      default: 'todo',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

// list-by-room is the dominant query
taskSchema.index({ roomId: 1, status: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1 });
// listTasks without status filter, sorted by createdAt
taskSchema.index({ roomId: 1, createdAt: -1 });
// report + calendar aggregations group by completion day in a date range
taskSchema.index({ roomId: 1, completedAt: 1 });
// recap: tasks completed by a specific user in a date range
taskSchema.index({ assignedTo: 1, status: 1, completedAt: 1 });

export type TaskDoc = HydratedDocument<ITask>;

export const Task: Model<ITask> = model<ITask>('Task', taskSchema);
