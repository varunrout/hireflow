import type {
  ResumeSection,
  HeaderSection,
  SummarySection,
  ExperienceSection,
  EducationSection,
  SkillsSection,
  ProjectsSection,
  CertsSection,
} from "@/lib/resumes-api";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDateRange(start: string, end: string, isCurrent = false) {
  if (!start) return "";
  const fmt = (d: string) => {
    if (!d) return "";
    const [year, month] = d.split("-");
    const m = month
      ? new Date(0, parseInt(month) - 1).toLocaleString("default", { month: "short" })
      : "";
    return m ? `${m} ${year}` : year;
  };
  return isCurrent ? `${fmt(start)} – Present` : `${fmt(start)} – ${fmt(end)}`;
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-2 mt-5 border-b border-gray-800 pb-0.5">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700">{title}</h2>
    </div>
  );
}

// ------------------------------------------------------------------
// Section renderers
// ------------------------------------------------------------------

function RenderHeader({ s }: { s: HeaderSection }) {
  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">{s.full_name}</h1>
      {s.headline && <p className="mt-0.5 text-sm font-medium text-gray-600">{s.headline}</p>}
      {/* Contact row */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 text-[10px] text-gray-500">
        {s.email && <span>{s.email}</span>}
        {s.phone && <span>{s.phone}</span>}
        {s.location && <span>{s.location}</span>}
        {s.linkedin_url && (
          <a href={s.linkedin_url} className="text-blue-600 hover:underline">
            LinkedIn
          </a>
        )}
        {s.github_url && (
          <a href={s.github_url} className="text-blue-600 hover:underline">
            GitHub
          </a>
        )}
        {s.website_url && (
          <a href={s.website_url} className="text-blue-600 hover:underline">
            Portfolio
          </a>
        )}
      </div>
    </div>
  );
}

function RenderSummary({ s }: { s: SummarySection }) {
  if (!s.content) return null;
  return (
    <>
      <SectionDivider title="Summary" />
      <p className="text-[11px] leading-relaxed text-gray-700">{s.content}</p>
    </>
  );
}

function RenderExperience({ s }: { s: ExperienceSection }) {
  if (!s.items.length) return null;
  return (
    <>
      <SectionDivider title="Experience" />
      <div className="space-y-3">
        {s.items.map((item, i) => (
          <div key={item.id ?? i}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[12px] font-semibold text-gray-900">{item.title}</span>
                <span className="mx-1.5 text-[11px] text-gray-400">·</span>
                <span className="text-[11px] text-gray-700">{item.company}</span>
                {item.location && (
                  <span className="text-[10px] text-gray-400">, {item.location}</span>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-gray-400">
                {formatDateRange(item.start_date, item.end_date, item.is_current)}
              </span>
            </div>
            {item.description && (
              <p className="mt-0.5 text-[10.5px] leading-snug text-gray-600">{item.description}</p>
            )}
            {item.achievements.length > 0 && (
              <ul className="mt-1 space-y-0.5 pl-3">
                {item.achievements.map((a, ai) => (
                  <li key={ai} className="list-disc text-[10.5px] leading-snug text-gray-600">
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {item.technologies.length > 0 && (
              <p className="mt-0.5 text-[9.5px] italic text-gray-400">
                {item.technologies.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function RenderEducation({ s }: { s: EducationSection }) {
  if (!s.items.length) return null;
  return (
    <>
      <SectionDivider title="Education" />
      <div className="space-y-2.5">
        {s.items.map((item, i) => (
          <div key={item.id ?? i} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold text-gray-900">
                {item.degree}
                {item.field_of_study ? ` in ${item.field_of_study}` : ""}
              </p>
              <p className="text-[11px] text-gray-600">{item.institution}</p>
              {item.gpa != null && (
                <p className="text-[10px] text-gray-400">GPA: {item.gpa}</p>
              )}
              {item.description && (
                <p className="mt-0.5 text-[10.5px] text-gray-500">{item.description}</p>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-gray-400">
              {formatDateRange(item.start_date, item.end_date)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function RenderSkills({ s }: { s: SkillsSection }) {
  if (!s.groups.length) return null;
  return (
    <>
      <SectionDivider title="Skills" />
      <div className="space-y-1">
        {s.groups.map((g) => (
          <div key={g.category} className="flex gap-2 text-[10.5px]">
            <span className="w-20 shrink-0 font-medium capitalize text-gray-700">{g.category}</span>
            <span className="text-gray-600">{g.items.join(" · ")}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RenderProjects({ s }: { s: ProjectsSection }) {
  if (!s.items.length) return null;
  return (
    <>
      <SectionDivider title="Projects" />
      <div className="space-y-2.5">
        {s.items.map((item, i) => (
          <div key={item.id ?? i}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-gray-900">
                {item.name}
                {(item.url || item.repo_url) && (
                  <a
                    href={item.url || item.repo_url}
                    className="ml-1.5 text-[10px] font-normal text-blue-600 hover:underline"
                  >
                    ↗
                  </a>
                )}
              </p>
              {(item.start_date || item.end_date) && (
                <span className="shrink-0 text-[10px] text-gray-400">
                  {formatDateRange(item.start_date, item.end_date)}
                </span>
              )}
            </div>
            {item.description && (
              <p className="mt-0.5 text-[10.5px] leading-snug text-gray-600">{item.description}</p>
            )}
            {item.technologies.length > 0 && (
              <p className="mt-0.5 text-[9.5px] italic text-gray-400">
                {item.technologies.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function RenderCerts({ s }: { s: CertsSection }) {
  if (!s.items.length) return null;
  return (
    <>
      <SectionDivider title="Certifications" />
      <div className="space-y-1.5">
        {s.items.map((item, i) => (
          <div key={item.id ?? i} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-gray-900">
                {item.name}
                {item.credential_url && (
                  <a
                    href={item.credential_url}
                    className="ml-1.5 text-[10px] font-normal text-blue-600 hover:underline"
                  >
                    Verify ↗
                  </a>
                )}
              </p>
              <p className="text-[10px] text-gray-500">{item.issuer}</p>
            </div>
            {item.issued_date && (
              <span className="shrink-0 text-[10px] text-gray-400">{item.issued_date}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------

export function CVPreview({ sections }: { sections: ResumeSection[] }) {
  if (!sections.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No content yet. Use &ldquo;Seed from profile&rdquo; to populate.
      </div>
    );
  }

  return (
    // A4-ish white paper
    <div className="mx-auto w-full max-w-[680px] bg-white px-10 py-8 text-gray-900 shadow-lg print:shadow-none">
      {sections.map((section, i) => {
        switch (section.type) {
          case "header":
            return <RenderHeader key={i} s={section as HeaderSection} />;
          case "summary":
            return <RenderSummary key={i} s={section as SummarySection} />;
          case "experience":
            return <RenderExperience key={i} s={section as ExperienceSection} />;
          case "education":
            return <RenderEducation key={i} s={section as EducationSection} />;
          case "skills":
            return <RenderSkills key={i} s={section as SkillsSection} />;
          case "projects":
            return <RenderProjects key={i} s={section as ProjectsSection} />;
          case "certifications":
            return <RenderCerts key={i} s={section as CertsSection} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
