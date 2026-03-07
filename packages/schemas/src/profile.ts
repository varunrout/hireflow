import { z } from "zod";

export const WorkExperienceSchema = z.object({
  id: z.string().uuid().optional(),
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  is_current: z.boolean().default(false),
  description: z.string().max(5000).optional(),
  achievements: z.array(z.string().max(500)).default([]),
  technologies: z.array(z.string().max(100)).default([]),
});

export const EducationSchema = z.object({
  id: z.string().uuid().optional(),
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  field_of_study: z.string().max(200).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  gpa: z.number().min(0).max(10).optional().nullable(),
  description: z.string().max(2000).optional(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  url: z.string().url().optional().nullable(),
  repo_url: z.string().url().optional().nullable(),
  technologies: z.array(z.string().max(100)).default([]),
  start_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
});

export const CertificationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  issued_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  credential_id: z.string().max(200).optional(),
  credential_url: z.string().url().optional().nullable(),
});

export const SkillSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  category: z.enum([
    "technical",
    "soft",
    "language",
    "tool",
    "framework",
    "other",
  ]),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

export const CandidateProfileSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  headline: z.string().max(300).optional(),
  summary: z.string().max(3000).optional(),
  phone: z.string().max(30).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  github_url: z.string().url().optional().nullable(),
  years_of_experience: z.number().int().min(0).max(60).optional().nullable(),
  work_experiences: z.array(WorkExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const CandidatePreferenceSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  desired_roles: z.array(z.string().max(200)).default([]),
  desired_locations: z.array(z.string().max(200)).default([]),
  remote_preference: z.enum(["remote", "hybrid", "onsite", "any"]).default("any"),
  employment_type: z
    .array(z.enum(["full_time", "part_time", "contract", "internship", "freelance"]))
    .default(["full_time"]),
  min_salary: z.number().int().min(0).optional().nullable(),
  max_salary: z.number().int().min(0).optional().nullable(),
  salary_currency: z.string().length(3).default("USD"),
  desired_industries: z.array(z.string().max(200)).default([]),
  excluded_companies: z.array(z.string().max(200)).default([]),
  willing_to_relocate: z.boolean().default(false),
  notice_period_days: z.number().int().min(0).optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;
export type CandidatePreference = z.infer<typeof CandidatePreferenceSchema>;
