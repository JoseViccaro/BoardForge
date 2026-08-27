import { z } from "zod";
import { UserRole } from "../../../modules/identity-access/domain/value-objects/UserRole.js";
import { TenantPlan } from "../../../modules/identity-access/domain/entities/Organization.js";

export const RegisterRequestSchema = z.object({
  slug: z.string().min(2).max(64),
  orgName: z.string().min(2).max(128),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.nativeEnum(UserRole).optional(),
  plan: z.nativeEnum(TenantPlan).optional(),
});

export type RegisterRequestDto = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
