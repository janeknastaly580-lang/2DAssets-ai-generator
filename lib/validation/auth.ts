import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// SPEC §5.1: min 10 chars, at least one letter and one digit
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(30, "Password must be at most 30 characters")
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a digit");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  accept_tos: z.literal(true, { error: "You must accept the Terms of Service and Privacy Policy" }),
  marketing_consent: z.boolean().default(false),
});

export const verifySignupSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resendCodeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(["signup", "password_reset"]),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z.string().regex(/^\d{8}$/, "Enter the 8-digit code"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(30) });

export const changePasswordSchema = z
  .object({ current: z.string().min(1).max(30), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
