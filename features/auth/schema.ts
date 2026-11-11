import { z } from "zod";

const email = z.email("Enter a valid email address.").trim().toLowerCase();
const next = z.string().optional();

export const LogInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  next,
});

export const SignUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(72),
  next,
});

export const MagicLinkSchema = z.object({ email, next });

export type LogInInput = z.infer<typeof LogInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
export type MagicLinkInput = z.infer<typeof MagicLinkSchema>;
