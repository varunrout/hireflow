import { apiClient } from "@/lib/api-client";
import type { CandidateProfile, CandidatePreference } from "@hireflow/schemas";

export const profileApi = {
  getMyProfile: async (): Promise<CandidateProfile> => {
    const res = await apiClient.get<CandidateProfile>("/profiles/me");
    return res.data;
  },

  createProfile: async (data: Partial<CandidateProfile>): Promise<CandidateProfile> => {
    const res = await apiClient.post<CandidateProfile>("/profiles/me", data);
    return res.data;
  },

  updateProfile: async (data: Partial<CandidateProfile>): Promise<CandidateProfile> => {
    const res = await apiClient.put<CandidateProfile>("/profiles/me", data);
    return res.data;
  },

  getPreferences: async (): Promise<CandidatePreference> => {
    const res = await apiClient.get<CandidatePreference>("/profiles/me/preferences");
    return res.data;
  },

  upsertPreferences: async (data: Partial<CandidatePreference>): Promise<CandidatePreference> => {
    const res = await apiClient.put<CandidatePreference>("/profiles/me/preferences", data);
    return res.data;
  },
};
