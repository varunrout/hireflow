"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applicationsApi } from "@/lib/applications-api";
import { jobsApi } from "@/lib/jobs-api";
import { resumesApi } from "@/lib/resumes-api";

const statusOptions = [
  "saved",
  "applied",
  "screening",
  "phone_interview",
  "technical_interview",
  "onsite_interview",
  "offer",
  "rejected",
  "withdrawn",
  "accepted",
] as const;

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [form, setForm] = useState({ job_posting_id: "", resume_version_id: "", notes: "" });

  const applicationsQuery = useQuery({
    queryKey: ["applications", selectedStatus],
    queryFn: () => applicationsApi.list({ limit: 50, status: selectedStatus || undefined }),
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs-for-applications"],
    queryFn: () => jobsApi.list({ limit: 100 }),
  });
  const resumesQuery = useQuery({
    queryKey: ["resumes-for-applications"],
    queryFn: () => resumesApi.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      applicationsApi.create({
        job_posting_id: form.job_posting_id,
        resume_version_id: form.resume_version_id || null,
        notes: form.notes || null,
        source: "manual",
      }),
    onSuccess: () => {
      setForm({ job_posting_id: "", resume_version_id: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: (typeof statusOptions)[number];
      notes?: string | null | undefined;
    }) => applicationsApi.updateStatus(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    },
  });

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="mt-2 text-muted-foreground">
            Track your pipeline, create new applications, and move them through stages.
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.2fr_1.8fr]">
          <section className="rounded-lg border bg-card p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Create application</h2>
                <p className="text-sm text-muted-foreground">
                  Link a job and optional resume version.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="application-job">Job posting</Label>
                <select
                  id="application-job"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.job_posting_id}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, job_posting_id: e.target.value }))
                  }
                >
                  <option value="">Select a job</option>
                  {(jobsQuery.data?.items ?? []).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} • {job.company}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="application-resume">Resume version</Label>
                <select
                  id="application-resume"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.resume_version_id}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, resume_version_id: e.target.value }))
                  }
                >
                  <option value="">No resume selected</option>
                  {(resumesQuery.data?.items ?? []).map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="application-notes">Notes</Label>
                <Textarea
                  id="application-notes"
                  value={form.notes}
                  onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="What makes this role interesting?"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!form.job_posting_id || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create application"}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Application pipeline</h2>
                <p className="text-sm text-muted-foreground">
                  Review and update your current application states.
                </p>
              </div>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {(applicationsQuery.data?.items ?? []).map((application) => (
                <div key={application.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold">Job ID: {application.job_posting_id}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(application.created_at ?? "").toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {application.notes || "No notes added yet."}
                      </p>
                    </div>
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <select
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={application.status}
                        onChange={(e) =>
                          statusMutation.mutate({
                            id: application.id!,
                            status: e.target.value as (typeof statusOptions)[number],
                            notes: application.notes,
                          })
                        }
                        disabled={statusMutation.isPending}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-muted-foreground">Source: {application.source}</div>
                    </div>
                  </div>
                </div>
              ))}

              {!applicationsQuery.data?.items.length && !applicationsQuery.isLoading && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No applications yet. Create one from a job posting.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}