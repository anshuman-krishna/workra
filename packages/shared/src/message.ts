import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'message cannot be empty')
    .max(4000, 'message too long'),
  // optional file ids attached to the message; must be files that live in the same room.
  attachmentFileIds: z.array(z.string().min(1)).max(10).optional().default([]),
});

export const listMessagesQuerySchema = z.object({
  // pagination cursor: createdAt iso of the oldest message the client currently holds.
  // the server returns rows strictly older than this so it's stable across new sends.
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
