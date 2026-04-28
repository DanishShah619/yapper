import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const sendConnectionRequestSchema = z.object({
  username: z.string().min(3).max(32),
});

// Add more schemas as needed for other mutations and endpoints

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues.map((e: { message: string }) => e.message).join('; '));
  }
  return result.data;
}
