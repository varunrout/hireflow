import { z } from "zod";

export const ResumeFormatSchema = z.enum(["ats", "designed", "tailored"]);
export const ExportFormatSchema = z.enum(["pdf", "docx", "json"]);

export const SectionTypeSchema = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "custom",
]);

export const ThemeTokensSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1e40af"),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#64748b"),
  font_family: z.string().default("Inter"),
  font_size_base: z.number().min(8).max(16).default(11),
  line_height: z.number().min(1).max(2).default(1.4),
  margin_horizontal: z.number().min(10).max(50).default(20),
  margin_vertical: z.number().min(10).max(50).default(20),
});

export const ResumeTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  format: ResumeFormatSchema,
  description: z.string().max(500).optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  theme_tokens: ThemeTokensSchema,
  section_order: z.array(SectionTypeSchema),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
});

export const ResumeSectionSchema = z.object({
  type: SectionTypeSchema,
  title: z.string().max(100).optional(),
  visible: z.boolean().default(true),
  content_ids: z.array(z.string().uuid()).optional(),
  custom_content: z.string().max(5000).optional(),
});

export const ResumeVersionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  job_posting_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  format: ResumeFormatSchema,
  sections: z.array(ResumeSectionSchema),
  theme_overrides: ThemeTokensSchema.partial().optional(),
  ai_tailored: z.boolean().default(false),
  ai_generation_metadata: z
    .object({
      model: z.string(),
      prompt_version: z.string(),
      generated_at: z.string().datetime(),
    })
    .optional()
    .nullable(),
  status: z.enum(["draft", "final", "archived"]).default("draft"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const CoverLetterVersionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  job_posting_id: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(10000),
  ai_generated: z.boolean().default(false),
  ai_generation_metadata: z
    .object({
      model: z.string(),
      prompt_version: z.string(),
      generated_at: z.string().datetime(),
    })
    .optional()
    .nullable(),
  status: z.enum(["draft", "final", "archived"]).default("draft"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ResumeFormat = z.infer<typeof ResumeFormatSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type ResumeTemplate = z.infer<typeof ResumeTemplateSchema>;
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
export type ResumeVersion = z.infer<typeof ResumeVersionSchema>;
export type CoverLetterVersion = z.infer<typeof CoverLetterVersionSchema>;
