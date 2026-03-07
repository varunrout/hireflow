import { z } from "zod";

export const ApplicationStatusSchema = z.enum([
  "saved",
  "applied",
  "screening",
  "phone_interview",
  "technical_interview",
  "onsite_interview",
  "offer",
  "rejected",
  "withdrawn",
  "accepted",
]);

export const ApplicationSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  job_posting_id: z.string().uuid(),
  resume_version_id: z.string().uuid().optional().nullable(),
  cover_letter_version_id: z.string().uuid().optional().nullable(),
  status: ApplicationStatusSchema.default("saved"),
  applied_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.enum(["manual", "extension", "import"]).default("manual"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const ApplicationAnswerSchema = z.object({
  id: z.string().uuid().optional(),
  application_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
  answer: z.string().max(10000),
  ai_generated: z.boolean().default(false),
  reviewed: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const QuestionBankEntrySchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
  answer: z.string().max(10000),
  category: z.enum([
    "behavioral",
    "technical",
    "situational",
    "background",
    "motivation",
    "other",
  ]),
  tags: z.array(z.string().max(100)).default([]),
  times_used: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type ApplicationAnswer = z.infer<typeof ApplicationAnswerSchema>;
export type QuestionBankEntry = z.infer<typeof QuestionBankEntrySchema>;
