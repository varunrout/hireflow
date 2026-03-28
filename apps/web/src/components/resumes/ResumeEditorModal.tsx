"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CVPreview, type ResumeDesign } from "@/components/resumes/CVPreview";
import {
  resumesApi,
  type ResumeSection,
  type ResumeWithSections,
  type HeaderSection,
  type SummarySection,
  type ExperienceSection,
  type ExperienceItem,
  type EducationSection,
  type EducationItem,
  type SkillsSection,
  type SkillGroup,
  type ProjectsSection,
  type ProjectItem,
  type CertsSection,
  type CertItem,
} from "@/lib/resumes-api";

interface ResumeEditorModalProps {
  isOpen: boolean;
  resumeId: string | null;
  personaName?: string | null;
  onClose: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
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

function updateAt<T>(arr: T[], index: number, value: T) {
  const next = [...arr];
  next[index] = value;
  return next;
}

function moveItem<T>(arr: T[], index: number, direction: -1 | 1) {
  const next = [...arr];
  const target = index + direction;
  if (target < 0 || target >= arr.length) return arr;
  const tmp = next[index]!;
  next[index] = next[target]!;
  next[target] = tmp;
  return next;
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
  const [design, setDesign] = useState<ResumeDesign>("classic");
  const [localSections, setLocalSections] = useState<ResumeSection[] | null>(null);

  const resumeQuery = useQuery({
    queryKey: ["resume", resumeId],
    queryFn: () => resumesApi.get(resumeId!),
    enabled: isOpen && !!resumeId,
  });

  const effectiveSections = localSections ?? (resumeQuery.data?.sections as ResumeSection[] | undefined) ?? [];

  const selectedSection = useMemo(() => effectiveSections[selectedIndex], [effectiveSections, selectedIndex]);

  useEffect(() => {
    if (!isOpen || !resumeQuery.data) return;
    const sections = (resumeQuery.data.sections ?? []) as ResumeSection[];
    setLocalSections(sections);
    setRawJson(JSON.stringify(sections, null, 2));
    const savedDesign = (resumeQuery.data.theme_overrides as { design?: ResumeDesign } | null | undefined)?.design;
    setDesign(savedDesign ?? "classic");
  }, [isOpen, resumeQuery.data]);

  const seedMutation = useMutation({
    mutationFn: () => resumesApi.seedFromProfile(resumeId!),
    onSuccess: (updated) => {
      setLocalSections(updated.sections);
      setRawJson(JSON.stringify(updated.sections, null, 2));
      setSelectedIndex(0);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      queryClient.invalidateQueries({ queryKey: ["resume", resumeId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (sections: ResumeSection[]) =>
      resumesApi.update(resumeId!, {
        name: resumeQuery.data?.name ?? "Resume",
        format: (resumeQuery.data?.format as "ats" | "designed" | "tailored") ?? "ats",
        template_id: resumeQuery.data?.template_id ?? null,
        job_posting_id: resumeQuery.data?.job_posting_id ?? null,
        persona_id: resumeQuery.data?.persona_id ?? null,
        sections: sections,
        theme_overrides: {
          ...((resumeQuery.data?.theme_overrides as Record<string, unknown> | null | undefined) ?? {}),
          design,
        },
      }),
    onSuccess: (updated) => {
      const nextSections = updated.sections as unknown as ResumeSection[];
      setLocalSections(nextSections);
      setRawJson(JSON.stringify(nextSections, null, 2));
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
      setRawJson(JSON.stringify(next, null, 2));
    },
  });

  function handleClose() {
    setLocalSections(null);
    setRawJson("");
    setSelectedIndex(0);
    setJobDescription("");
    setEditMode("guided");
    onClose();
  }

  function commitSections(next: ResumeSection[]) {
    setLocalSections(next);
    setRawJson(JSON.stringify(next, null, 2));
  }

  function updateSection(index: number, section: ResumeSection) {
    commitSections(updateAt(effectiveSections, index, section));
  }

  function printResume() {
    const el = document.querySelector(".resume-print-root");
    if (!el) return;

    const printWin = window.open("", "_blank", "width=900,height=1200");
    if (!printWin) return;

    const doc = printWin.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head><meta charset='utf-8'><title>Resume</title></head><body></body></html>");
    doc.close();

    // 1. Copy all <link rel="stylesheet"> with absolute href
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const el = doc.createElement("link");
      el.rel = "stylesheet";
      el.href = (link as HTMLLinkElement).href; // .href is always absolute
      doc.head.appendChild(el);
    });

    // 2. Inline all readable CSS rules (handles <style> tags and same-origin sheets)
    const inlineStyle = doc.createElement("style");
    const cssChunks: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (rules) {
          for (let i = 0; i < rules.length; i++) {
            cssChunks.push(rules[i]!.cssText);
          }
        }
      } catch {
        // Cross-origin — already handled by the <link> copy above
      }
    }
    inlineStyle.textContent = cssChunks.join("\n");
    doc.head.appendChild(inlineStyle);

    // 3. Print-specific overrides
    const printStyle = doc.createElement("style");
    printStyle.textContent = [
      "@page { margin: 0.4in 0.5in; size: letter; }",
      "html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
      "h1, h2, h3 { break-after: avoid; page-break-after: avoid; }",
      "li, .resume-avoid-break { break-inside: avoid; page-break-inside: avoid; }",
      ".resume-section { break-inside: auto; page-break-inside: auto; }",
      "p { orphans: 3; widows: 3; }",
      ".resume-page-break { break-before: always; page-break-before: always; }",
    ].join("\n");
    doc.head.appendChild(printStyle);

    // 4. Inject the resume HTML
    doc.body.innerHTML = el.outerHTML;

    // 5. Wait for external stylesheets to load, then print
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    let loaded = 0;
    const total = links.length;

    const tryPrint = () => {
      loaded++;
      if (loaded >= total) {
        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 200);
      }
    };

    if (total === 0) {
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 200);
    } else {
      links.forEach((link) => {
        link.addEventListener("load", tryPrint);
        link.addEventListener("error", tryPrint);
      });
      // Fallback in case events don't fire
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 3000);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60">

