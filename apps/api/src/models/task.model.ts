import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { baseSchemaOptions } from '../utils/schema-transform.js';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

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
// report + calendar aggregations group by completion day in a date range
taskSchema.index({ roomId: 1, completedAt: 1 });
// recap: tasks completed by a specific user in a date range
taskSchema.index({ assignedTo: 1, status: 1, completedAt: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Task: Model<TaskDoc> = model<TaskDoc>('Task', taskSchema);
