"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  automationApi,
  type AutomationRun,
  type AutomationPipelineSettingsPayload,
} from "@/lib/automation-api";

const emptySettings: AutomationPipelineSettingsPayload = {
  enabled: false,
  auto_apply_enabled: false,
  require_human_review: true,
  auto_tailor_resume: true,
  auto_generate_cover_letter: false,
  allowed_sources: [],
  search_terms: [],
  target_locations: [],
  excluded_keywords: [],
  min_match_score: 70,
  max_jobs_per_run: 25,
  max_applications_per_day: 5,
};

function toMultiline(value: string[]): string {
  return value.join("\n");
}

function fromMultiline(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        ready
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {label}: {ready ? "Ready" : "Needs setup"}
    </span>
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toSkippedArray(value: unknown): Array<{ job_posting_id: string; reason: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const record = item as Record<string, unknown>;
      const jobPostingId =
        typeof record.job_posting_id === "string" ? record.job_posting_id : "unknown";
      const reason = typeof record.reason === "string" ? record.reason : "unspecified";
      return { job_posting_id: jobPostingId, reason };
    })
    .filter((item): item is { job_posting_id: string; reason: string } => item !== null);
}

export default function AutomationPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AutomationPipelineSettingsPayload>(emptySettings);
  const [dryRunMode, setDryRunMode] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["automation-settings"],
    queryFn: automationApi.getSettings,
  });

  const readinessQuery = useQuery({
    queryKey: ["automation-readiness"],
    queryFn: automationApi.getReadiness,
  });

  const runsQuery = useQuery({
    queryKey: ["automation-runs"],
    queryFn: () => automationApi.listRuns(10),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm({
      enabled: settingsQuery.data.enabled,
      auto_apply_enabled: settingsQuery.data.auto_apply_enabled,
      require_human_review: settingsQuery.data.require_human_review,
      auto_tailor_resume: settingsQuery.data.auto_tailor_resume,
      auto_generate_cover_letter: settingsQuery.data.auto_generate_cover_letter,
      allowed_sources: settingsQuery.data.allowed_sources,
      search_terms: settingsQuery.data.search_terms,
      target_locations: settingsQuery.data.target_locations,
      excluded_keywords: settingsQuery.data.excluded_keywords,
      min_match_score: settingsQuery.data.min_match_score,
      max_jobs_per_run: settingsQuery.data.max_jobs_per_run,
      max_applications_per_day: settingsQuery.data.max_applications_per_day,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setMessage(null);
      return automationApi.saveSettings(form);
    },
    onSuccess: () => {
      setMessage("Automation settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["automation-readiness"] });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setMessage(error.response?.data?.detail ?? "Failed to save automation settings.");
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      setRunMessage(null);
      return automationApi.runNow({ dry_run: dryRunMode });
    },
    onSuccess: (run) => {
      setRunMessage(
        `Run completed: ${run.matched_jobs_count} matched, ${run.applied_jobs_count} applied, ${run.skipped_jobs_count} skipped.`
      );
      void queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
      void queryClient.invalidateQueries({ queryKey: ["automation-readiness"] });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setRunMessage(error.response?.data?.detail ?? "Failed to execute automation run.");
    },
  });

  const readinessCards = useMemo(() => {
    if (!readinessQuery.data) {
      return [] as Array<{ label: string; value: string }>;
    }

    return [
      { label: "Resumes", value: String(readinessQuery.data.resume_count) },
      { label: "Stored jobs", value: String(readinessQuery.data.saved_job_count) },
      { label: "Matches", value: String(readinessQuery.data.job_match_count) },
      { label: "Applications", value: String(readinessQuery.data.application_count) },
    ];
  }, [readinessQuery.data]);

  const runSummary = selectedRun?.summary ?? {};
  const createdApplicationIds = toStringArray(
    (runSummary as Record<string, unknown>).created_application_ids,
  );
  const skippedItems = toSkippedArray((runSummary as Record<string, unknown>).skipped);

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Automation</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Configure the first stage of the automation pipeline: job discovery scope,
            matching thresholds, and application guardrails.
          </p>
        </div>

        <section className="rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Readiness</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This checks whether your workspace has the minimum data required to run
                matching and auto-apply safely.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ReadinessBadge
                ready={Boolean(readinessQuery.data?.ready_for_matching)}
                label="Matching"
              />
              <ReadinessBadge
                ready={Boolean(readinessQuery.data?.ready_for_auto_apply)}
                label="Auto-apply"
              />
            </div>
          </div>

          {readinessQuery.isLoading && (
            <div className="mt-6 rounded-md border p-4 text-sm text-muted-foreground">
              Loading readiness status...
            </div>
          )}

          {readinessQuery.data && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {readinessCards.map((card) => (
                  <div key={card.label} className="rounded-md border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-4">
                  <h3 className="font-medium">Requirements</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Profile: {readinessQuery.data.has_profile ? "Complete" : "Missing"}</li>
                    <li>
                      Preferences: {readinessQuery.data.has_preferences ? "Complete" : "Missing"}
                    </li>
                    <li>
                      Resume baseline: {readinessQuery.data.resume_count > 0 ? "Complete" : "Missing"}
                    </li>
                  </ul>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="font-medium">Pipeline blockers</h3>
                  {readinessQuery.data.blockers.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {readinessQuery.data.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No hard blockers detected for the current configuration.
                    </p>
                  )}
                </div>
              </div>

              {readinessQuery.data.suggestions.length > 0 && (
                <div className="rounded-md border bg-muted/50 p-4">
                  <h3 className="font-medium">Suggested next steps</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {readinessQuery.data.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Pipeline mode</h2>
                <p className="text-sm text-muted-foreground">
                  Control whether HireFlow only discovers and ranks jobs or can also move into
                  approval and application execution.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: "enabled",
                    label: "Enable automation pipeline",
                    description: "Turns on automated discovery and matching for this user.",
                  },
                  {
                    key: "auto_apply_enabled",
                    label: "Enable auto-apply",
                    description: "Allows the pipeline to progress beyond scoring into application submission.",
                  },
                  {
                    key: "require_human_review",
                    label: "Require human review before apply",
                    description: "Keeps an approval gate even when auto-apply is turned on.",
                  },
                  {
                    key: "auto_tailor_resume",
                    label: "Tailor resume automatically",
                    description: "Uses the matching pipeline to prepare targeted resume variants.",
                  },
                  {
                    key: "auto_generate_cover_letter",
                    label: "Generate cover letters automatically",
                    description: "Creates cover letters when the pipeline decides one is needed.",
                  },
                ].map((item) => {
                  const checked = form[item.key as keyof AutomationPipelineSettingsPayload];
                  return (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 rounded-md border p-4"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={typeof checked === "boolean" ? checked : false}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [item.key]: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Discovery rules</h2>
                <p className="text-sm text-muted-foreground">
                  Set the job search footprint the pipeline should use when scanning new roles.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="search_terms">Search terms</Label>
                  <Textarea
                    id="search_terms"
                    value={toMultiline(form.search_terms)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        search_terms: fromMultiline(event.target.value),
                      }))
                    }
                    placeholder="Senior frontend engineer&#10;Full stack developer&#10;React TypeScript"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    One per line or comma-separated.
                  </p>
                </div>

                <div>
                  <Label htmlFor="target_locations">Target locations</Label>
                  <Textarea
                    id="target_locations"
                    value={toMultiline(form.target_locations)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        target_locations: fromMultiline(event.target.value),
                      }))
                    }
                    placeholder="Remote&#10;London&#10;Berlin"
                  />
                </div>

                <div>
                  <Label htmlFor="allowed_sources">Allowed sources</Label>
                  <Textarea
                    id="allowed_sources"
                    value={toMultiline(form.allowed_sources)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowed_sources: fromMultiline(event.target.value),
                      }))
                    }
                    placeholder="linkedin&#10;indeed&#10;greenhouse"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="excluded_keywords">Excluded keywords</Label>
                  <Textarea
                    id="excluded_keywords"
                    value={toMultiline(form.excluded_keywords)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        excluded_keywords: fromMultiline(event.target.value),
                      }))
                    }
                    placeholder="senior manager&#10;clearance required&#10;commission only"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Match and safety thresholds</h2>
                <p className="text-sm text-muted-foreground">
                  Keep the pipeline selective so it only prioritizes jobs worth spending time on.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="min_match_score">Minimum match score</Label>
                  <Input
                    id="min_match_score"
                    type="number"
                    min={0}
                    max={100}
                    value={form.min_match_score}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        min_match_score: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="max_jobs_per_run">Max jobs per run</Label>
                  <Input
                    id="max_jobs_per_run"
                    type="number"
                    min={1}
                    value={form.max_jobs_per_run}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        max_jobs_per_run: Number(event.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="max_applications_per_day">Daily application limit</Label>
                  <Input
                    id="max_applications_per_day"
                    type="number"
                    min={1}
                    value={form.max_applications_per_day}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        max_applications_per_day: Number(event.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold">What this enables</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>
                  This release stores the user-level policy layer for automation. It is the base
                  for scheduled discovery, scoring, approval queues, and later auto-apply runs.
                </p>
                <p>
                  Current pipeline signals already reuse profile data, preferences, resume
                  inventory, and job matches already present in HireFlow.
                </p>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold">Save changes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Update automation rules whenever your target roles, locations, or safety limits
                change.
              </p>

              <Button
                type="button"
                className="mt-6 w-full"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || settingsQuery.isLoading}
              >
                {saveMutation.isPending ? "Saving..." : "Save automation settings"}
              </Button>

              {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold">Run now</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Trigger a manual automation cycle using your current settings.
              </p>

              <label className="mt-4 flex items-start gap-3 rounded-md border p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={dryRunMode}
                  onChange={(event) => setDryRunMode(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">Dry run mode</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Simulates selection without creating real applications.
                  </span>
                </span>
              </label>

              <Button
                type="button"
                className="mt-4 w-full"
                onClick={() => runNowMutation.mutate()}
                disabled={runNowMutation.isPending}
              >
                {runNowMutation.isPending ? "Running..." : "Run automation now"}
              </Button>

              {runMessage && <p className="mt-3 text-sm text-muted-foreground">{runMessage}</p>}
            </section>
          </div>
        </div>

        <section className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent runs</h2>
            <p className="text-sm text-muted-foreground">
              {runsQuery.data ? `${runsQuery.data.total} total runs` : "Run history"}
            </p>
          </div>

          {runsQuery.isLoading && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Loading run history...
            </div>
          )}

          {runsQuery.data && runsQuery.data.items.length === 0 && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No automation runs yet. Start with a dry run to validate your current settings.
            </div>
          )}

          {runsQuery.data && runsQuery.data.items.length > 0 && (
            <div className="space-y-3">
              {runsQuery.data.items.map((run) => (
                <div key={run.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-medium">
                      {new Date(run.started_at).toLocaleString()} • {run.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{run.triggered_by}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
                    <p>Matched: {run.matched_jobs_count}</p>
                    <p>Reviewed: {run.reviewed_jobs_count}</p>
                    <p>Applied: {run.applied_jobs_count}</p>
                    <p>Skipped: {run.skipped_jobs_count}</p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRun(run)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedRun && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setSelectedRun(null)}
              aria-label="Close run details"
            />

            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-card p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Run details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(selectedRun.started_at).toLocaleString()} • {selectedRun.status}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setSelectedRun(null)}>
                  Close
                </Button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="mt-1 font-medium">{selectedRun.matched_jobs_count}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Reviewed</p>
                  <p className="mt-1 font-medium">{selectedRun.reviewed_jobs_count}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Applied</p>
                  <p className="mt-1 font-medium">{selectedRun.applied_jobs_count}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Skipped</p>
                  <p className="mt-1 font-medium">{selectedRun.skipped_jobs_count}</p>
                </div>
              </div>

              <section className="mt-6 rounded-md border p-4">
                <h3 className="font-medium">Created applications</h3>
                {createdApplicationIds.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {createdApplicationIds.map((applicationId) => (
                      <li key={applicationId} className="rounded border bg-muted/40 px-3 py-2">
                        {applicationId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No applications were created in this run.
                  </p>
                )}
              </section>

              <section className="mt-4 rounded-md border p-4">
                <h3 className="font-medium">Skipped jobs</h3>
                {skippedItems.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {skippedItems.map((item, index) => (
                      <div key={`${item.job_posting_id}-${index}`} className="rounded border bg-muted/40 p-3 text-sm">
                        <p className="font-medium">{item.job_posting_id}</p>
                        <p className="mt-1 text-muted-foreground">Reason: {item.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No skipped-job details were recorded.
                  </p>
                )}
              </section>

              <section className="mt-4 rounded-md border p-4">
                <h3 className="font-medium">Raw run summary</h3>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(selectedRun.summary, null, 2)}
                </pre>
              </section>
            </aside>
          </>
        )}
      </div>
    </AppShell>
  );
}