      <div className="absolute inset-4 flex flex-col rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3 print:hidden">
          <div>
            <h2 className="text-lg font-semibold">Resume Editor</h2>
            <p className="text-xs text-muted-foreground">
              Field-level editing, AI improvement, multiple designs, save and print.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={design}
              onChange={(e) => setDesign(e.target.value as ResumeDesign)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              title="Resume design"
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="compact">Compact</option>
            </select>
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
            <button
              onClick={printResume}
              disabled={!effectiveSections.length}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Print
            </button>
            <button onClick={handleClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_420px] print:block">
          <aside className="overflow-y-auto border-r p-3 print:hidden">
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
              <CVPreview sections={effectiveSections} design={design} />
            )}
          </main>

          <aside className="overflow-y-auto border-l p-4 print:hidden">
            <h3 className="mb-2 text-sm font-semibold">Editor</h3>

            {editMode === "guided" ? (
              <div className="space-y-4">
                {selectedSection ? (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
                      Editing section: <strong className="capitalize">{selectedSection.type}</strong>
                    </div>

                    {selectedSection.type === "header" && (
                      <HeaderEditor
                        section={selectedSection as HeaderSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "summary" && (
                      <SummaryEditor
                        section={selectedSection as SummarySection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "experience" && (
                      <ExperienceEditor
                        section={selectedSection as ExperienceSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "education" && (
                      <EducationEditor
                        section={selectedSection as EducationSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "skills" && (
                      <SkillsEditor
                        section={selectedSection as SkillsSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "projects" && (
                      <ProjectsEditor
                        section={selectedSection as ProjectsSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}

                    {selectedSection.type === "certifications" && (
                      <CertsEditor
                        section={selectedSection as CertsSection}
                        onChange={(next) => updateSection(selectedIndex, next)}
                      />
                    )}
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
                      AI edit failed. Check API key or try a shorter prompt.
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
                      commitSections(parsed);
                    } catch {
                      // noop
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[88px] w-full rounded-lg border bg-background p-2 text-sm"
        />
      ) : (
        <input
          type={type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        />
      )}
    </label>
  );
}

function Toolbar({
  onAdd,
  onUp,
  onDown,
  onRemove,
  disableUp,
  disableDown,
}: {
  onAdd?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onAdd && <button onClick={onAdd} className="rounded border px-2 py-1 text-xs hover:bg-accent">+ Add</button>}
      {onUp && (
        <button onClick={onUp} disabled={disableUp} className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50">↑</button>
      )}
      {onDown && (
        <button onClick={onDown} disabled={disableDown} className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50">↓</button>
      )}
      {onRemove && <button onClick={onRemove} className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>}
    </div>
  );
}

function HeaderEditor({ section, onChange }: { section: HeaderSection; onChange: (next: HeaderSection) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Full name" value={section.full_name} onChange={(v) => onChange({ ...section, full_name: v })} />
      <Field label="Headline" value={section.headline} onChange={(v) => onChange({ ...section, headline: v })} />
      <Field label="Email" value={section.email} onChange={(v) => onChange({ ...section, email: v })} />
      <Field label="Phone" value={section.phone} onChange={(v) => onChange({ ...section, phone: v })} />
      <Field label="Location" value={section.location} onChange={(v) => onChange({ ...section, location: v })} />
      <Field label="Website" value={section.website_url} onChange={(v) => onChange({ ...section, website_url: v })} />
      <Field label="LinkedIn" value={section.linkedin_url} onChange={(v) => onChange({ ...section, linkedin_url: v })} />
      <Field label="GitHub" value={section.github_url} onChange={(v) => onChange({ ...section, github_url: v })} />
    </div>
  );
}

function SummaryEditor({ section, onChange }: { section: SummarySection; onChange: (next: SummarySection) => void }) {
  return <Field label="Professional summary" value={section.content} onChange={(v) => onChange({ ...section, content: v })} multiline />;
}

function ExperienceEditor({ section, onChange }: { section: ExperienceSection; onChange: (next: ExperienceSection) => void }) {
  function updateItem(index: number, item: ExperienceItem) {
    onChange({ ...section, items: updateAt(section.items, index, item) });
  }
  function addItem() {
    onChange({
      ...section,
      items: [
        ...section.items,
        {
          id: uid(),
          company: "",
          title: "",
          location: "",
          start_date: "",
          end_date: "",
          is_current: false,
          description: "",
          achievements: [],
          technologies: [],
        },
      ],
    });
  }
  return (
    <div className="space-y-4">
      <Toolbar onAdd={addItem} />
      {section.items.map((item, index) => (
        <div key={item.id ?? index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Experience #{index + 1}</p>
            <Toolbar
              onUp={() => onChange({ ...section, items: moveItem(section.items, index, -1) })}
              onDown={() => onChange({ ...section, items: moveItem(section.items, index, 1) })}
              onRemove={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}
              disableUp={index === 0}
              disableDown={index === section.items.length - 1}
            />
          </div>
          <Field label="Job title" value={item.title} onChange={(v) => updateItem(index, { ...item, title: v })} />
          <Field label="Company" value={item.company} onChange={(v) => updateItem(index, { ...item, company: v })} />
          <Field label="Location" value={item.location} onChange={(v) => updateItem(index, { ...item, location: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" value={item.start_date} onChange={(v) => updateItem(index, { ...item, start_date: v })} placeholder="2022-01" />
            <Field label="End date" value={item.end_date} onChange={(v) => updateItem(index, { ...item, end_date: v })} placeholder="2024-02" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={item.is_current} onChange={(e) => updateItem(index, { ...item, is_current: e.target.checked })} />
            Current role
          </label>
          <Field label="Role summary" value={item.description} onChange={(v) => updateItem(index, { ...item, description: v })} multiline />
          <ListEditor
            label="Achievements"
            items={item.achievements}
            onChange={(next) => updateItem(index, { ...item, achievements: next })}
            placeholder="Improved retention by 18% through..."
          />
          <TokenEditor
            label="Technologies"
            items={item.technologies}
            onChange={(next) => updateItem(index, { ...item, technologies: next })}
          />
        </div>
      ))}
    </div>
  );
}

function EducationEditor({ section, onChange }: { section: EducationSection; onChange: (next: EducationSection) => void }) {
  function updateItem(index: number, item: EducationItem) {
    onChange({ ...section, items: updateAt(section.items, index, item) });
  }
  return (
    <div className="space-y-4">
      <Toolbar
        onAdd={() =>
          onChange({
            ...section,
            items: [
              ...section.items,
              {
                id: uid(),
                institution: "",
                degree: "",
                field_of_study: "",
                start_date: "",
                end_date: "",
                gpa: null,
                description: "",
              },
            ],
          })
        }
      />
      {section.items.map((item, index) => (
        <div key={item.id ?? index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Education #{index + 1}</p>
            <Toolbar
              onUp={() => onChange({ ...section, items: moveItem(section.items, index, -1) })}
              onDown={() => onChange({ ...section, items: moveItem(section.items, index, 1) })}
              onRemove={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}
              disableUp={index === 0}
              disableDown={index === section.items.length - 1}
            />
          </div>
          <Field label="Institution" value={item.institution} onChange={(v) => updateItem(index, { ...item, institution: v })} />
          <Field label="Degree" value={item.degree} onChange={(v) => updateItem(index, { ...item, degree: v })} />
          <Field label="Field of study" value={item.field_of_study} onChange={(v) => updateItem(index, { ...item, field_of_study: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" value={item.start_date} onChange={(v) => updateItem(index, { ...item, start_date: v })} />
            <Field label="End date" value={item.end_date} onChange={(v) => updateItem(index, { ...item, end_date: v })} />
          </div>
          <Field
            label="GPA"
            value={item.gpa ?? ""}
            onChange={(v) => updateItem(index, { ...item, gpa: v ? Number(v) : null })}
            type="number"
          />
          <Field label="Description" value={item.description} onChange={(v) => updateItem(index, { ...item, description: v })} multiline />
        </div>
      ))}
    </div>
  );
}

function SkillsEditor({ section, onChange }: { section: SkillsSection; onChange: (next: SkillsSection) => void }) {
  function updateGroup(index: number, group: SkillGroup) {
    onChange({ ...section, groups: updateAt(section.groups, index, group) });
  }
  return (
    <div className="space-y-4">
      <Toolbar
        onAdd={() => onChange({ ...section, groups: [...section.groups, { category: "Skills", items: [] }] })}
      />
      {section.groups.map((group, index) => (
        <div key={`${group.category}-${index}`} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <Field label="Category" value={group.category} onChange={(v) => updateGroup(index, { ...group, category: v })} />
            <Toolbar
              onUp={() => onChange({ ...section, groups: moveItem(section.groups, index, -1) })}
              onDown={() => onChange({ ...section, groups: moveItem(section.groups, index, 1) })}
              onRemove={() => onChange({ ...section, groups: section.groups.filter((_, i) => i !== index) })}
              disableUp={index === 0}
              disableDown={index === section.groups.length - 1}
            />
          </div>
          <TokenEditor label="Skills" items={group.items} onChange={(next) => updateGroup(index, { ...group, items: next })} />
        </div>
      ))}
    </div>
  );
}

function ProjectsEditor({ section, onChange }: { section: ProjectsSection; onChange: (next: ProjectsSection) => void }) {
  function updateItem(index: number, item: ProjectItem) {
    onChange({ ...section, items: updateAt(section.items, index, item) });
  }
  return (
    <div className="space-y-4">
      <Toolbar
        onAdd={() =>
          onChange({
            ...section,
            items: [
              ...section.items,
              {
                id: uid(),
                name: "",
                description: "",
                url: "",
                repo_url: "",
                technologies: [],
                start_date: "",
                end_date: "",
              },
            ],
          })
        }
      />
      {section.items.map((item, index) => (
        <div key={item.id ?? index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Project #{index + 1}</p>
            <Toolbar
              onUp={() => onChange({ ...section, items: moveItem(section.items, index, -1) })}
              onDown={() => onChange({ ...section, items: moveItem(section.items, index, 1) })}
              onRemove={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}
              disableUp={index === 0}
              disableDown={index === section.items.length - 1}
            />
          </div>
          <Field label="Project name" value={item.name} onChange={(v) => updateItem(index, { ...item, name: v })} />
          <Field label="Description" value={item.description} onChange={(v) => updateItem(index, { ...item, description: v })} multiline />
          <Field label="Project URL" value={item.url} onChange={(v) => updateItem(index, { ...item, url: v })} />
          <Field label="Repository URL" value={item.repo_url} onChange={(v) => updateItem(index, { ...item, repo_url: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" value={item.start_date} onChange={(v) => updateItem(index, { ...item, start_date: v })} />
            <Field label="End date" value={item.end_date} onChange={(v) => updateItem(index, { ...item, end_date: v })} />
          </div>
          <TokenEditor label="Technologies" items={item.technologies} onChange={(next) => updateItem(index, { ...item, technologies: next })} />
        </div>
      ))}
    </div>
  );
}

function CertsEditor({ section, onChange }: { section: CertsSection; onChange: (next: CertsSection) => void }) {
  function updateItem(index: number, item: CertItem) {
    onChange({ ...section, items: updateAt(section.items, index, item) });
  }
  return (
    <div className="space-y-4">
      <Toolbar
        onAdd={() =>
          onChange({
            ...section,
            items: [
              ...section.items,
              {
                id: uid(),
                name: "",
                issuer: "",
                issued_date: "",
                expiry_date: "",
                credential_url: "",
              },
            ],
          })
        }
      />
      {section.items.map((item, index) => (
        <div key={item.id ?? index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Certification #{index + 1}</p>
            <Toolbar
              onUp={() => onChange({ ...section, items: moveItem(section.items, index, -1) })}
              onDown={() => onChange({ ...section, items: moveItem(section.items, index, 1) })}
              onRemove={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}
              disableUp={index === 0}
              disableDown={index === section.items.length - 1}
            />
          </div>
          <Field label="Certification name" value={item.name} onChange={(v) => updateItem(index, { ...item, name: v })} />
          <Field label="Issuer" value={item.issuer} onChange={(v) => updateItem(index, { ...item, issuer: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued date" value={item.issued_date} onChange={(v) => updateItem(index, { ...item, issued_date: v })} />
            <Field label="Expiry date" value={item.expiry_date} onChange={(v) => updateItem(index, { ...item, expiry_date: v })} />
          </div>
          <Field label="Credential URL" value={item.credential_url} onChange={(v) => updateItem(index, { ...item, credential_url: v })} />
        </div>
      ))}
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button onClick={() => onChange([...items, ""])} className="rounded border px-2 py-1 text-xs hover:bg-accent">
          + Add bullet
        </button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-2">
          <textarea
            value={item}
            onChange={(e) => onChange(updateAt(items, index, e.target.value))}
            placeholder={placeholder}
            className="min-h-[72px] w-full rounded-md border bg-background p-2 text-sm"
          />
          <Toolbar
            onUp={() => onChange(moveItem(items, index, -1))}
            onDown={() => onChange(moveItem(items, index, 1))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
            disableUp={index === 0}
            disableDown={index === items.length - 1}
          />
        </div>
      ))}
    </div>
  );
}

function TokenEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add item and press enter"
          className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const value = draft.trim();
              if (!value) return;
              onChange([...items, value]);
              setDraft("");
            }
          }}
        />
        <button
          onClick={() => {
            const value = draft.trim();
            if (!value) return;
            onChange([...items, value]);
            setDraft("");
          }}
          className="rounded border px-3 text-sm hover:bg-accent"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
            {item}
            <button onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
