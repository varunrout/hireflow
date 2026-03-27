"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileApi } from "@/lib/profile-api";
import { resumesApi } from "@/lib/resumes-api";

export default function ResumesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", format: "ats" });

  const profileQuery = useQuery({
    queryKey: ["profile-for-resumes"],
    queryFn: profileApi.getMyProfile,
    retry: false,
  });
  const resumesQuery = useQuery({
    queryKey: ["resumes"],
    queryFn: () => resumesApi.list({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      resumesApi.create({
        name: form.name,
        format: form.format as "ats" | "designed" | "tailored",
        sections: [],
      }),
    onSuccess: () => {
      setForm({ name: "", format: "ats" });
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (resumeId: string) => resumesApi.remove(resumeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  const missingProfile =
    (profileQuery.error as { response?: { status?: number } } | undefined)?.response?.status ===
    404;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Resumes</h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage the resume versions tied to your candidate profile.
          </p>
        </div>

        {missingProfile && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Create your profile first before generating resume versions.
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[1.1fr_1.9fr]">
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">Create resume version</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="resume-name">Name</Label>
                <Input
                  id="resume-name"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Backend Engineer Resume"
                />
              </div>
              <div>
                <Label htmlFor="resume-format">Format</Label>
                <select
                  id="resume-format"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.format}
                  onChange={(e) => setForm((current) => ({ ...current, format: e.target.value }))}
                >
                  <option value="ats">ATS</option>
                  <option value="designed">Designed</option>
                  <option value="tailored">Tailored</option>
                </select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending || missingProfile}
              >
                {createMutation.isPending ? "Creating..." : "Create resume"}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">Resume versions</h2>
            <div className="mt-6 space-y-4">
              {(resumesQuery.data?.items ?? []).map((resume) => (
                <div
                  key={resume.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="font-semibold">{resume.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {resume.format} • {resume.status} • Updated{" "}
                      {new Date(resume.updated_at ?? "").toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate(resume.id!)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              {!resumesQuery.data?.items.length && !resumesQuery.isLoading && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No resume versions yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}