import { z } from 'zod';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

const trimmedTitle = z.string().trim().min(1, 'title is required').max(200, 'title too long');
const trimmedDescription = z.string().trim().max(2000, 'description too long');

const dueDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const createTaskSchema = z.object({
  title: trimmedTitle,
  description: trimmedDescription.optional(),
  status: taskStatusSchema.optional().default('todo'),
  assignedTo: z.string().min(1).nullable().optional(),
  dueDate: dueDate.nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: trimmedTitle.optional(),
    description: trimmedDescription.nullable().optional(),
    status: taskStatusSchema.optional(),
    assignedTo: z.string().min(1).nullable().optional(),
    dueDate: dueDate.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  assignedTo: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
