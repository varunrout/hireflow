import { apiClient } from "@/lib/api-client";
import type { ResumeVersion } from "@hireflow/schemas";

import type { PaginatedResult } from "@/lib/jobs-api";

// ------------------------------------------------------------------
// Section types (stored in ResumeVersion.sections JSONB)
// ------------------------------------------------------------------

export interface HeaderSection {
  type: "header";
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website_url: string;
  linkedin_url: string;
  github_url: string;
}

export interface SummarySection {
  type: "summary";
  content: string;
}

export interface ExperienceItem {
  id?: string;
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface ExperienceSection {
  type: "experience";
  items: ExperienceItem[];
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  gpa?: number | null;
  description: string;
}

export interface EducationSection {
  type: "education";
  items: EducationItem[];
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface SkillsSection {
  type: "skills";
  groups: SkillGroup[];
}

export interface ProjectItem {
  id?: string;
  name: string;
  description: string;
  url: string;
  repo_url: string;
  technologies: string[];
  start_date: string;
  end_date: string;
}

export interface ProjectsSection {
  type: "projects";
  items: ProjectItem[];
}

export interface CertItem {
  id?: string;
  name: string;
  issuer: string;
  issued_date: string;
  expiry_date: string;
  credential_url: string;
}

export interface CertsSection {
  type: "certifications";
  items: CertItem[];
}

export type ResumeSection =
  | HeaderSection
  | SummarySection
  | ExperienceSection
  | EducationSection
  | SkillsSection
  | ProjectsSection
  | CertsSection;

export type ResumeWithSections = ResumeVersion & {
  persona_id?: string | null;
  sections: ResumeSection[];
};

// ------------------------------------------------------------------
// API payload types
// ------------------------------------------------------------------

export type CreateResumePayload = {
  name: string;
  format: "ats" | "designed" | "tailored";
  template_id?: string | null;
  job_posting_id?: string | null;
  persona_id?: string | null;
  sections?: Array<Record<string, unknown>>;
  theme_overrides?: Record<string, unknown> | null;
};

export type AiEditPayload = {
  section_type: string;
  content: string;
  instruction: string;
  job_description?: string | null;
  persona_name?: string | null;
};

// ------------------------------------------------------------------
// API client
// ------------------------------------------------------------------

export const resumesApi = {
  list: async (params?: {
    page?: number | undefined;
    limit?: number | undefined;
    persona_id?: string | undefined;
  }) => {
    const res = await apiClient.get<PaginatedResult<ResumeVersion>>("/resumes", { params });
    return res.data;
  },

  get: async (resumeId: string): Promise<ResumeWithSections> => {
    const res = await apiClient.get<ResumeWithSections>(`/resumes/${resumeId}`);
    return res.data;
  },

  create: async (payload: CreateResumePayload) => {
    const res = await apiClient.post<ResumeVersion>("/resumes", payload);
    return res.data;
  },

  update: async (resumeId: string, payload: CreateResumePayload) => {
    const res = await apiClient.put<ResumeVersion>(`/resumes/${resumeId}`, payload);
    return res.data;
  },

  saveSections: async (resumeId: string, sections: ResumeSection[]): Promise<ResumeWithSections> => {
    const res = await apiClient.patch<ResumeWithSections>(`/resumes/${resumeId}/sections`, {
      sections,
    });
    return res.data;
  },

  seedFromProfile: async (resumeId: string): Promise<ResumeWithSections> => {
    const res = await apiClient.post<ResumeWithSections>(`/resumes/${resumeId}/seed`);
    return res.data;
  },

  aiEdit: async (resumeId: string, payload: AiEditPayload): Promise<{ improved: string }> => {
    const res = await apiClient.post<{ improved: string }>(
      `/resumes/${resumeId}/ai-edit`,
      payload
    );
    return res.data;
  },

  remove: async (resumeId: string) => {
    await apiClient.delete(`/resumes/${resumeId}`);
  },
};
