"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CVPreview } from "@/components/resumes/CVPreview";
import {
  resumesApi,
  type ResumeSection,
  type ResumeWithSections,
  type ExperienceSection,
  type ProjectsSection,
  type SummarySection,
  type SkillsSection,
} from "@/lib/resumes-api";

interface ResumeEditorModalProps {
  isOpen: boolean;
  resumeId: string | null;
  personaName?: string | null;
  onClose: () => void;
}

function stringifySection(section: ResumeSection): string {
  switch (section.type) {
    case "summary":
      return section.content || "";
    case "experience":
      return section.items
        .map((x) => `${x.title} at ${x.company}\n${x.description}\n${x.achievements.join("\n")}`)
        .join("\n\n");
    case "projects":
      return section.items.map((x) => `${x.name}\n${x.description}`).join("\n\n");
    case "skills":
      return section.groups.map((g) => `${g.category}: ${g.items.join(", ")}`).join("\n");
    case "education":
      return section.items.map((x) => `${x.degree} - ${x.institution}`).join("\n");
    case "certifications":
      return section.items.map((x) => `${x.name} - ${x.issuer}`).join("\n");
    case "header":
      return [section.full_name, section.headline, section.email, section.phone].filter(Boolean).join("\n");
    default:
      return "";
  }
}

