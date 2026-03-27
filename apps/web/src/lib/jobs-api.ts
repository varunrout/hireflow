import { apiClient } from "@/lib/api-client";
import type { JobPosting } from "@hireflow/schemas";

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type JobParseResult = {
  id?: string;
  job_posting_id: string;
  required_skills: string[];
  preferred_skills: string[];
  required_experience_years?: number | null;
  required_education?: string | null;
  keywords: string[];
  responsibilities: string[];
  benefits: string[];
  parsed_at?: string;
  parser_version?: string | null;
};

export type ExternalJobSearchParams = {
  role: string;
  location?: string | undefined;
  remote_only?: boolean | undefined;
  limit?: number | undefined;
};

export type ExternalJobResult = {
  provider: string;
  title: string;
  company: string;
  location?: string | null;
  remote_type?: "remote" | "hybrid" | "onsite" | null;
  employment_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "freelance"
    | null;
  description: string;
  requirements: string[];
  nice_to_haves: string[];
  source: CreateJobPayload["source"];
  source_url?: string | null;
  source_job_id?: string | null;
  posted_at?: string | null;
};

export type ExternalJobSearchResponse = {
  items: ExternalJobResult[];
  total: number;
};

export type JobExtractionRequest = {
  job_text: string;
  source_url?: string | undefined;
};

export type JobExtractionPreview = {
  job: CreateJobPayload;
  parse_result: Omit<JobParseResult, "job_posting_id">;
  extraction_method: string;
  confidence_notes: string[];
};

export type JobIngestionResponse = {
  job: JobPosting;
  parse_result: JobParseResult;
  extraction_method: string;
};

export type CreateJobPayload = {
  title: string;
  company: string;
  location?: string | undefined;
  remote_type?: "remote" | "hybrid" | "onsite" | undefined;
  employment_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "freelance"
    | undefined;
  description: string;
  requirements?: string[] | undefined;
  nice_to_haves?: string[] | undefined;
  salary_min?: number | null | undefined;
  salary_max?: number | null | undefined;
  salary_currency?: string | undefined;
  source: "linkedin" | "indeed" | "glassdoor" | "greenhouse" | "lever" | "workday" | "manual" | "other";
  source_url?: string | null | undefined;
  source_job_id?: string | null | undefined;
};

export const jobsApi = {
  list: async (params?: { page?: number | undefined; limit?: number | undefined; search?: string | undefined; source?: string | undefined }) => {
    const res = await apiClient.get<PaginatedResult<JobPosting>>("/jobs", { params });
    return res.data;
  },

  get: async (jobId: string) => {
    const res = await apiClient.get<JobPosting>(`/jobs/${jobId}`);
    return res.data;
  },

  getParseResult: async (jobId: string) => {
    const res = await apiClient.get<JobParseResult>(`/jobs/${jobId}/parse-result`);
    return res.data;
  },

  create: async (payload: CreateJobPayload) => {
    const res = await apiClient.post<JobPosting>("/jobs", payload);
    return res.data;
  },

  searchExternal: async (payload: ExternalJobSearchParams) => {
    const res = await apiClient.post<ExternalJobSearchResponse>("/jobs/search/external", payload);
    return res.data;
  },

  extractFromText: async (payload: JobExtractionRequest) => {
    const res = await apiClient.post<JobExtractionPreview>("/jobs/extract", payload);
    return res.data;
  },

  ingestManual: async (payload: JobExtractionRequest) => {
    const res = await apiClient.post<JobIngestionResponse>("/jobs/ingest-manual", payload);
    return res.data;
  },

  importExternal: async (payload: ExternalJobResult) => {
    const res = await apiClient.post<JobIngestionResponse>("/jobs/import-external", payload);
    return res.data;
  },
};
