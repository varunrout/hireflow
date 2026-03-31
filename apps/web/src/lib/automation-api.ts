import { apiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

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
  // Scheduling
  schedule_enabled: boolean;
  schedule_cron: string | null;
  schedule_timezone: string;
  schedule_paused: boolean;
  run_window_start: number | null;
  run_window_end: number | null;
  next_scheduled_at: string | null;
  // Enhanced discovery
  freshness_days: number;
  company_blacklist: string[];
  company_whitelist: string[];
  min_salary_floor: number | null;
  experience_levels: string[];
  employment_types: string[];
  target_industries: string[];
  excluded_industries: string[];
  // Confidence tiers
  confidence_auto_apply_threshold: number;
  confidence_review_threshold: number;
  confidence_save_threshold: number;
  // Persona
  persona_id: string | null;
  // Notifications
  email_digest_enabled: boolean;
  email_digest_frequency: string;
  high_match_alert_enabled: boolean;
  high_match_alert_threshold: number;
  created_at: string;
  updated_at: string;
};

export type AutomationPipelineSettingsPayload = Omit<
  AutomationPipelineSettings,
  "id" | "user_id" | "next_scheduled_at" | "created_at" | "updated_at"
>;

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

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
  profile_completeness: number;
  profile_completeness_breakdown: Record<string, boolean>;
  data_quality_warnings: string[];
  skill_coverage: number;
  resume_quality_score: number;
};

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export type AutomationRun = {
  id: string;
  user_id: string;
  triggered_by: string;
  status: string;
  matched_jobs_count: number;
  reviewed_jobs_count: number;
  applied_jobs_count: number;
  skipped_jobs_count: number;
  queued_for_review_count: number;
  jobs_evaluated: number;
  new_matches_count: number;
  expired_since_last_run: number;
  scoring_duration_ms: number | null;
  total_duration_ms: number | null;
  error_message: string | null;
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
  persona_id?: string | null;
  override_min_score?: number | null;
  override_max_jobs?: number | null;
};

// ---------------------------------------------------------------------------
// Approval Queue
// ---------------------------------------------------------------------------

export type ApprovalQueueItem = {
  id: string;
  user_id: string;
  job_posting_id: string;
  job_match_id: string;
  pipeline_run_id: string | null;
  status: string;
  score: number;
  recommendation: string;
  decided_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  job_title: string | null;
  job_company: string | null;
  job_location: string | null;
};

export type ApprovalQueueList = {
  items: ApprovalQueueItem[];
  total: number;
};

export type ApprovalDecision = {
  action: "approved" | "rejected" | "deferred";
  notes?: string;
};

export type ApprovalBatchDecision = {
  item_ids: string[];
  action: "approved" | "rejected" | "deferred";
  notes?: string;
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type AutomationAnalytics = {
  total_runs: number;
  total_matches: number;
  total_applications: number;
  total_approvals: number;
  total_rejections: number;
  avg_match_score: number;
  score_distribution: Record<string, number>;
  match_trend: Array<{ date: string; count: number; avg_score: number }>;
  top_companies: Array<{
    company: string;
    match_count: number;
    avg_score: number;
  }>;
  application_funnel: Record<string, number>;
  source_effectiveness: Array<{
    source: string;
    matches: number;
    avg_score: number;
  }>;
  daily_stats: Array<{
    date: string;
    runs: number;
    applied: number;
    matched: number;
  }>;
};

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type SchedulePreset = {
  label: string;
  cron: string;
  description: string;
};

export type ScheduleInfo = {
  schedule_enabled: boolean;
  schedule_cron: string | null;
  schedule_timezone: string;
  schedule_paused: boolean;
  next_scheduled_at: string | null;
  presets: SchedulePreset[];
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type AutomationNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type NotificationList = {
  items: AutomationNotification[];
  total: number;
  unread_count: number;
};

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export const automationApi = {
  // Settings
  getSettings: async (): Promise<AutomationPipelineSettings> => {
    const res = await apiClient.get<AutomationPipelineSettings>(
      "/automation/settings"
    );
    return res.data;
  },

  saveSettings: async (
    data: Partial<AutomationPipelineSettingsPayload>
  ): Promise<AutomationPipelineSettings> => {
    const res = await apiClient.put<AutomationPipelineSettings>(
      "/automation/settings",
      data
    );
    return res.data;
  },

  // Readiness
  getReadiness: async (): Promise<AutomationReadiness> => {
    const res = await apiClient.get<AutomationReadiness>(
      "/automation/readiness"
    );
    return res.data;
  },

  // Runs
  runNow: async (payload: AutomationRunRequest): Promise<AutomationRun> => {
    const res = await apiClient.post<AutomationRun>(
      "/automation/runs",
      payload
    );
    return res.data;
  },

  listRuns: async (limit = 20): Promise<AutomationRunList> => {
    const res = await apiClient.get<AutomationRunList>("/automation/runs", {
      params: { limit },
    });
    return res.data;
  },

  getRunDetail: async (runId: string): Promise<AutomationRun> => {
    const res = await apiClient.get<AutomationRun>(
      `/automation/runs/${runId}`
    );
    return res.data;
  },

  cancelRun: async (runId: string): Promise<AutomationRun> => {
    const res = await apiClient.post<AutomationRun>(
      `/automation/runs/${runId}/cancel`
    );
    return res.data;
  },

  retryRun: async (runId: string): Promise<AutomationRun> => {
    const res = await apiClient.post<AutomationRun>(
      `/automation/runs/${runId}/retry`
    );
    return res.data;
  },

  // Approval Queue
  getApprovalQueue: async (
    status = "pending",
    limit = 50,
    offset = 0
  ): Promise<ApprovalQueueList> => {
    const res = await apiClient.get<ApprovalQueueList>(
      "/automation/approval-queue",
      { params: { status, limit, offset } }
    );
    return res.data;
  },

  decideApproval: async (
    itemId: string,
    decision: ApprovalDecision
  ): Promise<ApprovalQueueItem> => {
    const res = await apiClient.post<ApprovalQueueItem>(
      `/automation/approval-queue/${itemId}/decide`,
      decision
    );
    return res.data;
  },

  batchDecide: async (
    decision: ApprovalBatchDecision
  ): Promise<ApprovalQueueList> => {
    const res = await apiClient.post<ApprovalQueueList>(
      "/automation/approval-queue/batch",
      decision
    );
    return res.data;
  },

  // Analytics
  getAnalytics: async (days = 30): Promise<AutomationAnalytics> => {
    const res = await apiClient.get<AutomationAnalytics>(
      "/automation/analytics",
      { params: { days } }
    );
    return res.data;
  },

  // Schedule
  getSchedule: async (): Promise<ScheduleInfo> => {
    const res = await apiClient.get<ScheduleInfo>("/automation/schedule");
    return res.data;
  },

  // Notifications
  getNotifications: async (
    limit = 20,
    unreadOnly = false
  ): Promise<NotificationList> => {
    const res = await apiClient.get<NotificationList>(
      "/automation/notifications",
      { params: { limit, unread_only: unreadOnly } }
    );
    return res.data;
  },

  markNotificationRead: async (
    id: string
  ): Promise<AutomationNotification> => {
    const res = await apiClient.post<AutomationNotification>(
      `/automation/notifications/${id}/read`
    );
    return res.data;
  },

  markAllNotificationsRead: async (): Promise<{ status: string }> => {
    const res = await apiClient.post<{ status: string }>(
      "/automation/notifications/read-all"
    );
    return res.data;
  },
};
