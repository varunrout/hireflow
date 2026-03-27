"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { analyticsApi } from "@/lib/analytics-api";

export default function AnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: analyticsApi.getDashboard,
  });

  const statusEntries = useMemo(
    () => Object.entries(analyticsQuery.data?.by_status ?? {}).sort((a, b) => b[1] - a[1]),
    [analyticsQuery.data]
  );

  const conversionCards = analyticsQuery.data
    ? [
        {
          label: "Applied → Screening",
          value: analyticsQuery.data.conversion_rate.applied_to_screening,
        },
        {
          label: "Screening → Offer",
          value: analyticsQuery.data.conversion_rate.screening_to_offer,
        },
        {
          label: "Offer → Accepted",
          value: analyticsQuery.data.conversion_rate.offer_to_accepted,
        },
      ]
    : [];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Review application totals, status mix, and conversion performance.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 md:col-span-1">
            <p className="text-sm text-muted-foreground">Total applications</p>
            <p className="mt-2 text-4xl font-bold">{analyticsQuery.data?.total_applications ?? 0}</p>
          </div>
          {conversionCards.map((card) => (
            <div key={card.label} className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-4xl font-bold">{card.value}%</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">Status breakdown</h2>
            <div className="mt-6 space-y-4">
              {statusEntries.map(([status, count]) => {
                const pct = analyticsQuery.data?.total_applications
                  ? Math.round((count / analyticsQuery.data.total_applications) * 100)
                  : 0;

                return (
                  <div key={status}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{status}</span>
                      <span className="text-muted-foreground">
                        {count} • {pct}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary">
                      <div className="h-3 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!statusEntries.length && !analyticsQuery.isLoading && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No analytics yet. Create applications to populate the dashboard.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">Insights</h2>
            <div className="mt-6 space-y-4 text-sm text-muted-foreground">
              <div className="rounded-lg border p-4">
                <p className="font-medium text-foreground">Top current bottleneck</p>
                <p className="mt-1">
                  {statusEntries[0]
                    ? `Most applications currently sit in ${statusEntries[0][0]}.`
                    : "No bottleneck data yet."}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-medium text-foreground">Screening conversion</p>
                <p className="mt-1">
                  {analyticsQuery.data?.conversion_rate.applied_to_screening ?? 0}% of applied jobs move to screening.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-medium text-foreground">Offer conversion</p>
                <p className="mt-1">
                  {analyticsQuery.data?.conversion_rate.screening_to_offer ?? 0}% of screening stages convert to offers.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}