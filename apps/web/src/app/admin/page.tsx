"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth-api";
import { profileApi } from "@/lib/profile-api";
import { resumesApi } from "@/lib/resumes-api";
import { jobsApi } from "@/lib/jobs-api";
import { applicationsApi } from "@/lib/applications-api";
import { analyticsApi } from "@/lib/analytics-api";
import { automationApi } from "@/lib/automation-api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface TestCase {
  id: string;
  name: string;
  method: HttpMethod;
  endpoint: string;
  description?: string;
  run: () => Promise<unknown>;
  expectFailure?: boolean;
  expectedStatus?: number;
}

interface SectionSummary {
  passed: number;
  failed: number;
  total: number;
}

interface TestResult {
  status: "idle" | "running" | "pass" | "fail";
  httpStatus?: number;
  duration?: number;
  data?: unknown;
  error?: string;
}

const CANDIDATE_EMAIL = "test.admin+hireflow@example.com";
const CANDIDATE_PASSWORD = "Password1";
const CANDIDATE_FULL_NAME = "HireFlow Admin Tester";

const SAMPLE_JOB_TEXT = `Senior Backend Engineer\nAcme Labs\nRemote - United States\n\nWe are looking for a Senior Backend Engineer to build APIs and distributed systems.\nRequirements:\n- 5+ years of backend software engineering experience\n- Strong Python and FastAPI skills\n- Experience with PostgreSQL, Docker, and Redis\nNice to have:\n- Kubernetes\n- AWS\nResponsibilities:\n- Build scalable APIs\n- Collaborate with product and frontend teams\nBenefits:\n- Health insurance\n- Learning budget\n`;

const SAMPLE_EXTERNAL_JOB = {
  provider: "remotive",
  title: "Backend Platform Engineer",
  company: "Demo Corp",
  location: "Remote",
  remote_type: "remote" as const,
  employment_type: "full_time" as const,
  description:
    "Build platform APIs with Python, FastAPI and PostgreSQL. Collaborate on reliability and performance.",
  requirements: ["Python", "FastAPI", "PostgreSQL"],
  nice_to_haves: ["Redis", "Docker"],
  source: "other" as const,
  source_url: "https://example.com/jobs/backend-platform-engineer",
  source_job_id: "demo-backend-platform-001",
  posted_at: new Date().toISOString(),
};

