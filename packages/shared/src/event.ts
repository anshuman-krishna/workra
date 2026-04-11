import { z } from 'zod';

export const EVENT_TYPES = ['deadline', 'meeting', 'milestone'] as const;
export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof eventTypeSchema>;

const trimmedTitle = z.string().trim().min(1, 'title is required').max(200, 'title too long');
const trimmedDescription = z.string().trim().max(2000, 'description too long');

// accept either a full iso datetime or a bare yyyy-mm-dd. the server normalizes to a date.
const dateInput = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const createEventSchema = z.object({
  title: trimmedTitle,
  description: trimmedDescription.optional(),
  type: eventTypeSchema,
  date: dateInput,
});

export const listEventsQuerySchema = z.object({
  from: dateInput.optional(),
  to: dateInput.optional(),
  type: eventTypeSchema.optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
