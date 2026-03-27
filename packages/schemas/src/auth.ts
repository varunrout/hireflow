import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
  full_name: z.string().min(1).max(200),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal("bearer"),
  expires_in: z.number().int().positive(),
});

export const RefreshTokenRequestSchema = z.object({
  refresh_token: z.string(),
});

export const UpdateUserRequestSchema = z
  .object({
    email: z.string().email().max(255).optional(),
    full_name: z.string().min(1).max(200).optional(),
  })
  .refine((value) => value.email !== undefined || value.full_name !== undefined, {
    message: "At least one field must be provided",
  });

export const ChangePasswordRequestSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  is_active: z.boolean(),
  is_verified: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type User = z.infer<typeof UserSchema>;
