"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  profileApi,
  type CandidatePreferencesPayload,
  type SkillPayload,
} from "@/lib/profile-api";

const emptyProfile = {
  headline: "",
  summary: "",
  phone: "",
  location: "",
  website_url: "",
  linkedin_url: "",
  github_url: "",
  years_of_experience: "",
};

const emptyPreferences = {
  desired_roles: "",
  desired_locations: "",
  desired_industries: "",
  excluded_companies: "",
  remote_preference: "any",
  min_salary: "",
  max_salary: "",
  salary_currency: "USD",
  notice_period_days: "",
};

function toCsv(value?: string[] | null) {
  return value?.join(", ") ?? "";
}

function fromCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [preferencesForm, setPreferencesForm] = useState(emptyPreferences);
  const [skillForm, setSkillForm] = useState<SkillPayload>({
    name: "",
    category: "technical",
    proficiency: "intermediate",
  });

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.getMyProfile,
    retry: false,
  });

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: profileApi.getPreferences,
    retry: false,
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfileForm({
      headline: profileQuery.data.headline ?? "",
      summary: profileQuery.data.summary ?? "",
      phone: profileQuery.data.phone ?? "",
      location: profileQuery.data.location ?? "",
      website_url: profileQuery.data.website_url ?? "",
      linkedin_url: profileQuery.data.linkedin_url ?? "",
      github_url: profileQuery.data.github_url ?? "",
      years_of_experience:
        profileQuery.data.years_of_experience === null ||
        profileQuery.data.years_of_experience === undefined
          ? ""
          : String(profileQuery.data.years_of_experience),
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (!preferencesQuery.data) return;
    setPreferencesForm({
      desired_roles: toCsv(preferencesQuery.data.desired_roles),
      desired_locations: toCsv(preferencesQuery.data.desired_locations),
      desired_industries: toCsv(preferencesQuery.data.desired_industries),
      excluded_companies: toCsv(preferencesQuery.data.excluded_companies),
      remote_preference: preferencesQuery.data.remote_preference ?? "any",
      min_salary:
        preferencesQuery.data.min_salary === null ||
        preferencesQuery.data.min_salary === undefined
          ? ""
          : String(preferencesQuery.data.min_salary),
      max_salary:
        preferencesQuery.data.max_salary === null ||
        preferencesQuery.data.max_salary === undefined
          ? ""
          : String(preferencesQuery.data.max_salary),
      salary_currency: preferencesQuery.data.salary_currency ?? "USD",
      notice_period_days:
        preferencesQuery.data.notice_period_days === null ||
        preferencesQuery.data.notice_period_days === undefined
          ? ""
          : String(preferencesQuery.data.notice_period_days),
    });
  }, [preferencesQuery.data]);

  const hasProfile = !!profileQuery.data;
  const profileMissing =
    (profileQuery.error as { response?: { status?: number } } | undefined)?.response?.status ===
    404;

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        headline: profileForm.headline || undefined,
        summary: profileForm.summary || undefined,
        phone: profileForm.phone || undefined,
        location: profileForm.location || undefined,
        website_url: profileForm.website_url || undefined,
        linkedin_url: profileForm.linkedin_url || undefined,
        github_url: profileForm.github_url || undefined,
        years_of_experience: profileForm.years_of_experience
          ? Number(profileForm.years_of_experience)
          : undefined,
      };

      return hasProfile ? profileApi.updateProfile(payload) : profileApi.createProfile(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: async () => {
      const payload: CandidatePreferencesPayload = {
        desired_roles: fromCsv(preferencesForm.desired_roles),
        desired_locations: fromCsv(preferencesForm.desired_locations),
        desired_industries: fromCsv(preferencesForm.desired_industries),
        excluded_companies: fromCsv(preferencesForm.excluded_companies),
        remote_preference:
          preferencesForm.remote_preference as CandidatePreferencesPayload["remote_preference"],
        min_salary: preferencesForm.min_salary ? Number(preferencesForm.min_salary) : null,
        max_salary: preferencesForm.max_salary ? Number(preferencesForm.max_salary) : null,
        salary_currency: preferencesForm.salary_currency || "USD",
        notice_period_days: preferencesForm.notice_period_days
          ? Number(preferencesForm.notice_period_days)
          : null,
        employment_types: ["full_time"],
        willing_to_relocate: false,
      };

      return profileApi.upsertPreferences(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: async () => profileApi.addSkill(skillForm),
    onSuccess: () => {
      setSkillForm({ name: "", category: "technical", proficiency: "intermediate" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (skillId: string) => profileApi.deleteSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const statCards = useMemo(
    () => [
      { label: "Experiences", value: profileQuery.data?.work_experiences.length ?? 0 },
      { label: "Projects", value: profileQuery.data?.projects.length ?? 0 },
      { label: "Skills", value: profileQuery.data?.skills.length ?? 0 },
      { label: "Education", value: profileQuery.data?.education.length ?? 0 },
    ],
    [profileQuery.data]
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your candidate profile, preferences, and core skills.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {(profileQuery.isLoading || preferencesQuery.isLoading) && (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Loading your profile workspace...
          </div>
        )}

        {((profileQuery.isError && !profileMissing) ||
          (preferencesQuery.isError &&
            (preferencesQuery.error as { response?: { status?: number } } | undefined)?.response
              ?.status !== 404)) && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load some profile data. Try refreshing the page.
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Candidate profile</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasProfile
                      ? "Update the information used across resumes and applications."
                      : "Create your base profile to unlock resumes and applications."}
                  </p>
                </div>
                {profileMissing && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    Not created yet
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={profileForm.headline}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, headline: e.target.value }))
                    }
                    placeholder="Senior Product Designer"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    value={profileForm.summary}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, summary: e.target.value }))
                    }
                    placeholder="Share your background, strengths, and the type of roles you want."
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, phone: e.target.value }))
                    }
                    placeholder="+1 555 010 2020"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profileForm.location}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, location: e.target.value }))
                    }
                    placeholder="Berlin, Germany"
                  />
                </div>
                <div>
                  <Label htmlFor="website_url">Website</Label>
                  <Input
                    id="website_url"
                    value={profileForm.website_url}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, website_url: e.target.value }))
                    }
                    placeholder="https://portfolio.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={profileForm.linkedin_url}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, linkedin_url: e.target.value }))
                    }
                    placeholder="https://linkedin.com/in/you"
                  />
                </div>
                <div>
                  <Label htmlFor="github_url">GitHub</Label>
                  <Input
                    id="github_url"
                    value={profileForm.github_url}
                    onChange={(e) =>
                      setProfileForm((current) => ({ ...current, github_url: e.target.value }))
                    }
                    placeholder="https://github.com/you"
                  />
                </div>
                <div>
                  <Label htmlFor="years_of_experience">Years of experience</Label>
                  <Input
                    id="years_of_experience"
                    type="number"
                    value={profileForm.years_of_experience}
                    onChange={(e) =>
                      setProfileForm((current) => ({
                        ...current,
                        years_of_experience: e.target.value,
                      }))
                    }
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
                  {profileMutation.isPending
                    ? "Saving..."
                    : hasProfile
                      ? "Save profile"
                      : "Create profile"}
                </Button>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Job preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Set your role and salary preferences for better job matching.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="desired_roles">Desired roles</Label>
                  <Textarea
                    id="desired_roles"
                    value={preferencesForm.desired_roles}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        desired_roles: e.target.value,
                      }))
                    }
                    placeholder="Product Designer, UX Researcher"
                  />
                </div>
                <div>
                  <Label htmlFor="desired_locations">Desired locations</Label>
                  <Textarea
                    id="desired_locations"
                    value={preferencesForm.desired_locations}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        desired_locations: e.target.value,
                      }))
                    }
                    placeholder="Remote, Berlin, Amsterdam"
                  />
                </div>
                <div>
                  <Label htmlFor="desired_industries">Industries</Label>
                  <Textarea
                    id="desired_industries"
                    value={preferencesForm.desired_industries}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        desired_industries: e.target.value,
                      }))
                    }
                    placeholder="SaaS, Fintech"
                  />
                </div>
                <div>
                  <Label htmlFor="excluded_companies">Excluded companies</Label>
                  <Textarea
                    id="excluded_companies"
                    value={preferencesForm.excluded_companies}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        excluded_companies: e.target.value,
                      }))
                    }
                    placeholder="Company A, Company B"
                  />
                </div>
                <div>
                  <Label htmlFor="remote_preference">Remote preference</Label>
                  <select
                    id="remote_preference"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={preferencesForm.remote_preference}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        remote_preference: e.target.value,
                      }))
                    }
                  >
                    <option value="any">Any</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="salary_currency">Currency</Label>
                  <Input
                    id="salary_currency"
                    value={preferencesForm.salary_currency}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        salary_currency: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label htmlFor="min_salary">Min salary</Label>
                  <Input
                    id="min_salary"
                    type="number"
                    value={preferencesForm.min_salary}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({ ...current, min_salary: e.target.value }))
                    }
                    placeholder="90000"
                  />
                </div>
                <div>
                  <Label htmlFor="max_salary">Max salary</Label>
                  <Input
                    id="max_salary"
                    type="number"
                    value={preferencesForm.max_salary}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({ ...current, max_salary: e.target.value }))
                    }
                    placeholder="130000"
                  />
                </div>
                <div>
                  <Label htmlFor="notice_period_days">Notice period (days)</Label>
                  <Input
                    id="notice_period_days"
                    type="number"
                    value={preferencesForm.notice_period_days}
                    onChange={(e) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        notice_period_days: e.target.value,
                      }))
                    }
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => preferencesMutation.mutate()}
                  disabled={preferencesMutation.isPending}
                >
                  {preferencesMutation.isPending ? "Saving..." : "Save preferences"}
                </Button>
              </div>
            </section>
          </div>

          <section className="rounded-lg border bg-card p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Skills</h2>
              <p className="text-sm text-muted-foreground">
                Add the core skills that should surface in resumes and job matching.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="skill_name">Skill name</Label>
                <Input
                  id="skill_name"
                  value={skillForm.name}
                  onChange={(e) =>
                    setSkillForm((current) => ({ ...current, name: e.target.value }))
                  }
                  placeholder="TypeScript"
                />
              </div>
              <div>
                <Label htmlFor="skill_category">Category</Label>
                <select
                  id="skill_category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={skillForm.category}
                  onChange={(e) =>
                    setSkillForm((current) => ({
                      ...current,
                      category: e.target.value as SkillPayload["category"],
                    }))
                  }
                >
                  <option value="technical">Technical</option>
                  <option value="soft">Soft</option>
                  <option value="language">Language</option>
                  <option value="tool">Tool</option>
                  <option value="framework">Framework</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="skill_proficiency">Proficiency</Label>
                <select
                  id="skill_proficiency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={skillForm.proficiency}
                  onChange={(e) =>
                    setSkillForm((current) => ({
                      ...current,
                      proficiency: e.target.value as SkillPayload["proficiency"],
                    }))
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <Button
                className="w-full"
                onClick={() => addSkillMutation.mutate()}
                disabled={!skillForm.name || addSkillMutation.isPending || !hasProfile}
              >
                {addSkillMutation.isPending ? "Adding..." : "Add skill"}
              </Button>
              {!hasProfile && (
                <p className="text-xs text-muted-foreground">
                  Create your profile first to start adding skills.
                </p>
              )}
            </div>

            <div className="mt-8 space-y-3">
              {(profileQuery.data?.skills ?? []).map((skill) => (
                <div
                  key={skill.id ?? `${skill.name}-${skill.category}`}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {skill.category} {skill.proficiency ? `• ${skill.proficiency}` : ""}
                    </p>
                  </div>
                  {skill.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSkillMutation.mutate(skill.id!)}
                      disabled={deleteSkillMutation.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {!profileQuery.data?.skills.length && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No skills yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}