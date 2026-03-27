import { apiClient } from "@/lib/api-client";
import type { Application, ApplicationAnswer, ApplicationStatus } from "@hireflow/schemas";

import type { PaginatedResult } from "@/lib/jobs-api";

export type CreateApplicationPayload = {
  job_posting_id: string;
  resume_version_id?: string | null;
  cover_letter_version_id?: string | null;
  notes?: string | null;
  source?: "manual" | "extension" | "import";
};

export const applicationsApi = {
  list: async (params?: { page?: number | undefined; limit?: number | undefined; status?: string | undefined }) => {
    const res = await apiClient.get<PaginatedResult<Application>>("/applications", { params });
    return res.data;
  },

  create: async (payload: CreateApplicationPayload) => {
    const res = await apiClient.post<Application>("/applications", payload);
    return res.data;
  },

  updateStatus: async (applicationId: string, payload: { status: ApplicationStatus; notes?: string | null | undefined }) => {
    const res = await apiClient.patch<Application>(`/applications/${applicationId}/status`, payload);
    return res.data;
  },

  remove: async (applicationId: string) => {
    await apiClient.delete(`/applications/${applicationId}`);
  },

  listAnswers: async (applicationId: string) => {
    const res = await apiClient.get<ApplicationAnswer[]>(`/applications/${applicationId}/answers`);
    return res.data;
  },
};
