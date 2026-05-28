import { z } from 'zod';

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const RefreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const LogoutSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type LogoutInput = z.infer<typeof LogoutSchema>;
