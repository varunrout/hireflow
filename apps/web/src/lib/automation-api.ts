import { apiClient } from "@/lib/api-client";

export type AutomationPipelineSettings = {
  id: string;
  user_id: string;
  enabled: boolean;
  auto_apply_enabled: boolean;
  require_human_review: boolean;
  auto_tailor_resume: boolean;
  auto_generate_cover_letter: boolean;
  allowed_sources: string[];
  search_terms: string[];
  target_locations: string[];
  excluded_keywords: string[];
  min_match_score: number;
  max_jobs_per_run: number;
  max_applications_per_day: number;
  created_at: string;
  updated_at: string;
};

export type AutomationPipelineSettingsPayload = {
  enabled: boolean;
  auto_apply_enabled: boolean;
  require_human_review: boolean;
  auto_tailor_resume: boolean;
  auto_generate_cover_letter: boolean;
  allowed_sources: string[];
  search_terms: string[];
  target_locations: string[];
  excluded_keywords: string[];
  min_match_score: number;
  max_jobs_per_run: number;
  max_applications_per_day: number;
};

export type AutomationReadiness = {
  has_profile: boolean;
  has_preferences: boolean;
  resume_count: number;
  saved_job_count: number;
  application_count: number;
  job_match_count: number;
  ready_for_matching: boolean;
  ready_for_auto_apply: boolean;
  blockers: string[];
  suggestions: string[];
};

export type AutomationRun = {
  id: string;
  user_id: string;
  triggered_by: string;
  status: string;
  matched_jobs_count: number;
  reviewed_jobs_count: number;
  applied_jobs_count: number;
  skipped_jobs_count: number;
  summary: Record<string, unknown>;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type AutomationRunList = {
  items: AutomationRun[];
  total: number;
};

export type AutomationRunRequest = {
  dry_run: boolean;
};

export const automationApi = {
  getSettings: async (): Promise<AutomationPipelineSettings> => {
    const res = await apiClient.get<AutomationPipelineSettings>("/automation/settings");
    return res.data;
  },

  saveSettings: async (
    data: AutomationPipelineSettingsPayload
  ): Promise<AutomationPipelineSettings> => {
    const res = await apiClient.put<AutomationPipelineSettings>("/automation/settings", data);
    return res.data;
  },

  getReadiness: async (): Promise<AutomationReadiness> => {
    const res = await apiClient.get<AutomationReadiness>("/automation/readiness");
    return res.data;
  },

  runNow: async (payload: AutomationRunRequest): Promise<AutomationRun> => {
    const res = await apiClient.post<AutomationRun>("/automation/runs", payload);
    return res.data;
  },

  listRuns: async (limit = 20): Promise<AutomationRunList> => {
    const res = await apiClient.get<AutomationRunList>("/automation/runs", {
      params: { limit },
    });
    return res.data;
  },
};
