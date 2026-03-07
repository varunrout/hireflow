import { z } from "zod";

export const JobSourceSchema = z.enum([
  "linkedin",
  "indeed",
  "glassdoor",
  "greenhouse",
  "lever",
  "workday",
  "manual",
  "other",
]);

export const EmploymentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contract",
  "internship",
  "freelance",
]);

export const RemoteTypeSchema = z.enum(["remote", "hybrid", "onsite"]);

export const JobPostingSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  remote_type: RemoteTypeSchema.optional().nullable(),
  employment_type: EmploymentTypeSchema.optional().nullable(),
  description: z.string().min(1).max(50000),
  requirements: z.array(z.string().max(1000)).default([]),
  nice_to_haves: z.array(z.string().max(1000)).default([]),
  salary_min: z.number().int().min(0).optional().nullable(),
  salary_max: z.number().int().min(0).optional().nullable(),
  salary_currency: z.string().length(3).default("USD"),
  source: JobSourceSchema,
  source_url: z.string().url().optional().nullable(),
  source_job_id: z.string().max(500).optional().nullable(),
  posted_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
  raw_html: z.string().optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const JobParseResultSchema = z.object({
  id: z.string().uuid().optional(),
  job_posting_id: z.string().uuid(),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  required_experience_years: z.number().int().min(0).optional().nullable(),
  required_education: z.string().max(200).optional().nullable(),
  keywords: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  parsed_at: z.string().datetime().optional(),
  parser_version: z.string().optional(),
  raw_output: z.record(z.unknown()).optional(),
});

export const JobMatchSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  job_posting_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  overall_score: z.number().min(0).max(100),
  skill_score: z.number().min(0).max(100),
  experience_score: z.number().min(0).max(100),
  education_score: z.number().min(0).max(100),
  location_score: z.number().min(0).max(100),
  salary_score: z.number().min(0).max(100),
  missing_skills: z.array(z.string()).default([]),
  matching_skills: z.array(z.string()).default([]),
  disqualifiers: z.array(z.string()).default([]),
  recommendation: z.enum(["strong_match", "good_match", "partial_match", "poor_match"]),
  explanation: z.string().max(2000).optional(),
  computed_at: z.string().datetime().optional(),
});

export type JobSource = z.infer<typeof JobSourceSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
export type JobParseResult = z.infer<typeof JobParseResultSchema>;
export type JobMatch = z.infer<typeof JobMatchSchema>;
