import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <header className="flex items-center justify-between border-b px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">HireFlow</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 py-24 text-center">
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight">
          Your AI-Powered{" "}
          <span className="text-primary">Job Application Copilot</span>
        </h1>
        <p className="mb-10 max-w-2xl text-xl text-muted-foreground">
          Create tailored resumes, generate cover letters, track applications, and land your dream
          job — all in one place.
        </p>
        <div className="flex gap-4">
          <Link href="/register">
            <Button size="lg">Start for free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6 text-left shadow-sm">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const FEATURES = [
  {
    icon: "📄",
    title: "ATS-Ready Resumes",
    description: "Generate machine-readable resumes that pass applicant tracking systems.",
  },
  {
    icon: "🎨",
    title: "Designed Resumes",
    description: "Choose from beautiful templates to impress human reviewers.",
  },
  {
    icon: "🎯",
    title: "Job Matching",
    description: "Get a detailed match score with skill gap analysis for every job.",
  },
  {
    icon: "✉️",
    title: "Cover Letters",
    description: "Generate personalized cover letters tailored to each application.",
  },
  {
    icon: "📊",
    title: "Application Tracker",
    description: "Track every application through your hiring pipeline.",
  },
  {
    icon: "🔌",
    title: "Browser Extension",
    description: "Autofill job application forms with one click.",
  },
];
