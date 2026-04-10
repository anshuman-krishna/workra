import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
