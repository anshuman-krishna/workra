import { z } from 'zod';

const dateInput = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

// query shape for GET /rooms/:id/report. from/to are inclusive bounds; the server
// treats bare yyyy-mm-dd as the full utc day at each end. userId narrows the report
// to a single member without changing the summary structure.
export const reportQuerySchema = z
  .object({
    from: dateInput,
    to: dateInput,
    userId: z.string().min(1).optional(),
    format: z.enum(['json', 'pdf']).optional().default('json'),
  })
  .refine((v) => new Date(v.from) <= new Date(v.to), {
    message: '"from" must be on or before "to"',
    path: ['to'],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
