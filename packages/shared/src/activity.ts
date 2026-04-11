import { z } from 'zod';

export const activityCategorySchema = z.enum(['session', 'task', 'file', 'room']);

export const listActivityQuerySchema = z.object({
  category: activityCategorySchema.optional(),
  // pagination cursor: createdAt iso of the last item the client has seen.
  // we return rows strictly older than this so it's stable across new writes.
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
