import { z } from 'zod';

export const startSessionSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  intent: z.string().trim().min(1, 'intent is required').max(200, 'intent too long'),
});

export const stopSessionSchema = z.object({
  summary: z.string().trim().max(1000, 'summary too long').optional(),
});

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const listSessionsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  userId: z.string().optional(),
  hasSummary: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type StopSessionInput = z.infer<typeof stopSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
