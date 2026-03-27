"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  jobsApi,
  type CreateJobPayload,
  type ExternalJobResult,
  type JobExtractionPreview,
  type PaginatedResult,
} from "@/lib/jobs-api";
import type { JobPosting } from "@hireflow/schemas";

type ManualJobForm = {
  title: string;
  company: string;
  location: string;
  description: string;
  source: CreateJobPayload["source"];
};

type WorkspaceTab = "live" | "extract" | "manual";

const initialManualForm = {
  title: "",
  company: "",
  location: "",
  description: "",
  source: "manual",
} satisfies ManualJobForm;

const initialLiveSearch = {
  role: "",
  location: "",
  remote_only: true,
};

const initialExtractForm = {
  job_text: "",
  source_url: "",
};

const BOARD_BADGES = ["Adzuna", "Reed", "Remotive"];

function providerLabel(provider: string) {
  switch (provider) {
    case "adzuna":
      return "Adzuna";
    case "reed":
      return "Reed";
    case "remotive":
      return "Remotive";
    default:
      return provider;
  }
}

function upsertJobInCache(
  current: PaginatedResult<JobPosting> | undefined,
  job: JobPosting
): PaginatedResult<JobPosting> | undefined {
  if (!current) return current;

  const withoutExisting = current.items.filter((item) => item.id !== job.id);

  return {
    ...current,
    items: [job, ...withoutExisting].slice(0, current.limit),
    total: withoutExisting.length === current.items.length ? current.total + 1 : current.total,
  };
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const savedJobsListRef = useRef<HTMLDivElement | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("live");
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualJobForm>(initialManualForm);
  const [liveSearch, setLiveSearch] = useState(initialLiveSearch);
  const [liveResults, setLiveResults] = useState<ExternalJobResult[]>([]);
  const [extractForm, setExtractForm] = useState(initialExtractForm);
  const [extractedPreview, setExtractedPreview] = useState<JobExtractionPreview | null>(null);
  const [selectedExternalJob, setSelectedExternalJob] = useState<string | null>(null);
  const [liveSearchMessage, setLiveSearchMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["jobs", search],
    queryFn: () => jobsApi.list({ limit: 50, search: search || undefined }),
  });

  const selectedJob = useMemo(
    () => jobsQuery.data?.items.find((job) => job.id === selectedJobId) ?? jobsQuery.data?.items[0],
    [jobsQuery.data, selectedJobId]
  );

  const parseResultQuery = useQuery({
    queryKey: ["job-parse", selectedJob?.id],
    queryFn: () => jobsApi.getParseResult(selectedJob!.id!),
    enabled: !!selectedJob?.id,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      jobsApi.create({
        title: manualForm.title,
        company: manualForm.company,
        location: manualForm.location || undefined,
        description: manualForm.description,
        source: manualForm.source,
        requirements: [],
        nice_to_haves: [],
      }),
    onSuccess: (job) => {
      setManualForm(initialManualForm);
      setSelectedJobId(job.id ?? null);
      queryClient.setQueryData<PaginatedResult<JobPosting>>(["jobs", ""], (current) =>
        upsertJobInCache(current, job)
      );
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const liveSearchMutation = useMutation({
    mutationFn: () =>
      jobsApi.searchExternal({
        role: liveSearch.role,
        location: liveSearch.location || undefined,
        remote_only: liveSearch.remote_only,
        limit: 24,
      }),
    onSuccess: (data) => {
      setLiveSearchMessage(
        data.items.length
          ? `Found ${data.items.length} live jobs across connected boards.`
          : "No jobs were found for that search. Try another role or location."
      );
      setLiveResults(data.items);
      setSelectedExternalJob(
        data.items[0]?.source_url ?? data.items[0]?.source_job_id ?? data.items[0]?.title ?? null
      );
    },
    onError: () => {
      setLiveSearchMessage("Live search failed. Check your job board keys and try again.");
    },
  });

  const importExternalMutation = useMutation({
    mutationFn: (job: ExternalJobResult) => {
      setImportMessage(null);
      return jobsApi.importExternal(job);
    },
    onSuccess: (result) => {
      setSearch("");
      setImportMessage(`Imported ${result.job.title} into HireFlow.`);
      setSelectedJobId(result.job.id ?? null);
      queryClient.setQueryData<PaginatedResult<JobPosting>>(["jobs", ""], (current) =>
        upsertJobInCache(current, result.job)
      );
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      savedJobsListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => {
      setImportMessage("Import failed. Try again in a few seconds.");
    },
  });

  const extractMutation = useMutation({
    mutationFn: () =>
      jobsApi.extractFromText({
        job_text: extractForm.job_text,
        source_url: extractForm.source_url || undefined,
      }),
    onSuccess: (preview) => {
      setExtractedPreview(preview);
      setManualForm({
        title: preview.job.title,
        company: preview.job.company,
        location: preview.job.location ?? "",
        description: preview.job.description,
        source: "manual",
      });
      setWorkspaceTab("extract");
    },
  });

  const ingestMutation = useMutation({
    mutationFn: () =>
      jobsApi.ingestManual({
        job_text: extractForm.job_text,
        source_url: extractForm.source_url || undefined,
      }),
    onSuccess: (result) => {
      setSelectedJobId(result.job.id ?? null);
      queryClient.setQueryData<PaginatedResult<JobPosting>>(["jobs", ""], (current) =>
        upsertJobInCache(current, result.job)
      );
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setExtractForm(initialExtractForm);
      setExtractedPreview(null);
    },
  });

  const selectedExternal = useMemo(
    () =>
      liveResults.find(
        (job) =>
          (job.source_url ?? job.source_job_id ?? `${job.provider}-${job.title}`) ===
          selectedExternalJob
      ) ?? liveResults[0],
    [liveResults, selectedExternalJob]
  );

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of liveResults) {
      counts[item.provider] = (counts[item.provider] ?? 0) + 1;
    }
    return counts;
  }, [liveResults]);

  const stats = [
    { label: "Saved jobs", value: jobsQuery.data?.total ?? 0, sub: "Tracked in HireFlow" },
    { label: "Live results", value: liveResults.length, sub: "Across multiple boards" },
    {
      label: "Boards covered",
      value: BOARD_BADGES.length,
      sub: BOARD_BADGES.join(" • "),
    },
    {
      label: "AI extraction",
      value: extractedPreview ? extractedPreview.extraction_method : "ready",
      sub: "Paste any job description",
    },
  ];

  const tabs: Array<{ id: WorkspaceTab; label: string; description: string }> = [
    { id: "live", label: "Live search", description: "Pull from leading job boards" },
    { id: "extract", label: "AI extract", description: "Paste a JD and structure it" },
    { id: "manual", label: "Manual add", description: "Enter a role yourself" },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              The jobs workspace now supports multi-board search, AI-assisted extraction from raw
              job descriptions, and manual job capture in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {BOARD_BADGES.map((board) => (
              <span
                key={board}
                className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {board}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-card p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.45fr]">
          <section className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Saved jobs</h2>
                <p className="text-sm text-muted-foreground">
                  Everything you import or create appears here.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {jobsQuery.data?.total ?? 0} total
              </span>
            </div>

            <div className="mt-5">
              <Label htmlFor="job-search">Search saved jobs</Label>
              <Input
                id="job-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or company"
              />
            </div>

            <div ref={savedJobsListRef} className="mt-5 max-h-[760px] space-y-3 overflow-auto pr-1">
              {jobsQuery.data?.items.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id!)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedJob?.id === job.id ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-accent"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {job.source}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {job.location || "Location TBD"}
                  </p>
                </button>
              ))}
              {!jobsQuery.data?.items.length && !jobsQuery.isLoading && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No jobs saved yet. Pull live jobs or paste a description to get started.
                </div>
              )}
            </div>
          </section>

          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Selected job</h2>
                  <p className="text-sm text-muted-foreground">
                    Review the structured details and extracted requirements.
                  </p>
                </div>
              </div>

              {selectedJob ? (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{selectedJob.title}</h3>
                      <p className="text-muted-foreground">{selectedJob.company}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                        {selectedJob.location || "TBD"}
                      </span>
                      <span className="rounded-full border px-3 py-1 text-xs">
                        {selectedJob.source}
                      </span>
                      <span className="rounded-full border px-3 py-1 text-xs">
                        {selectedJob.employment_type || "employment unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border p-4">
                      <p className="text-xs text-muted-foreground">Required skills</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {parseResultQuery.data?.required_skills.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-xs text-muted-foreground">Keywords</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {parseResultQuery.data?.keywords.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-xs text-muted-foreground">Experience</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {parseResultQuery.data?.required_experience_years ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-xs text-muted-foreground">Benefits</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {parseResultQuery.data?.benefits.length ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <div className="rounded-md border p-4">
                      <h4 className="font-semibold">Description</h4>
                      <p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                        {selectedJob.description}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-md border p-4">
                        <h4 className="font-semibold">Required skills</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(parseResultQuery.data?.required_skills ?? []).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                          {!parseResultQuery.data?.required_skills.length && (
                            <p className="text-sm text-muted-foreground">No parse result yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border p-4">
                        <h4 className="font-semibold">Keywords</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(parseResultQuery.data?.keywords ?? []).map((keyword) => (
                            <span key={keyword} className="rounded-full border px-3 py-1 text-xs">
                              {keyword}
                            </span>
                          ))}
                          {!parseResultQuery.data?.keywords.length && (
                            <p className="text-sm text-muted-foreground">No keywords available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Select a job to inspect it.</p>
              )}
            </section>

            <section className="rounded-lg border bg-card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Job sourcing workspace</h2>
                  <p className="text-sm text-muted-foreground">
                    Search across connected boards, extract jobs from pasted JDs, or create one
                    manually.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWorkspaceTab(tab.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${workspaceTab === tab.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {tabs.find((tab) => tab.id === workspaceTab)?.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tabs.find((tab) => tab.id === workspaceTab)?.description}
                </p>
              </div>

              {workspaceTab === "live" && (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_auto]">
                    <div>
                      <Label htmlFor="live-role">Role</Label>
                      <Input
                        id="live-role"
                        value={liveSearch.role}
                        onChange={(e) =>
                          setLiveSearch((current) => ({ ...current, role: e.target.value }))
                        }
                        placeholder="Frontend Engineer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="live-location">Location</Label>
                      <Input
                        id="live-location"
                        value={liveSearch.location}
                        onChange={(e) =>
                          setLiveSearch((current) => ({ ...current, location: e.target.value }))
                        }
                        placeholder="London"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={() => liveSearchMutation.mutate()}
                        disabled={!liveSearch.role || liveSearchMutation.isPending}
                        className="w-full"
                      >
                        {liveSearchMutation.isPending ? "Searching..." : "Search boards"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={liveSearch.remote_only}
                        onChange={(e) =>
                          setLiveSearch((current) => ({
                            ...current,
                            remote_only: e.target.checked,
                          }))
                        }
                      />
                      Remote only
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {BOARD_BADGES.map((board) => (
                        <span
                          key={board}
                          className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
                        >
                          {board}
                        </span>
                      ))}
                    </div>
                  </div>

                  {(liveSearchMessage || importMessage) && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {liveSearchMessage && (
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          {liveSearchMessage}
                        </div>
                      )}
                      {importMessage && (
                        <div className="rounded-md border bg-primary/5 p-3 text-sm text-foreground">
                          {importMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {!!liveResults.length && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {Object.entries(providerCounts).map(([provider, count]) => (
                        <div key={provider} className="rounded-md border p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {providerLabel(provider)}
                          </p>
                          <p className="mt-1 text-2xl font-semibold">{count}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
                    <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                      {liveResults.map((job) => {
                        const key = job.source_url ?? job.source_job_id ?? `${job.provider}-${job.title}`;
                        const isSelected =
                          (selectedExternal?.source_url ??
                            selectedExternal?.source_job_id ??
                            `${selectedExternal?.provider}-${selectedExternal?.title}`) === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedExternalJob(key)}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-accent"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{job.title}</p>
                                <p className="text-sm text-muted-foreground">{job.company}</p>
                              </div>
                              <span className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {providerLabel(job.provider)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {job.location || "Remote / flexible"}
                            </p>
                          </button>
                        );
                      })}
                      {!liveResults.length && !liveSearchMutation.isPending && (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Search by role to pull real jobs from the connected boards.
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border p-5">
                      {selectedExternal ? (
                        <div className="space-y-5">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <h3 className="text-xl font-semibold">{selectedExternal.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {selectedExternal.company} • {providerLabel(selectedExternal.provider)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                                {selectedExternal.location || "Unspecified"}
                              </span>
                              {selectedExternal.remote_type && (
                                <span className="rounded-full border px-3 py-1 text-xs">
                                  {selectedExternal.remote_type}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-md border p-3">
                              <p className="text-xs text-muted-foreground">Posted</p>
                              <p className="mt-1 text-sm font-medium">
                                {selectedExternal.posted_at
                                  ? new Date(selectedExternal.posted_at).toLocaleDateString()
                                  : "Unknown"}
                              </p>
                            </div>
                            <div className="rounded-md border p-3">
                              <p className="text-xs text-muted-foreground">Board</p>
                              <p className="mt-1 text-sm font-medium">
                                {providerLabel(selectedExternal.provider)}
                              </p>
                            </div>
                          </div>

                          <p className="max-h-64 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                            {selectedExternal.description}
                          </p>

                          <div className="flex flex-wrap gap-3">
                            {selectedExternal.source_url && (
                              <a
                                href={selectedExternal.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                Open original job post
                              </a>
                            )}
                            <Button
                              type="button"
                              onClick={() => importExternalMutation.mutate(selectedExternal)}
                              disabled={importExternalMutation.isPending}
                            >
                              {importExternalMutation.isPending
                                ? "Importing..."
                                : "Import into HireFlow"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a live result to preview and import it.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {workspaceTab === "extract" && (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="extract-source-url">Source URL</Label>
                      <Input
                        id="extract-source-url"
                        value={extractForm.source_url}
                        onChange={(e) =>
                          setExtractForm((current) => ({ ...current, source_url: e.target.value }))
                        }
                        placeholder="https://company.com/jobs/123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="extract-text">Job description text</Label>
                      <Textarea
                        id="extract-text"
                        value={extractForm.job_text}
                        onChange={(e) =>
                          setExtractForm((current) => ({ ...current, job_text: e.target.value }))
                        }
                        placeholder="Paste the full JD here"
                        className="min-h-56"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => extractMutation.mutate()}
                      disabled={!extractForm.job_text || extractMutation.isPending}
                    >
                      {extractMutation.isPending ? "Extracting..." : "Extract with AI"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => ingestMutation.mutate()}
                      disabled={!extractForm.job_text || ingestMutation.isPending}
                    >
                      {ingestMutation.isPending ? "Saving..." : "Extract and save job"}
                    </Button>
                  </div>

                  {extractedPreview && (
                    <div className="rounded-xl border p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Extracted preview</h3>
                          <p className="text-sm text-muted-foreground">
                            Method: {extractedPreview.extraction_method}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {extractedPreview.parse_result.required_skills.slice(0, 6).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-md border p-4">
                          <p className="font-medium">{extractedPreview.job.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {extractedPreview.job.company} • {extractedPreview.job.location || "TBD"}
                          </p>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {extractedPreview.parse_result.required_experience_years
                              ? `${extractedPreview.parse_result.required_experience_years}+ years experience`
                              : "Experience requirement not detected"}
                          </p>
                        </div>
                        <div className="rounded-md border p-4">
                          <p className="font-medium">Confidence notes</p>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {extractedPreview.confidence_notes.map((note) => (
                              <li key={note} className="rounded-md border p-2">
                                {note}
                              </li>
                            ))}
                            {!extractedPreview.confidence_notes.length && (
                              <li className="rounded-md border p-2">No extra notes.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {workspaceTab === "manual" && (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={manualForm.title}
                        onChange={(e) =>
                          setManualForm((current) => ({ ...current, title: e.target.value }))
                        }
                        placeholder="Senior Frontend Engineer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={manualForm.company}
                        onChange={(e) =>
                          setManualForm((current) => ({ ...current, company: e.target.value }))
                        }
                        placeholder="Acme Inc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-location">Location</Label>
                      <Input
                        id="job-location"
                        value={manualForm.location}
                        onChange={(e) =>
                          setManualForm((current) => ({ ...current, location: e.target.value }))
                        }
                        placeholder="Remote"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="job-description">Description</Label>
                      <Textarea
                        id="job-description"
                        value={manualForm.description}
                        onChange={(e) =>
                          setManualForm((current) => ({ ...current, description: e.target.value }))
                        }
                        placeholder="Paste the job description here."
                        className="min-h-48"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => createMutation.mutate()}
                      disabled={
                        !manualForm.title ||
                        !manualForm.company ||
                        !manualForm.description ||
                        createMutation.isPending
                      }
                    >
                      {createMutation.isPending ? "Saving..." : "Add job manually"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
