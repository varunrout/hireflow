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
  type AutomationPipelineSettings,
} from "@/lib/automation-api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toMultiline(value: string[]): string {
  return value.join("\n");
}

function fromMultiline(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/*  Tiny UI pieces                                                     */
/* ------------------------------------------------------------------ */

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
      {ready ? "✓" : "○"} {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <div>
        <span className="text-sm font-medium">{label}</span>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </label>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    auto_apply: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    save: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? "bg-muted text-muted-foreground"}`}
    >
      {tier.replace("_", " ")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type TabId = "settings" | "runs" | "queue" | "analytics" | "notifications";

function TabBar({
  active,
  onChange,
  queueCount,
  unreadCount,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  queueCount: number;
  unreadCount: number;
}) {
  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "settings", label: "Settings" },
    { id: "runs", label: "Run History" },
    { id: "queue", label: "Approval Queue", badge: queueCount },
    { id: "analytics", label: "Analytics" },
    { id: "notifications", label: "Notifications", badge: unreadCount },
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            "relative px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t.label}
          {t.badge ? (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary">
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */

export default function AutomationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("settings");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);

  /* --- data -------------------------------------------------------- */
  const settingsQ = useQuery({
    queryKey: ["automation", "settings"],
    queryFn: automationApi.getSettings,
  });
  const readinessQ = useQuery({
    queryKey: ["automation", "readiness"],
    queryFn: automationApi.getReadiness,
  });
  const runsQ = useQuery({
    queryKey: ["automation", "runs"],
    queryFn: () => automationApi.listRuns(50),
    refetchInterval: (query) => {
      const runs = query.state.data?.runs;
      const hasRunning = runs?.some((r) => r.status === "running");
      return hasRunning ? 3000 : false;
    },
  });
  const queueQ = useQuery({
    queryKey: ["automation", "queue"],
    queryFn: () => automationApi.getApprovalQueue("pending"),
    enabled: tab === "queue" || tab === "settings",
  });
  const analyticsQ = useQuery({
    queryKey: ["automation", "analytics"],
    queryFn: () => automationApi.getAnalytics(30),
    enabled: tab === "analytics",
  });
  const notificationsQ = useQuery({
    queryKey: ["automation", "notifications"],
    queryFn: () => automationApi.getNotifications(50),
    enabled: tab === "notifications",
  });
  const scheduleQ = useQuery({
    queryKey: ["automation", "schedule"],
    queryFn: automationApi.getSchedule,
    enabled: tab === "settings",
  });

  /* --- local form state ------------------------------------------- */
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (settingsQ.data) {
      setForm({ ...settingsQ.data });
    }
  }, [settingsQ.data]);

  const setField = <T,>(key: string, value: T) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* --- mutations --------------------------------------------------- */
  const saveMut = useMutation({
    mutationFn: automationApi.saveSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const runMut = useMutation({
    mutationFn: automationApi.runNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const decideMut = useMutation({
    mutationFn: ({
      itemId,
      action,
    }: {
      itemId: string;
      action: "approved" | "rejected" | "deferred";
    }) => automationApi.decideApproval(itemId, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const batchDecideMut = useMutation({
    mutationFn: automationApi.batchDecide,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const cancelRunMut = useMutation({
    mutationFn: automationApi.cancelRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const retryRunMut = useMutation({
    mutationFn: automationApi.retryRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });

  const deleteRunMut = useMutation({
    mutationFn: automationApi.deleteRun,
    onSuccess: () => {
      setSelectedRunId(null);
      qc.invalidateQueries({ queryKey: ["automation"] });
    },
  });

  const markReadMut = useMutation({
    mutationFn: automationApi.markNotificationRead,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: automationApi.markAllNotificationsRead,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] }),
  });

  /* --- derived ----------------------------------------------------- */
  const readiness = readinessQ.data;
  const runs = runsQ.data?.items ?? [];
  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );
  const queueItems = queueQ.data?.items ?? [];
  const analytics = analyticsQ.data;
  const notifications = notificationsQ.data;
  const schedule = scheduleQ.data;

  const queueCount = queueQ.data?.total ?? 0;
  const unreadCount = notificationsQ.data?.unread_count ?? 0;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automation Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Configure, schedule, and monitor your job-matching pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Dry run
            </label>
            <Button
              onClick={() => runMut.mutate({ dry_run: dryRun })}
              disabled={runMut.isPending}
            >
              {runMut.isPending ? "Running…" : "Run Pipeline"}
            </Button>
          </div>
        </div>

        {/* Readiness */}
        {readiness ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ReadinessBadge ready={readiness.has_profile} label="Profile" />
              <ReadinessBadge
                ready={readiness.has_preferences}
                label="Preferences"
              />
              <ReadinessBadge
                ready={readiness.resume_count > 0}
                label="Resume"
              />
              <ReadinessBadge
                ready={readiness.ready_for_matching}
                label="Matching Ready"
              />
              <ReadinessBadge
                ready={readiness.ready_for_auto_apply}
                label="Auto-Apply Ready"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <StatCard
                label="Profile completeness"
                value={`${readiness.profile_completeness.toFixed(0)}%`}
              />
              <StatCard
                label="Skill coverage"
                value={`${readiness.skill_coverage.toFixed(0)}%`}
              />
              <StatCard label="Resumes" value={readiness.resume_count} />
              <StatCard label="Job postings" value={readiness.saved_job_count} />
              <StatCard label="Applications" value={readiness.application_count} />
              <StatCard label="Matches" value={readiness.job_match_count} />
            </div>

            {readiness.blockers.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive">
                  Blockers
                </p>
                {readiness.blockers.map((b, i) => (
                  <p key={i} className="text-xs text-destructive">
                    • {b}
                  </p>
                ))}
              </div>
            ) : null}
            {readiness.suggestions.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  Suggestions
                </p>
                {readiness.suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    • {s}
                  </p>
                ))}
              </div>
            ) : null}
            {readiness.data_quality_warnings.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                  Data Quality
                </p>
                {readiness.data_quality_warnings.map((w, i) => (
                  <p
                    key={i}
                    className="text-xs text-yellow-600 dark:text-yellow-400"
                  >
                    ⚠ {w}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Tabs */}
        <TabBar
          active={tab}
          onChange={setTab}
          queueCount={queueCount}
          unreadCount={unreadCount}
        />

        {/* ==================== SETTINGS TAB ==================== */}
        {tab === "settings" ? (
          <div className="space-y-8">
            {/* Core toggles */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Pipeline Controls</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={!!form["enabled"]}
                  onChange={(v) => setField("enabled", v)}
                  label="Pipeline enabled"
                  description="Turn the automation pipeline on or off"
                />
                <Toggle
                  checked={!!form["auto_apply_enabled"]}
                  onChange={(v) => setField("auto_apply_enabled", v)}
                  label="Auto-apply enabled"
                  description="Automatically apply to high-confidence matches"
                />
                <Toggle
                  checked={!!form["require_human_review"]}
                  onChange={(v) => setField("require_human_review", v)}
                  label="Require human review"
                  description="Send matches to approval queue before applying"
                />
                <Toggle
                  checked={!!form["auto_tailor_resume"]}
                  onChange={(v) => setField("auto_tailor_resume", v)}
                  label="Auto-tailor resume"
                />
                <Toggle
                  checked={!!form["auto_generate_cover_letter"]}
                  onChange={(v) => setField("auto_generate_cover_letter", v)}
                  label="Auto-generate cover letter"
                />
              </div>
            </section>

            {/* Confidence tiers */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Confidence Tiers</h2>
              <p className="text-xs text-muted-foreground">
                Jobs are sorted into tiers based on their match score. Auto-apply
                tier gets applied instantly (if enabled), review tier goes to
                approval queue, save tier is just recorded.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Auto-apply ≥</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={(form["confidence_auto_apply_threshold"] as number) ?? 90}
                    onChange={(e) =>
                      setField(
                        "confidence_auto_apply_threshold",
                        Number(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Review ≥</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={(form["confidence_review_threshold"] as number) ?? 75}
                    onChange={(e) =>
                      setField(
                        "confidence_review_threshold",
                        Number(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Save ≥</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={(form["confidence_save_threshold"] as number) ?? 65}
                    onChange={(e) =>
                      setField(
                        "confidence_save_threshold",
                        Number(e.target.value)
                      )
                    }
                  />
                </div>
              </div>
            </section>

            {/* Discovery rules */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Discovery Rules</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Search terms (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={toMultiline(
                      (form["search_terms"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField("search_terms", fromMultiline(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label>Target locations (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={toMultiline(
                      (form["target_locations"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "target_locations",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Allowed sources (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["allowed_sources"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "allowed_sources",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Excluded keywords (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["excluded_keywords"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "excluded_keywords",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Company blacklist (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["company_blacklist"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "company_blacklist",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Company whitelist (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["company_whitelist"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "company_whitelist",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Target industries (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["target_industries"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "target_industries",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Excluded industries (one per line)</Label>
                  <Textarea
                    rows={2}
                    value={toMultiline(
                      (form["excluded_industries"] as string[]) ?? []
                    )}
                    onChange={(e) =>
                      setField(
                        "excluded_industries",
                        fromMultiline(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <Label>Freshness (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={(form["freshness_days"] as number) ?? 30}
                    onChange={(e) =>
                      setField("freshness_days", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label>Min salary floor</Label>
                  <Input
                    type="number"
                    min={0}
                    value={(form["min_salary_floor"] as number) ?? ""}
                    onChange={(e) =>
                      setField(
                        "min_salary_floor",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    placeholder="No minimum"
                  />
                </div>
                <div>
                  <Label>Min match score</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={(form["min_match_score"] as number) ?? 70}
                    onChange={(e) =>
                      setField("min_match_score", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label>Max jobs / run</Label>
                  <Input
                    type="number"
                    min={1}
                    value={(form["max_jobs_per_run"] as number) ?? 25}
                    onChange={(e) =>
                      setField("max_jobs_per_run", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </section>

            {/* Scheduling */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Scheduling</h2>
              <Toggle
                checked={!!form["schedule_enabled"]}
                onChange={(v) => setField("schedule_enabled", v)}
                label="Enable scheduled runs"
                description="Automatically run the pipeline on a schedule"
              />
              {form["schedule_enabled"] ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Cron expression</Label>
                      <Input
                        value={(form["schedule_cron"] as string) ?? ""}
                        onChange={(e) =>
                          setField("schedule_cron", e.target.value || null)
                        }
                        placeholder="0 9 * * 1-5"
                      />
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Input
                        value={(form["schedule_timezone"] as string) ?? "UTC"}
                        onChange={(e) =>
                          setField("schedule_timezone", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Daily limit</Label>
                      <Input
                        type="number"
                        min={1}
                        value={
                          (form["max_applications_per_day"] as number) ?? 5
                        }
                        onChange={(e) =>
                          setField(
                            "max_applications_per_day",
                            Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Preset buttons */}
                  {schedule?.presets && schedule.presets.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Presets</p>
                      <div className="flex flex-wrap gap-2">
                        {schedule.presets.map((p) => (
                          <button
                            key={p.cron}
                            onClick={() => setField("schedule_cron", p.cron)}
                            className={[
                              "rounded-full border px-3 py-1 text-xs transition-colors",
                              form["schedule_cron"] === p.cron
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50",
                            ].join(" ")}
                            title={p.description}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Toggle
                    checked={!!form["schedule_paused"]}
                    onChange={(v) => setField("schedule_paused", v)}
                    label="Pause schedule"
                    description="Temporarily pause without disabling"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Run window start (hour, 0-23)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={(form["run_window_start"] as number) ?? ""}
                        onChange={(e) =>
                          setField(
                            "run_window_start",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        placeholder="Any"
                      />
                    </div>
                    <div>
                      <Label>Run window end (hour, 0-23)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={(form["run_window_end"] as number) ?? ""}
                        onChange={(e) =>
                          setField(
                            "run_window_end",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        placeholder="Any"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Notifications */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={!!form["email_digest_enabled"]}
                  onChange={(v) => setField("email_digest_enabled", v)}
                  label="Email digest"
                  description="Receive periodic email summaries"
                />
                {form["email_digest_enabled"] ? (
                  <div>
                    <Label>Frequency</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={(form["email_digest_frequency"] as string) ?? "weekly"}
                      onChange={(e) =>
                        setField("email_digest_frequency", e.target.value)
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                ) : null}
                <Toggle
                  checked={!!form["high_match_alert_enabled"]}
                  onChange={(v) => setField("high_match_alert_enabled", v)}
                  label="High-match alerts"
                  description="Get notified when a very high-scoring match is found"
                />
                {form["high_match_alert_enabled"] ? (
                  <div>
                    <Label>Alert threshold</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={
                        (form["high_match_alert_threshold"] as number) ?? 90
                      }
                      onChange={(e) =>
                        setField(
                          "high_match_alert_threshold",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={() => saveMut.mutate(form as AutomationPipelineSettings)}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* ==================== RUNS TAB ==================== */}
        {tab === "runs" ? (
          <div className="flex gap-4">
            {/* Run list */}
            <div className="w-full max-w-md space-y-1">
              <h2 className="mb-2 text-lg font-semibold">
                Run History ({runsQ.data?.total ?? 0})
              </h2>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No runs yet. Click &quot;Run Pipeline&quot; to start.
                </p>
              ) : null}
              {runs.map((run) => (
                <div
                  key={run.id}
                  className={[
                    "group relative w-full rounded-lg border p-3 text-left transition-colors",
                    selectedRunId === run.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  ].join(" ")}
                >
                  <button
                    onClick={() => setSelectedRunId(run.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {run.triggered_by}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          run.status === "completed"
                            ? "text-green-600"
                            : run.status === "failed"
                              ? "text-red-600"
                              : run.status === "cancelled"
                                ? "text-yellow-600"
                                : "text-blue-600"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(run.started_at)}
                    </p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>
                        {run.matched_jobs_count} matched
                      </span>
                      <span>{run.applied_jobs_count} applied</span>
                      <span>{run.queued_for_review_count} queued</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this run from history?")) {
                        deleteRunMut.mutate(run.id);
                      }
                    }}
                    className="absolute right-2 top-2 hidden rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-flex"
                    title="Delete run"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Run detail */}
            <div className="flex-1">
              {selectedRun ? (
                <RunDetail
                  run={selectedRun}
                  onCancel={() => cancelRunMut.mutate(selectedRun.id)}
                  onRetry={() => retryRunMut.mutate(selectedRun.id)}
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Select a run to view details
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ==================== QUEUE TAB ==================== */}
        {tab === "queue" ? (
          <ApprovalQueueTab
            items={queueItems}
            total={queueQ.data?.total ?? 0}
            onDecide={(id, action) => decideMut.mutate({ itemId: id, action })}
            onBatchApprove={(ids) =>
              batchDecideMut.mutate({ item_ids: ids, action: "approved" })
            }
            onBatchReject={(ids) =>
              batchDecideMut.mutate({ item_ids: ids, action: "rejected" })
            }
            isLoading={decideMut.isPending || batchDecideMut.isPending}
          />
        ) : null}

        {/* ==================== ANALYTICS TAB ==================== */}
        {tab === "analytics" ? (
          <AnalyticsTab analytics={analytics ?? null} />
        ) : null}

        {/* ==================== NOTIFICATIONS TAB ==================== */}
        {tab === "notifications" ? (
          <NotificationsTab
            data={notifications ?? null}
            onMarkRead={(id) => markReadMut.mutate(id)}
            onMarkAllRead={() => markAllReadMut.mutate()}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

/* ================================================================== */
/*  SUB-COMPONENTS                                                     */
/* ================================================================== */

function RunDetail({
  run,
  onCancel,
  onRetry,
}: {
  run: AutomationRun;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const summary = run.summary as Record<string, unknown>;
  const tiers = (summary["confidence_tiers"] as Record<string, number>) ?? {};
  const scoreDist =
    (summary["score_distribution"] as Record<string, number>) ?? {};
  const timing = (summary["timing"] as Record<string, number>) ?? {};
  const skipped = (summary["skipped"] as Array<Record<string, unknown>>) ?? [];
  const matchedJobDetails = (summary["matched_job_details"] as Array<Record<string, unknown>>) ?? [];
  const discoveredFromExternal = (summary["discovered_from_external"] as number) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Run — {run.triggered_by} — {run.status}
        </h3>
        <div className="flex gap-2">
          {run.status === "running" ? (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {run.status === "failed" || run.status === "cancelled" ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>

      {run.error_message ? (
        <p className="text-sm text-destructive">{run.error_message}</p>
      ) : null}

      {summary["dry_run"] ? (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
          This was a dry run — no applications or queue items were created.
        </div>
      ) : null}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Matched" value={run.matched_jobs_count} />
        <StatCard label="Applied" value={run.applied_jobs_count} />
        <StatCard label="Queued" value={run.queued_for_review_count} />
        <StatCard label="Skipped" value={run.skipped_jobs_count} />
        <StatCard label="Evaluated" value={run.jobs_evaluated} />
        <StatCard label="New matches" value={run.new_matches_count} />
        {discoveredFromExternal > 0 ? (
          <StatCard label="Discovered" value={discoveredFromExternal} />
        ) : null}
        <StatCard
          label="Scoring time"
          value={fmtDuration(run.scoring_duration_ms)}
        />
        <StatCard
          label="Total time"
          value={fmtDuration(run.total_duration_ms)}
        />
      </div>

      {/* Confidence tiers */}
      {Object.keys(tiers).length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-semibold">Confidence Tiers</h4>
          <div className="flex gap-3">
            {Object.entries(tiers).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-1.5">
                <TierBadge tier={tier} />
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Matched job details */}
      {matchedJobDetails.length > 0 ? (
        <details open className="text-xs">
          <summary className="cursor-pointer text-sm font-semibold">
            Matched Jobs ({matchedJobDetails.length})
          </summary>
          <div className="mt-1 max-h-80 overflow-auto rounded border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2">Job Title</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {matchedJobDetails.map((job, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-2 font-medium">
                      {String(job["title"] ?? "Untitled")}
                    </td>
                    <td className="p-2">{String(job["company"] ?? "Unknown")}</td>
                    <td className="p-2 text-muted-foreground">
                      {String(job["location"] ?? "—")}
                    </td>
                    <td className="p-2">
                      <span className="font-mono font-medium">
                        {Number(job["score"] ?? 0).toFixed(1)}
                      </span>
                    </td>
                    <td className="p-2">
                      {job["tier"] ? <TierBadge tier={String(job["tier"])} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {/* Score distribution */}
      {Object.keys(scoreDist).length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-semibold">Score Distribution</h4>
          <div className="flex gap-2">
            {Object.entries(scoreDist).map(([bucket, count]) => (
              <div
                key={bucket}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                <span className="font-medium">{bucket}</span>: {count}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Timing */}
      <div className="text-xs text-muted-foreground">
        <span>Started: {fmtDate(run.started_at)}</span>
        {" · "}
        <span>Finished: {fmtDate(run.finished_at)}</span>
        {timing["scoring_ms"] != null ? (
          <>
            {" · "}
            <span>Scoring: {timing["scoring_ms"]}ms</span>
          </>
        ) : null}
      </div>

      {/* Skipped jobs */}
      {skipped.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            Skipped jobs ({skipped.length})
          </summary>
          <div className="mt-1 max-h-60 overflow-auto rounded border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2">Job</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Reason</th>
                  <th className="p-2">Tier</th>
                  <th className="p-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {skipped.map((s, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-2 font-medium">
                      {String(s["job_title"] ?? String(s["job_posting_id"] ?? "").slice(0, 8) + "…")}
                    </td>
                    <td className="p-2">
                      {String(s["job_company"] ?? "—")}
                    </td>
                    <td className="p-2">{String(s["reason"] ?? "")}</td>
                    <td className="p-2">
                      {s["tier"] ? (
                        <TierBadge tier={String(s["tier"])} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">
                      {s["score"] != null ? String(s["score"]) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {/* Raw summary */}
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Raw summary</summary>
        <pre className="mt-1 max-h-60 overflow-auto rounded border border-border bg-muted/50 p-3">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approval queue                                                     */
/* ------------------------------------------------------------------ */

function ApprovalQueueTab({
  items,
  total,
  onDecide,
  onBatchApprove,
  onBatchReject,
  isLoading,
}: {
  items: Array<{
    id: string;
    score: number;
    recommendation: string;
    status: string;
    job_title: string | null;
    job_company: string | null;
    job_location: string | null;
    created_at: string;
  }>;
  total: number;
  onDecide: (
    id: string,
    action: "approved" | "rejected" | "deferred"
  ) => void;
  onBatchApprove: (ids: string[]) => void;
  onBatchReject: (ids: string[]) => void;
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Approval Queue ({total})</h2>
        {selected.size > 0 ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onBatchApprove(Array.from(selected))}
              disabled={isLoading}
            >
              Approve ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBatchReject(Array.from(selected))}
              disabled={isLoading}
            >
              Reject ({selected.size})
            </Button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items pending review. Run the pipeline to discover new matches.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3">
                  <input
                    type="checkbox"
                    checked={
                      items.length > 0 && selected.size === items.length
                    }
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border"
                  />
                </th>
                <th className="p-3">Job</th>
                <th className="p-3">Company</th>
                <th className="p-3">Location</th>
                <th className="p-3">Score</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Added</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="p-3 font-medium">
                    {item.job_title ?? "Unknown"}
                  </td>
                  <td className="p-3">{item.job_company ?? "—"}</td>
                  <td className="p-3 text-xs">{item.job_location ?? "—"}</td>
                  <td className="p-3">
                    <span className="font-mono font-medium">
                      {item.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="p-3">
                    <TierBadge tier={item.recommendation} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {fmtDate(item.created_at)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onDecide(item.id, "approved")}
                        disabled={isLoading}
                        className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => onDecide(item.id, "rejected")}
                        disabled={isLoading}
                        className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                      >
                        ✗
                      </button>
                      <button
                        onClick={() => onDecide(item.id, "deferred")}
                        disabled={isLoading}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                      >
                        Later
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

import type { AutomationAnalytics } from "@/lib/automation-api";

function AnalyticsTab({
  analytics,
}: {
  analytics: AutomationAnalytics | null;
}) {
  if (!analytics) {
    return (
      <p className="text-sm text-muted-foreground">Loading analytics…</p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Pipeline Analytics (30 days)</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total runs" value={analytics.total_runs} />
        <StatCard label="Matches" value={analytics.total_matches} />
        <StatCard label="Applications" value={analytics.total_applications} />
        <StatCard label="Approvals" value={analytics.total_approvals} />
        <StatCard label="Rejections" value={analytics.total_rejections} />
        <StatCard
          label="Avg score"
          value={analytics.avg_match_score.toFixed(1)}
        />
      </div>

      {/* Score distribution */}
      {Object.keys(analytics.score_distribution).length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Score Distribution</h3>
          <div className="flex gap-2">
            {Object.entries(analytics.score_distribution).map(
              ([bucket, count]) => {
                const maxCount = Math.max(
                  ...Object.values(analytics.score_distribution),
                  1
                );
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={bucket} className="flex-1 text-center">
                    <div className="mx-auto mb-1 h-24 w-full max-w-12 overflow-hidden rounded bg-muted">
                      <div
                        className="mt-auto w-full bg-primary transition-all"
                        style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium">{count}</p>
                    <p className="text-xs text-muted-foreground">{bucket}</p>
                  </div>
                );
              }
            )}
          </div>
        </div>
      ) : null}

      {/* Application funnel */}
      {Object.keys(analytics.application_funnel).length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Application Funnel</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.application_funnel).map(
              ([status, count]) => (
                <div
                  key={status}
                  className="rounded-lg border border-border px-3 py-2 text-center"
                >
                  <p className="text-lg font-semibold">{count}</p>
                  <p className="text-xs text-muted-foreground">{status}</p>
                </div>
              )
            )}
          </div>
        </div>
      ) : null}

      {/* Top companies */}
      {analytics.top_companies.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Top Companies</h3>
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2">Company</th>
                  <th className="p-2">Matches</th>
                  <th className="p-2">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top_companies.map((c) => (
                  <tr
                    key={c.company}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-2 font-medium">{c.company}</td>
                    <td className="p-2">{c.match_count}</td>
                    <td className="p-2">{c.avg_score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Source effectiveness */}
      {analytics.source_effectiveness.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Source Effectiveness</h3>
          <div className="flex flex-wrap gap-3">
            {analytics.source_effectiveness.map((s) => (
              <div
                key={s.source}
                className="rounded-lg border border-border px-3 py-2"
              >
                <p className="text-sm font-medium capitalize">{s.source}</p>
                <p className="text-xs text-muted-foreground">
                  {s.matches} matches · avg {s.avg_score.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Match trend */}
      {analytics.match_trend.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Match Trend</h3>
          <div className="overflow-auto">
            <div className="flex items-end gap-1" style={{ minHeight: 120 }}>
              {analytics.match_trend.map((d) => {
                const maxC = Math.max(
                  ...analytics.match_trend.map((x) => x.count),
                  1
                );
                const h = Math.round((d.count / maxC) * 100);
                return (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    title={`${d.date}: ${d.count} matches, avg ${d.avg_score}`}
                  >
                    <div
                      className="mx-auto w-full max-w-8 rounded-t bg-primary/70 transition-all hover:bg-primary"
                      style={{ height: `${Math.max(h, 4)}px` }}
                    />
                    <p className="mt-1 text-center text-[9px] text-muted-foreground">
                      {d.date.slice(5)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Daily stats */}
      {analytics.daily_stats.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Daily Activity</h3>
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2">Date</th>
                  <th className="p-2">Runs</th>
                  <th className="p-2">Matched</th>
                  <th className="p-2">Applied</th>
                </tr>
              </thead>
              <tbody>
                {analytics.daily_stats.map((d) => (
                  <tr
                    key={d.date}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-2">{d.date}</td>
                    <td className="p-2">{d.runs}</td>
                    <td className="p-2">{d.matched}</td>
                    <td className="p-2">{d.applied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

import type { NotificationList } from "@/lib/automation-api";

function NotificationsTab({
  data,
  onMarkRead,
  onMarkAllRead,
}: {
  data: NotificationList | null;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">Loading notifications…</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Notifications ({data.total})
          {data.unread_count > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {data.unread_count} unread
            </span>
          ) : null}
        </h2>
        {data.unread_count > 0 ? (
          <Button variant="outline" size="sm" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => (
            <div
              key={n.id}
              className={[
                "rounded-lg border p-3 transition-colors",
                n.is_read
                  ? "border-border bg-card"
                  : "border-primary/30 bg-primary/5",
              ].join(" ")}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(n.created_at)} · {n.type}
                  </p>
                </div>
                {!n.is_read ? (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
