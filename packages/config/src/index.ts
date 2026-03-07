export const APP_NAME = "HireFlow";
export const APP_VERSION = "0.1.0";

export const API_BASE_PATH = "/api/v1";

export const AUTH_TOKEN_EXPIRY_MINUTES = 60;
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const MAX_UPLOAD_SIZE_MB = 10;
export const SUPPORTED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const APPLICATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  saved: ["applied", "withdrawn"],
  applied: ["screening", "rejected", "withdrawn"],
  screening: ["phone_interview", "rejected", "withdrawn"],
  phone_interview: ["technical_interview", "rejected", "withdrawn"],
  technical_interview: ["onsite_interview", "rejected", "withdrawn"],
  onsite_interview: ["offer", "rejected", "withdrawn"],
  offer: ["accepted", "rejected", "withdrawn"],
  rejected: [],
  withdrawn: [],
  accepted: [],
};

export const MATCH_SCORE_THRESHOLDS = {
  STRONG_MATCH: 80,
  GOOD_MATCH: 60,
  PARTIAL_MATCH: 40,
  POOR_MATCH: 0,
} as const;

export const RESUME_SECTION_DEFAULTS = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
] as const;

export const AI_MODELS = {
  DEFAULT: "gpt-4o",
  FAST: "gpt-4o-mini",
  EMBEDDING: "text-embedding-3-small",
} as const;
