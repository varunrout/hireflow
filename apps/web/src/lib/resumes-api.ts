import { apiClient } from "@/lib/api-client";
import type { ResumeVersion } from "@hireflow/schemas";

import type { PaginatedResult } from "@/lib/jobs-api";

export type CreateResumePayload = {
  name: string;
  format: "ats" | "designed" | "tailored";
  template_id?: string | null;
  job_posting_id?: string | null;
  sections?: Array<Record<string, unknown>>;
  theme_overrides?: Record<string, unknown> | null;
};

export const resumesApi = {
  list: async (params?: { page?: number | undefined; limit?: number | undefined }) => {
    const res = await apiClient.get<PaginatedResult<ResumeVersion>>("/resumes", { params });
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

  remove: async (resumeId: string) => {
    await apiClient.delete(`/resumes/${resumeId}`);
  },
};