function applyAiImprovement(section: ResumeSection, improved: string): ResumeSection {
  if (section.type === "summary") {
    return { ...(section as SummarySection), content: improved };
  }

  if (section.type === "experience") {
    const s = section as ExperienceSection;
    if (!s.items.length) return section;
    const updated = [...s.items];
    const first = updated[0]!;
    updated[0] = {
      ...(first.id ? { id: first.id } : {}),
      company: first.company,
      title: first.title,
      location: first.location,
      start_date: first.start_date,
      end_date: first.end_date,
      is_current: first.is_current,
      description: improved,
      achievements: first.achievements,
      technologies: first.technologies,
    };
    return { ...s, items: updated };
  }

  if (section.type === "projects") {
    const s = section as ProjectsSection;
    if (!s.items.length) return section;
    const updated = [...s.items];
    const first = updated[0]!;
    updated[0] = {
      ...(first.id ? { id: first.id } : {}),
      name: first.name,
      description: improved,
      url: first.url,
      repo_url: first.repo_url,
      technologies: first.technologies,
      start_date: first.start_date,
      end_date: first.end_date,
    };
    return { ...s, items: updated };
  }

  if (section.type === "skills") {
    const s = section as SkillsSection;
    const lines = improved
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return section;
    const groups = lines.map((line) => {
      const [cat, rest] = line.split(":");
      return {
        category: (cat || "skills").trim(),
        items: (rest || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
    });
    return { ...s, groups };
  }

  return section;
}

export function ResumeEditorModal({ isOpen, resumeId, personaName, onClose }: ResumeEditorModalProps) {
  const queryClient = useQueryClient();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [instruction, setInstruction] = useState(
    "Make this more impactful and ATS-friendly while keeping it concise."
  );
  const [jobDescription, setJobDescription] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [editMode, setEditMode] = useState<"guided" | "json">("guided");
  const [localSections, setLocalSections] = useState<ResumeSection[] | null>(null);

  const resumeQuery = useQuery({
    queryKey: ["resume", resumeId],
    queryFn: () => resumesApi.get(resumeId!),
    enabled: isOpen && !!resumeId,
  });

  const effectiveSections = localSections ?? (resumeQuery.data?.sections as ResumeSection[] | undefined) ?? [];

  const selectedSection = useMemo(
    () => effectiveSections[selectedIndex],
    [effectiveSections, selectedIndex]
  );

  const seedMutation = useMutation({
    mutationFn: () => resumesApi.seedFromProfile(resumeId!),
    onSuccess: (updated) => {
      setLocalSections(updated.sections);
      setSelectedIndex(0);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      queryClient.invalidateQueries({ queryKey: ["resume", resumeId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (sections: ResumeSection[]) => resumesApi.saveSections(resumeId!, sections),
    onSuccess: (updated) => {
      setLocalSections(updated.sections);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      queryClient.invalidateQueries({ queryKey: ["resume", resumeId] });
    },
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSection) return { improved: "" };
      return resumesApi.aiEdit(resumeId!, {
        section_type: selectedSection.type,
        content: stringifySection(selectedSection),
        instruction,
        job_description: jobDescription || null,
        persona_name: personaName || null,
      });
    },
    onSuccess: (result) => {
      if (!selectedSection || !result.improved) return;
      const next = [...effectiveSections];
      next[selectedIndex] = applyAiImprovement(selectedSection, result.improved);
      setLocalSections(next);
    },
  });

  function resetStateFromServer(data?: ResumeWithSections) {
    const sections = (data?.sections ?? []) as ResumeSection[];
    setLocalSections(sections);
    setRawJson(JSON.stringify(sections, null, 2));
    setSelectedIndex(0);
  }

  function handleOpenSync() {
    if (resumeQuery.data) {
      resetStateFromServer(resumeQuery.data as ResumeWithSections);
    }
  }

  function handleClose() {
    setLocalSections(null);
    setRawJson("");
    setSelectedIndex(0);
    setJobDescription("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className="absolute inset-4 flex flex-col rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold">Resume Editor</h2>
            <p className="text-xs text-muted-foreground">
              Click sections to edit, then use AI to improve wording like a real CV editor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending || !resumeId}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {seedMutation.isPending ? "Seeding..." : "Seed from profile"}
            </button>
            <button
              onClick={() => saveMutation.mutate(effectiveSections)}
              disabled={saveMutation.isPending || !effectiveSections.length}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={handleClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_380px]" onMouseEnter={handleOpenSync}>
          {/* Left: section navigator */}
          <aside className="overflow-y-auto border-r p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sections
            </p>
            <div className="space-y-1">
              {effectiveSections.map((s, i) => (
                <button
                  key={`${s.type}-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="font-medium capitalize">{s.type}</span>
                </button>
              ))}
              {!effectiveSections.length && (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Empty resume. Click <strong>Seed from profile</strong>.
                </div>
              )}
            </div>

            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Edit Mode
              </p>
              <div className="flex gap-1 rounded-lg border p-1">
                <button
                  onClick={() => setEditMode("guided")}
                  className={`flex-1 rounded-md px-2 py-1 text-xs ${
                    editMode === "guided" ? "bg-blue-600 text-white" : "hover:bg-accent"
                  }`}
                >
                  Guided
                </button>
                <button
                  onClick={() => {
                    setRawJson(JSON.stringify(effectiveSections, null, 2));
                    setEditMode("json");
                  }}
                  className={`flex-1 rounded-md px-2 py-1 text-xs ${
                    editMode === "json" ? "bg-blue-600 text-white" : "hover:bg-accent"
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>
          </aside>

          {/* Center: preview */}
          <main className="overflow-auto bg-gray-100 p-4 dark:bg-gray-950">
            {resumeQuery.isLoading && (
              <div className="mx-auto h-[80vh] max-w-[680px] animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            )}
            {resumeQuery.isError && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load resume.
              </div>
            )}
            {!resumeQuery.isLoading && !resumeQuery.isError && (
              <CVPreview sections={effectiveSections} />
            )}
          </main>

          {/* Right: editor + AI */}
          <aside className="overflow-y-auto border-l p-4">
            <h3 className="mb-2 text-sm font-semibold">Editor</h3>

            {editMode === "guided" ? (
              <div className="space-y-3">
                {selectedSection ? (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
                      Editing section: <strong className="capitalize">{selectedSection.type}</strong>
                    </div>
                    <textarea
                      value={stringifySection(selectedSection)}
                      onChange={(e) => {
                        const next = [...effectiveSections];
                        next[selectedIndex] = applyAiImprovement(selectedSection, e.target.value);
                        setLocalSections(next);
                      }}
                      className="h-40 w-full rounded-lg border bg-background p-3 text-sm"
                      placeholder="Edit content..."
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Select a section from the left.
                  </div>
                )}

                <div className="mt-4 border-t pt-4">
                  <h4 className="mb-2 text-sm font-semibold">AI Assist</h4>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    className="h-20 w-full rounded-lg border bg-background p-2 text-sm"
                    placeholder="Instruction for AI..."
                  />
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="mt-2 h-24 w-full rounded-lg border bg-background p-2 text-sm"
                    placeholder="Optional job description for tailoring..."
                  />
                  <button
                    onClick={() => aiMutation.mutate()}
                    disabled={aiMutation.isPending || !selectedSection}
                    className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {aiMutation.isPending ? "AI rewriting..." : "Improve with AI"}
                  </button>
                  {aiMutation.isError && (
                    <p className="mt-1 text-xs text-destructive">
                      AI edit failed. Check API key / try a shorter prompt.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="h-[60vh] w-full rounded-lg border bg-background p-2 font-mono text-xs"
                />
                <button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(rawJson) as ResumeSection[];
                      setLocalSections(parsed);
                    } catch {
                      // noop, quick MVP behavior
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                >
                  Apply JSON
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
