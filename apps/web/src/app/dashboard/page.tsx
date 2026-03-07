export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Dashboard</h1>
      <p className="mb-8 text-muted-foreground">
        Welcome back! Here&apos;s an overview of your job search.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            {stat.sub && <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Recent Applications</h2>
          <p className="text-sm text-muted-foreground">
            No applications yet.{" "}
            <a href="/jobs" className="text-primary hover:underline">
              Browse jobs
            </a>{" "}
            to get started.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Quick Actions</h2>
          <div className="space-y-2">
            <a
              href="/resumes"
              className="block rounded border p-3 text-sm hover:bg-accent"
            >
              📄 Create a new resume
            </a>
            <a href="/jobs" className="block rounded border p-3 text-sm hover:bg-accent">
              🔍 Browse job matches
            </a>
            <a
              href="/profile"
              className="block rounded border p-3 text-sm hover:bg-accent"
            >
              👤 Complete your profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATS = [
  { label: "Total Applications", value: "0", sub: "Start applying today" },
  { label: "Active Applications", value: "0", sub: "In progress" },
  { label: "Interviews", value: "0", sub: "Scheduled" },
  { label: "Offers", value: "0", sub: "Pending review" },
];
