import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'room name is required').max(80),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'invite code must be 6 characters')
    .regex(/^[A-Z0-9]+$/, 'invite code must be alphanumeric'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
