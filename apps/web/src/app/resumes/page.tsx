"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileApi } from "@/lib/profile-api";
import { resumesApi } from "@/lib/resumes-api";
import { personasApi, type Persona } from "@/lib/personas-api";
import type { ResumeVersion } from "@hireflow/schemas";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    final: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    archived: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? cls.draft}`}>
      {status}
    </span>
  );
}

// ------------------------------------------------------------------
// Resume card
// ------------------------------------------------------------------

type ResumeWithPersonaId = ResumeVersion & { persona_id?: string | null };

function ResumeCard({
  resume,
  personas,
  onDelete,
  onAssign,
  isDeleting,
}: {
  resume: ResumeWithPersonaId;
  personas: Persona[];
  onDelete: (id: string) => void;
  onAssign: (resumeId: string, personaId: string | null) => void;
  isDeleting: boolean;
}) {
  const assignedPersona = personas.find((p) => p.id === resume.persona_id);
  return (
    <div className="group flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-gray-900 dark:text-white">{resume.name}</p>
          <StatusBadge status={resume.status ?? "draft"} />
          {resume.ai_tailored && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              AI tailored
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          {resume.format} • Updated {formatDate(resume.updated_at ?? "")}
        </p>
        {assignedPersona && (
          <div
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: assignedPersona.color ?? "#6b7280" }}
          >
            {assignedPersona.name}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={resume.persona_id ?? ""}
          onChange={(e) => onAssign(resume.id!, e.target.value || null)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          title="Assign to persona"
        >
          <option value="">No persona</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(resume.id!)}
          disabled={isDeleting}
          className="text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          {isDeleting ? "…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

function ResumeSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------

type TabId = "all" | "__unassigned__" | string;

export default function ResumesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", format: "ats", persona_id: "" });
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const profileQuery = useQuery({
    queryKey: ["profile-for-resumes"],
    queryFn: profileApi.getMyProfile,
    retry: false,
  });

  const personasQuery = useQuery({
    queryKey: ["personas"],
    queryFn: personasApi.list,
  });

  const resumesQuery = useQuery({
    queryKey: ["resumes"],
    queryFn: () => resumesApi.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      resumesApi.create({
        name: form.name,
        format: form.format as "ats" | "designed" | "tailored",
        persona_id: form.persona_id || null,
        sections: [],
      }),
    onSuccess: () => {
      setForm({ name: "", format: "ats", persona_id: "" });
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (resumeId: string) => resumesApi.remove(resumeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ resumeId, personaId }: { resumeId: string; personaId: string | null }) => {
      const existing = (allResumes).find((r) => r.id === resumeId);
      return resumesApi.update(resumeId, {
        name: existing?.name ?? "",
        format: (existing?.format as "ats" | "designed" | "tailored") ?? "ats",
        persona_id: personaId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
  });

  const missingProfile =
    (profileQuery.error as { response?: { status?: number } } | undefined)?.response?.status ===
    404;

  const allResumes = (resumesQuery.data?.items ?? []) as ResumeWithPersonaId[];
  const personas = personasQuery.data ?? [];
  const unassignedCount = allResumes.filter((r) => !r.persona_id).length;

  const visibleResumes =
    activeTab === "all"
      ? allResumes
      : activeTab === "__unassigned__"
      ? allResumes.filter((r) => !r.persona_id)
      : allResumes.filter((r) => r.persona_id === activeTab);

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Resumes</h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage resume versions. Assign each to a persona to keep your job search
            organised.
          </p>
        </div>

        {missingProfile && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Create your profile first before generating resume versions.
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
          {/* ── Create form ─────────────────────────────────────── */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">New resume</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="resume-name">Name</Label>
                <Input
                  id="resume-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Data Scientist — ML Focus"
                />
              </div>
              <div>
                <Label htmlFor="resume-format">Format</Label>
                <select
                  id="resume-format"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.format}
                  onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                >
                  <option value="ats">ATS</option>
                  <option value="designed">Designed</option>
                  <option value="tailored">Tailored</option>
                </select>
              </div>
              {personas.length > 0 && (
                <div>
                  <Label htmlFor="resume-persona">Persona (optional)</Label>
                  <select
                    id="resume-persona"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.persona_id}
                    onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}
                  >
                    <option value="">No persona</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending || missingProfile}
              >
                {createMutation.isPending ? "Creating…" : "Create resume"}
              </Button>
              {personas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: create personas in your{" "}
                  <a href="/profile" className="underline hover:text-foreground">
                    Profile
                  </a>{" "}
                  to group resumes by role.
                </p>
              )}
            </div>
          </section>

          {/* ── Resume list ─────────────────────────────────────── */}
          <section className="min-w-0">
            {/* Persona tabs */}
            {personas.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    activeTab === "all"
                      ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  All ({allResumes.length})
                </button>
                {personas.map((p) => {
                  const count = allResumes.filter((r) => r.persona_id === p.id).length;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveTab(p.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        activeTab === p.id
                          ? "border-transparent text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
                      }`}
                      style={
                        activeTab === p.id ? { backgroundColor: p.color ?? "#6b7280" } : {}
                      }
                    >
                      {p.is_default && <span className="text-[10px]">★</span>}
                      {p.name}
                      <span
                        className={`rounded-full px-1.5 text-[11px] ${
                          activeTab === p.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                {unassignedCount > 0 && (
                  <button
                    onClick={() => setActiveTab("__unassigned__")}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      activeTab === "__unassigned__"
                        ? "border-gray-500 bg-gray-500 text-white"
                        : "border-gray-200 text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
                    }`}
                  >
                    Unassigned ({unassignedCount})
                  </button>
                )}
              </div>
            )}

            {/* List states */}
            {resumesQuery.isLoading && <ResumeSkeleton />}

            {resumesQuery.isError && (
              <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load resumes. Please refresh.
              </div>
            )}

            {!resumesQuery.isLoading && !resumesQuery.isError && (
              <div className="space-y-3">
                {visibleResumes.map((resume) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    personas={personas}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onAssign={(resumeId, personaId) =>
                      assignMutation.mutate({ resumeId, personaId })
                    }
                    isDeleting={
                      deleteMutation.isPending && deleteMutation.variables === resume.id
                    }
                  />
                ))}
                {visibleResumes.length === 0 && (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {activeTab === "all"
                      ? "No resumes yet. Create one on the left."
                      : activeTab === "__unassigned__"
                      ? "No unassigned resumes."
                      : "No resumes for this persona yet."}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}