const SAMPLE_JOB_PAYLOAD = {
  title: "QA Workflow Test Engineer",
  company: "HireFlow Test Company",
  location: "Remote",
  description:
    "This job is created by the Admin Test Console to validate end-to-end workflows.",
  source: "manual" as const,
  requirements: ["Testing", "APIs", "Automation"],
  nice_to_haves: ["FastAPI", "Next.js"],
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function AdminPage() {
  const meQuery = useQuery({
    queryKey: ["admin-console-me"],
    queryFn: authApi.me,
  });

  const adminAllowlist = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin =
    adminAllowlist.length === 0 ||
    !!meQuery.data?.email && adminAllowlist.includes(meQuery.data.email.toLowerCase());

  const [sections, setSections] = useState<Record<string, SectionSummary>>({});
  const [sectionResults, setSectionResults] = useState<
    Record<string, Record<string, TestResult>>
  >({});
  const [seed, setSeed] = useState({
    role: "backend engineer",
    location: "remote",
    profileHeadline: "Senior Backend Engineer",
    profileSummary:
      "Backend engineer focused on APIs, distributed systems, and reliable product delivery.",
    resumeName: "Admin Test Resume",
    skillName: "FastAPI",
    appNote: "Created via Admin Test Console",
  });

  const updateSectionSummary = (id: string, summary: SectionSummary) => {
    setSections((prev) => ({ ...prev, [id]: summary }));
  };

  const updateSectionResults = useCallback(
    (id: string, results: Record<string, TestResult>) => {
      setSectionResults((previous) => ({ ...previous, [id]: results }));
    },
    [],
  );

  const allSummaries = Object.values(sections);
  const globalPassed = allSummaries.reduce((a, s) => a + s.passed, 0);
  const globalFailed = allSummaries.reduce((a, s) => a + s.failed, 0);
  const globalTotal = allSummaries.reduce((a, s) => a + s.total, 0);

  const hasAnyLogs = Object.values(sectionResults).some(
    (section) => Object.keys(section).length > 0,
  );

  const downloadDetailedLogs = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      admin_user: meQuery.data?.email ?? null,
      summary: {
        passed: globalPassed,
        failed: globalFailed,
        total: globalTotal,
      },
      seed,
      sections: sectionsConfig.map((section) => {
        const sectionResultMap = sectionResults[section.id] ?? {};

        return {
          id: section.id,
          title: section.title,
          description: section.description,
          summary: sections[section.id] ?? {
            passed: 0,
            failed: 0,
            total: section.tests.length,
          },
          tests: section.tests.map((test) => ({
            id: test.id,
            name: test.name,
            method: test.method,
            endpoint: test.endpoint,
            description: test.description ?? null,
            expect_failure: test.expectFailure ?? false,
            expected_status: test.expectedStatus ?? null,
            result: sectionResultMap[test.id] ?? { status: "idle" },
          })),
        };
      }),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `admin-test-logs-${new Date().toISOString().replace(/[.:]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [
    globalFailed,
    globalPassed,
    globalTotal,
    meQuery.data?.email,
    sections,
    sectionResults,
    seed,
  ]);

  const authTests = useMemo<TestCase[]>(
    () => [
      {
        id: "auth-register-duplicate",
        name: "Register duplicate test user (expect 409)",
        method: "POST",
        endpoint: "/auth/register",
        description:
          "Validates conflict handling for existing email addresses.",
        expectFailure: true,
        expectedStatus: 409,
        run: async () =>
          authApi.register({
            email: CANDIDATE_EMAIL,
            password: CANDIDATE_PASSWORD,
            full_name: CANDIDATE_FULL_NAME,
          }),
      },
      {
        id: "auth-login",
        name: "Login test user",
        method: "POST",
        endpoint: "/auth/login",
        run: async () =>
          authApi.login({
            email: CANDIDATE_EMAIL,
            password: CANDIDATE_PASSWORD,
          }),
      },
      {
        id: "auth-me",
        name: "Fetch current user",
        method: "GET",
        endpoint: "/auth/me",
        run: async () => authApi.me(),
      },
      {
        id: "auth-update-me",
        name: "Update user full name",
        method: "PUT",
        endpoint: "/auth/me",
        run: async () =>
          authApi.updateMe({
            full_name: `${CANDIDATE_FULL_NAME} (${new Date().toISOString().slice(11, 19)})`,
          }),
      },
    ],
    [],
  );

  const profileTests = useMemo<TestCase[]>(
    () => [
      {
        id: "profile-create-or-update",
        name: "Create/Update profile",
        method: "POST",
        endpoint: "/profiles/me",
        run: async () => {
          try {
            return await profileApi.createProfile({
              headline: seed.profileHeadline,
              summary: seed.profileSummary,
              location: seed.location,
              years_of_experience: 6,
              linkedin_url: "https://linkedin.com/in/hireflow-admin-test",
              github_url: "https://github.com/hireflow-test",
            });
          } catch {
            return profileApi.updateProfile({
              headline: seed.profileHeadline,
              summary: seed.profileSummary,
              location: seed.location,
              years_of_experience: 6,
              linkedin_url: "https://linkedin.com/in/hireflow-admin-test",
              github_url: "https://github.com/hireflow-test",
            });
          }
        },
      },
      {
        id: "profile-get",
        name: "Get profile with nested sections",
        method: "GET",
        endpoint: "/profiles/me",
        run: async () => profileApi.getMyProfile(),
      },
      {
        id: "profile-upsert-prefs",
        name: "Upsert candidate preferences",
        method: "PUT",
        endpoint: "/profiles/me/preferences",
        run: async () =>
          profileApi.upsertPreferences({
            desired_roles: splitCsv(seed.role),
            desired_locations: splitCsv(seed.location),
            remote_preference: "any",
            employment_types: ["full_time", "contract"],
            min_salary: 100000,
            max_salary: 180000,
            salary_currency: "USD",
            desired_industries: ["SaaS", "Developer Tools"],
            excluded_companies: [],
            willing_to_relocate: false,
            notice_period_days: 30,
          }),
      },
      {
        id: "profile-get-prefs",
        name: "Fetch preferences",
        method: "GET",
        endpoint: "/profiles/me/preferences",
        run: async () => profileApi.getPreferences(),
      },
      {
        id: "profile-add-skill",
        name: "Add test skill",
        method: "POST",
        endpoint: "/profiles/me/skills",
        run: async () =>
          profileApi.addSkill({
            name: `${seed.skillName}-${Date.now().toString().slice(-4)}`,
            category: "technical",
            proficiency: "advanced",
          }),
      },
    ],
    [seed],
  );

  const resumeTests = useMemo<TestCase[]>(
    () => [
      {
        id: "resume-list",
        name: "List resumes",
        method: "GET",
        endpoint: "/resumes",
        run: async () => resumesApi.list({ limit: 10 }),
      },
      {
        id: "resume-create",
        name: "Create resume version",
        method: "POST",
        endpoint: "/resumes",
        run: async () =>
          resumesApi.create({
            name: `${seed.resumeName} ${new Date().toISOString().slice(11, 19)}`,
            format: "ats",
            sections: [],
          }),
      },
      {
        id: "resume-templates",
        name: "Get resume templates",
        method: "GET",
        endpoint: "/resumes/templates",
        run: async () => {
          const list = await resumesApi.list({ limit: 1 });
          if (!list.items.length) return { note: "No resume yet to verify" };
          return list;
        },
      },
    ],
    [seed.resumeName],
  );

  const jobTests = useMemo<TestCase[]>(
    () => [
      {
        id: "jobs-list",
        name: "List saved jobs",
        method: "GET",
        endpoint: "/jobs",
        run: async () => jobsApi.list({ limit: 20 }),
      },
      {
        id: "jobs-create",
        name: "Create manual job",
        method: "POST",
        endpoint: "/jobs",
        run: async () =>
          jobsApi.create({
            ...SAMPLE_JOB_PAYLOAD,
            title: `${SAMPLE_JOB_PAYLOAD.title} ${new Date().toISOString().slice(11, 19)}`,
          }),
      },
      {
        id: "jobs-search-external",
        name: "Search external providers",
        method: "POST",
        endpoint: "/jobs/search/external",
        run: async () =>
          jobsApi.searchExternal({
            role: seed.role,
            location: seed.location,
            remote_only: true,
            limit: 5,
          }),
      },
      {
        id: "jobs-extract",
        name: "AI/heuristic job extraction preview",
        method: "POST",
        endpoint: "/jobs/extract",
        run: async () =>
          jobsApi.extractFromText({
            job_text: SAMPLE_JOB_TEXT,
            source_url: "https://example.com/job/senior-backend-engineer",
          }),
      },
      {
        id: "jobs-ingest-manual",
        name: "Ingest pasted job text",
        method: "POST",
        endpoint: "/jobs/ingest-manual",
        run: async () =>
          jobsApi.ingestManual({
            job_text: `${SAMPLE_JOB_TEXT}\n\n[ingested-at:${new Date().toISOString()}]`,
            source_url: "https://example.com/job/ingest-manual",
          }),
      },
      {
        id: "jobs-import-external",
        name: "Import synthetic external job",
        method: "POST",
        endpoint: "/jobs/import-external",
        run: async () =>
          jobsApi.importExternal({
            ...SAMPLE_EXTERNAL_JOB,
            title: `${SAMPLE_EXTERNAL_JOB.title} ${new Date().toISOString().slice(11, 19)}`,
            source_job_id: `${SAMPLE_EXTERNAL_JOB.source_job_id}-${Date.now()}`,
          }),
      },
      {
        id: "jobs-get-parse-result",
        name: "Fetch parse-result for latest job",
        method: "GET",
        endpoint: "/jobs/{jobId}/parse-result",
        run: async () => {
          const jobs = await jobsApi.list({ limit: 1 });
          const latest = jobs.items[0];
          if (!latest?.id) throw new Error("No jobs available to fetch parse result");
          return jobsApi.getParseResult(latest.id);
        },
      },
    ],
    [seed.role, seed.location],
  );

  const applicationTests = useMemo<TestCase[]>(
    () => [
      {
        id: "applications-list",
        name: "List applications",
        method: "GET",
        endpoint: "/applications",
        run: async () => applicationsApi.list({ limit: 20 }),
      },
      {
        id: "applications-create",
        name: "Create application from latest job",
        method: "POST",
        endpoint: "/applications",
        run: async () => {
          const jobs = await jobsApi.list({ limit: 1 });
          const latestJob = jobs.items[0];
          if (!latestJob?.id) {
            throw new Error("No job exists. Run job create/ingest first.");
          }

          const resumes = await resumesApi.list({ limit: 1 });
          const latestResume = resumes.items[0];

          return applicationsApi.create({
            job_posting_id: latestJob.id,
            resume_version_id: latestResume?.id ?? null,
            notes: `${seed.appNote} (${new Date().toISOString()})`,
            source: "manual",
          });
        },
      },
      {
        id: "applications-update-status",
        name: "Move latest application saved -> applied",
        method: "PATCH",
        endpoint: "/applications/{id}/status",
        run: async () => {
          const list = await applicationsApi.list({ limit: 1 });
          const latest = list.items[0];
          if (!latest?.id) throw new Error("No application found");
          return applicationsApi.updateStatus(latest.id, {
            status: "applied",
            notes: "Transitioned from Admin Test Console",
          });
        },
      },
      {
        id: "applications-invalid-transition",
        name: "Invalid transition check (expect 422)",
        method: "PATCH",
        endpoint: "/applications/{id}/status",
        description: "Attempts to jump to accepted directly from non-offer state.",
        expectFailure: true,
        expectedStatus: 422,
        run: async () => {
          const list = await applicationsApi.list({ limit: 1 });
          const latest = list.items[0];
          if (!latest?.id) throw new Error("No application found");
          return applicationsApi.updateStatus(latest.id, {
            status: "accepted",
            notes: "Should fail if state machine is working",
          });
        },
      },
      {
        id: "applications-list-answers",
        name: "List answers for latest application",
        method: "GET",
        endpoint: "/applications/{id}/answers",
        run: async () => {
          const list = await applicationsApi.list({ limit: 1 });
          const latest = list.items[0];
          if (!latest?.id) throw new Error("No application found");
          return applicationsApi.listAnswers(latest.id);
        },
      },
    ],
    [seed.appNote],
  );

  const analyticsTests = useMemo<TestCase[]>(
    () => [
      {
        id: "analytics-dashboard",
        name: "Fetch analytics dashboard",
        method: "GET",
        endpoint: "/analytics/dashboard",
        run: async () => analyticsApi.getDashboard(),
      },
    ],
    [],
  );

  const automationTests = useMemo<TestCase[]>(
    () => [
      {
        id: "automation-get-settings",
        name: "Fetch automation settings",
        method: "GET",
        endpoint: "/automation/settings",
        run: async () => automationApi.getSettings(),
      },
      {
        id: "automation-upsert-settings",
        name: "Save automation settings",
        method: "PUT",
        endpoint: "/automation/settings",
        run: async () =>
          automationApi.saveSettings({
            enabled: true,
            auto_apply_enabled: false,
            require_human_review: true,
            auto_tailor_resume: true,
            auto_generate_cover_letter: false,
            allowed_sources: ["linkedin", "indeed", "greenhouse"],
            search_terms: splitCsv(seed.role),
            target_locations: splitCsv(seed.location),
            excluded_keywords: [],
            min_match_score: 65,
            max_jobs_per_run: 20,
            max_applications_per_day: 3,
          }),
      },
      {
        id: "automation-readiness",
        name: "Fetch automation readiness",
        method: "GET",
        endpoint: "/automation/readiness",
        run: async () => automationApi.getReadiness(),
      },
      {
        id: "automation-run-dry",
        name: "Trigger dry-run automation cycle",
        method: "POST",
        endpoint: "/automation/runs",
        run: async () => automationApi.runNow({ dry_run: true }),
      },
      {
        id: "automation-list-runs",
        name: "List automation run history",
        method: "GET",
        endpoint: "/automation/runs",
        run: async () => automationApi.listRuns(10),
      },
    ],
    [seed.location, seed.role],
  );

  const sectionsConfig = [
    {
      id: "auth",
      title: "Authentication",
      description: "Session, identity, and token-protected endpoints",
      icon: "🔐",
      tests: authTests,
    },
    {
      id: "profile",
      title: "Candidate Profile",
      description: "Profile CRUD, preferences, and skills",
      icon: "👤",
      tests: profileTests,
    },
    {
      id: "resumes",
      title: "Resume Workflows",
      description: "Resume listing/creation and template dependencies",
      icon: "📄",
      tests: resumeTests,
    },
    {
      id: "jobs",
      title: "Jobs & Parsing",
      description: "Manual jobs, external search, extraction and ingestion",
      icon: "🧠",
      tests: jobTests,
    },
    {
      id: "applications",
      title: "Applications",
      description: "Application create/list/status machine validation",
      icon: "📌",
      tests: applicationTests,
    },
    {
      id: "analytics",
      title: "Analytics",
      description: "Dashboard funnel calculations",
      icon: "📊",
      tests: analyticsTests,
    },
    {
      id: "automation",
      title: "Automation",
      description: "Automation settings, readiness, and run history",
      icon: "🤖",
      tests: automationTests,
    },
  ];

  if (meQuery.isLoading) {
    return (
      <AppShell>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Checking admin access...
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-sm text-destructive">
          You are not authorized to access the Admin Test Console.
          Set <code className="mx-1 rounded bg-muted px-1">NEXT_PUBLIC_ADMIN_EMAILS</code>
          to allow specific accounts.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Test Console</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Run independent workflow checks to validate every major module end-to-end.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Passed</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {globalPassed}
                </p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {globalFailed}
                </p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{globalTotal}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            This console triggers real API writes (jobs, resumes, applications, profile updates).
            Use a dedicated test account and test database.
          </div>

          <div className="mt-3 flex justify-end">
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                if (hasAnyLogs) {
                  downloadDetailedLogs();
                }
              }}
              className={`text-sm underline underline-offset-4 ${
                hasAnyLogs
                  ? "text-primary hover:text-primary/80"
                  : "cursor-not-allowed text-muted-foreground"
              }`}
              aria-disabled={!hasAnyLogs}
            >
              Download detailed test logs (.json)
            </a>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Test Data Seed</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            These values are used by multiple workflow checks.
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Role"
              value={seed.role}
              onChange={(v) => setSeed((s) => ({ ...s, role: v }))}
            />
            <Field
              label="Location"
              value={seed.location}
              onChange={(v) => setSeed((s) => ({ ...s, location: v }))}
            />
            <Field
              label="Profile headline"
              value={seed.profileHeadline}
              onChange={(v) => setSeed((s) => ({ ...s, profileHeadline: v }))}
            />
            <Field
              label="Profile summary"
              value={seed.profileSummary}
              onChange={(v) => setSeed((s) => ({ ...s, profileSummary: v }))}
            />
            <Field
              label="Resume name"
              value={seed.resumeName}
              onChange={(v) => setSeed((s) => ({ ...s, resumeName: v }))}
            />
            <Field
              label="Skill name"
              value={seed.skillName}
              onChange={(v) => setSeed((s) => ({ ...s, skillName: v }))}
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setSeed({
                  role: "backend engineer",
                  location: "remote",
                  profileHeadline: "Senior Backend Engineer",
                  profileSummary:
                    "Backend engineer focused on APIs, distributed systems, and reliable product delivery.",
                  resumeName: "Admin Test Resume",
                  skillName: "FastAPI",
                  appNote: "Created via Admin Test Console",
                })
              }
            >
              Reset seed values
            </Button>
          </div>
        </section>

        <div className="space-y-4">
          {sectionsConfig.map((section) => (
            <TestSection
              key={section.id}
              id={section.id}
              title={section.title}
              description={section.description}
              icon={section.icon}
              tests={section.tests}
              onSummaryChange={updateSectionSummary}
              onResultsChange={updateSectionResults}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TestSection({
  id,
  title,
  description,
  icon,
  tests,
  onSummaryChange,
  onResultsChange,
}: {
  id: string;
  title: string;
  description: string;
  icon: string;
  tests: TestCase[];
  onSummaryChange?: (id: string, summary: SectionSummary) => void;
  onResultsChange?: (id: string, results: Record<string, TestResult>) => void;
}) {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    onResultsChange?.(id, results);
  }, [id, onResultsChange, results]);

  const notifySummary = useCallback(
    (next: Record<string, TestResult>) => {
      const vals = Object.values(next);
      onSummaryChange?.(id, {
        passed: vals.filter((result) => result.status === "pass").length,
        failed: vals.filter((result) => result.status === "fail").length,
        total: tests.length,
      });
    },
    [id, tests.length, onSummaryChange],
  );

  const setResult = useCallback(
    (testId: string, result: TestResult) => {
      setResults((previousResults) => {
        const next = { ...previousResults, [testId]: result };
        notifySummary(next);
        return next;
      });
    },
    [notifySummary],
  );

  const runOne = useCallback(
    async (test: TestCase) => {
      setResult(test.id, { status: "running" });
      const startedAt = performance.now();

      try {
        const data = await test.run();
        const duration = Math.round(performance.now() - startedAt);

        if (test.expectFailure) {
          setResult(test.id, {
            status: "fail",
            duration,
            data,
            error: "Expected failure but request succeeded",
          });
          return;
        }

        setResult(test.id, { status: "pass", duration, data });
      } catch (error: unknown) {
        const duration = Math.round(performance.now() - startedAt);
        const axiosLikeError = error as {
          response?: { status?: number; data?: unknown };
          message?: string;
        };

        const httpStatus = axiosLikeError.response?.status;
        const responseData = axiosLikeError.response?.data as
          | Record<string, unknown>
          | undefined;

        if (
          test.expectFailure &&
          (!test.expectedStatus || test.expectedStatus === httpStatus)
        ) {
          setResult(test.id, {
            status: "pass",
            duration,
            ...(httpStatus !== undefined ? { httpStatus } : {}),
            ...(responseData !== undefined ? { data: responseData } : {}),
          });
          return;
        }

        setResult(test.id, {
          status: "fail",
          duration,
          ...(httpStatus !== undefined ? { httpStatus } : {}),
          ...(responseData !== undefined ? { data: responseData } : {}),
          error:
            (responseData?.detail as string) ??
            (responseData?.message as string) ??
            axiosLikeError.message ??
            "Unknown error",
        });
      }
    },
    [setResult],
  );

  const runAll = useCallback(async () => {
    cancelRef.current = false;
    setRunningAll(true);
    setIsOpen(true);

    for (const test of tests) {
      if (cancelRef.current) break;
      await runOne(test);
    }

    setRunningAll(false);
  }, [tests, runOne]);

  const reset = useCallback(() => {
    setResults({});
    onSummaryChange?.(id, { passed: 0, failed: 0, total: tests.length });
  }, [id, tests.length, onSummaryChange]);

  const passed = Object.values(results).filter(
    (result) => result.status === "pass",
  ).length;
  const failed = Object.values(results).filter(
    (result) => result.status === "fail",
  ).length;

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-accent/40"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(passed > 0 || failed > 0) && (
            <div className="flex items-center gap-2 text-sm">
              {passed > 0 && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                  {passed} passed
                </span>
              )}
              {failed > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  {failed} failed
                </span>
              )}
              <span className="text-muted-foreground">/ {tests.length}</span>
            </div>
          )}
          <span className="text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t px-5 pb-4">
          <div className="flex items-center justify-end gap-2 py-3">
            <Button size="sm" variant="ghost" onClick={reset} disabled={runningAll}>
              Reset
            </Button>
            {runningAll ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  cancelRef.current = true;
                  setRunningAll(false);
                }}
              >
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={runAll}>
                Run all {tests.length} tests
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            {tests.map((test) => {
              const result = results[test.id] ?? ({ status: "idle" } as TestResult);
              const isExpanded = expanded === test.id;

              return (
                <div key={test.id} className="rounded-md border">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-5 text-center text-sm">
                      {result.status === "idle" && "○"}
                      {result.status === "running" && "⏳"}
                      {result.status === "pass" && (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      )}
                      {result.status === "fail" && (
                        <span className="text-red-600 dark:text-red-400">✗</span>
                      )}
                    </span>

                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                      {test.method}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-sm font-medium">{test.name}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {test.endpoint}
                        </span>
                        {test.expectFailure && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            expects error
                            {test.expectedStatus ? ` ${test.expectedStatus}` : ""}
                          </span>
                        )}
                      </div>

                      {test.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {test.description}
                        </p>
                      )}
                    </div>

                    {result.duration != null && (
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {result.duration}ms
                      </span>
                    )}

                    {(result.status === "pass" || result.status === "fail") && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((currentlyExpanded) =>
                            currentlyExpanded === test.id ? null : test.id,
                          )
                        }
                        className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                      >
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => runOne(test)}
                      disabled={result.status === "running" || runningAll}
                    >
                      Run
                    </Button>
                  </div>

                  {isExpanded &&
                    (result.status === "pass" || result.status === "fail") && (
                      <div className="border-t bg-muted/30 px-4 py-3">
                        {result.error && (
                          <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                            Error: {result.error}
                          </p>
                        )}
                        {result.httpStatus != null && (
                          <p className="mb-1 text-xs text-muted-foreground">
                            HTTP {result.httpStatus}
                          </p>
                        )}
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                          {result.data != null
                            ? JSON.stringify(result.data, null, 2)
                            : "No response body"}
                        </pre>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
