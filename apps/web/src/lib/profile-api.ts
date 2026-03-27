import { apiClient } from "@/lib/api-client";
import type { CandidateProfile, CandidatePreference } from "@hireflow/schemas";

export type CandidatePreferencesPayload = {
  desired_roles?: string[] | undefined;
  desired_locations?: string[] | undefined;
  remote_preference?: "remote" | "hybrid" | "onsite" | "any" | undefined;
  employment_types?:
    | Array<"full_time" | "part_time" | "contract" | "internship" | "freelance">
    | undefined;
  min_salary?: number | null;
  max_salary?: number | null;
  salary_currency?: string | undefined;
  desired_industries?: string[] | undefined;
  excluded_companies?: string[] | undefined;
  willing_to_relocate?: boolean | undefined;
  notice_period_days?: number | null;
};

export type SkillPayload = {
  name: string;
  category: "technical" | "soft" | "language" | "tool" | "framework" | "other";
  proficiency?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
};

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

  upsertPreferences: async (data: CandidatePreferencesPayload): Promise<CandidatePreference> => {
    const res = await apiClient.put<CandidatePreference>("/profiles/me/preferences", data);
    return res.data;
  },

  addSkill: async (data: SkillPayload) => {
    const res = await apiClient.post<CandidateProfile["skills"][number]>("/profiles/me/skills", data);
    return res.data;
  },

  deleteSkill: async (skillId: string) => {
    await apiClient.delete(`/profiles/me/skills/${skillId}`);
  },
};
