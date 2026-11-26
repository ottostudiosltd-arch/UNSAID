import { z } from "zod";

export const collegeCodeSchema = z
  .string()
  .trim()
  .min(4, "Enter your 5-digit college code (e.g. 06155).")
  .max(12, "College code is too long.")
  .regex(/^[a-zA-Z0-9-]+$/, "Use numbers or letters only.");

export const confessionSchema = z.object({
  category: z.enum(["love", "funny", "college", "secrets", "thoughts"]),
  vibe: z.enum(["happy", "stressed", "excited", "other"]).optional(),
  authorName: z
    .string()
    .trim()
    .max(28, "Display name must be 28 characters or less.")
    .optional(),
  text: z
    .string()
    .trim()
    .min(5, "Write at least 5 characters.")
    .max(1000, "Confession cannot exceed 1,000 characters."),
  pollOptions: z
    .array(z.string().trim().min(1).max(60))
    .max(4)
    .optional(),
});

export const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Reply cannot be empty.")
    .max(500, "Comment cannot exceed 500 characters."),
});

export const reportSchema = z.object({
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "doxxing",
    "self_harm",
    "other",
  ]),
  details: z
    .string()
    .trim()
    .max(300, "Details must be 300 characters or less.")
    .optional(),
});
