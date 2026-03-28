"use client";

import { useQuery } from "@tanstack/react-query";
import { profileApi, type CompletenessResponse } from "@/lib/profile-api";

const SECTION_LABELS: Record<string, string> = {
  basic_info: "Basic Info",
  work_experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function barColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-400";
}

interface CompletenessCardProps {
  onImportClick: () => void;
}

export function CompletenessCard({ onImportClick }: CompletenessCardProps) {
  const { data, isLoading, isError } = useQuery<CompletenessResponse>({
    queryKey: ["completeness"],
    queryFn: () => profileApi.getCompleteness(),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-2 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (isError || !data) return null;

  const score = Math.round(data.score);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Profile Completeness
          </h3>
          <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}%</span>
        </div>
        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <span>📄</span> Import PDF
        </button>
      </div>

      {/* Overall bar */}
      <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Per-section breakdown */}
      <div className="space-y-2.5">
        {Object.entries(data.sections).map(([key, section]) => {
          const s = Math.round(section.score);
          return (
            <div key={key}>
              <div className="mb-0.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{SECTION_LABELS[key] ?? key}</span>
                <span className={scoreColor(s)}>{s}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(s)}`}
                  style={{ width: `${s}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="mb-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            Suggestions
          </p>
          <ul className="space-y-1">
            {data.suggestions.slice(0, 5).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
