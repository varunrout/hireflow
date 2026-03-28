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

export type ResumeDesign = "classic" | "modern" | "compact";

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

function sectionClass(design: ResumeDesign) {
  switch (design) {
    case "modern":
      return "mb-4 border-l-4 border-blue-600 pl-3";
    case "compact":
      return "mb-3";
    default:
      return "mb-4";
  }
}

function headingClass(design: ResumeDesign) {
  switch (design) {
    case "modern":
      return "mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700";
    case "compact":
      return "mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700";
    default:
      return "mb-2 border-b border-gray-800 pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700";
  }
}

function SectionDivider({ title, design }: { title: string; design: ResumeDesign }) {
  return (
    <div className={sectionClass(design)}>
      <h2 className={headingClass(design)}>{title}</h2>
    </div>
  );
}

function getSection<T extends ResumeSection["type"]>(sections: ResumeSection[], type: T) {
  return sections.find((s): s is Extract<ResumeSection, { type: T }> => s.type === type);
}

function RenderHeader({ s, design }: { s: HeaderSection; design: ResumeDesign }) {
  if (design === "modern") {
    return (
      <div className="mb-6 grid grid-cols-[1fr_220px] gap-6 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{s.full_name}</h1>
          {s.headline && <p className="mt-1 text-base font-medium text-blue-700">{s.headline}</p>}
          {s.location && <p className="mt-2 text-[11px] text-gray-500">{s.location}</p>}
        </div>
        <div className="space-y-1 text-right text-[10.5px] text-gray-600">
          {s.email && <p>{s.email}</p>}
          {s.phone && <p>{s.phone}</p>}
          {s.linkedin_url && <p>{s.linkedin_url}</p>}
          {s.github_url && <p>{s.github_url}</p>}
          {s.website_url && <p>{s.website_url}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-${design === "compact" ? "3" : "4"} text-center`}>
      <h1 className={`${design === "compact" ? "text-xl" : "text-2xl"} font-bold tracking-tight text-gray-900`}>
        {s.full_name}
      </h1>
      {s.headline && <p className="mt-0.5 text-sm font-medium text-gray-600">{s.headline}</p>}
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

function RenderSummary({ s, design }: { s: SummarySection; design: ResumeDesign }) {
  if (!s.content) return null;
  return (
    <div className="resume-section resume-avoid-break">
      <SectionDivider title="Summary" design={design} />
      <p className={`${design === "compact" ? "text-[10px]" : "text-[11px]"} leading-relaxed text-gray-700`}>
        {s.content}
      </p>
    </div>
  );
}

function RenderExperience({ s, design }: { s: ExperienceSection; design: ResumeDesign }) {
  if (!s.items.length) return null;
  return (
    <div className="resume-section">
      <SectionDivider title="Experience" design={design} />
      <div className={design === "compact" ? "space-y-2" : "space-y-3"}>
        {s.items.map((item, i) => (
          <div key={item.id ?? i} className="resume-avoid-break">
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
    </div>
  );
}

function RenderEducation({ s, design }: { s: EducationSection; design: ResumeDesign }) {
  if (!s.items.length) return null;
  return (
    <div className="resume-section resume-avoid-break">
      <SectionDivider title="Education" design={design} />
      <div className="space-y-2.5">
        {s.items.map((item, i) => (
          <div key={item.id ?? i} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold text-gray-900">
                {item.degree}
                {item.field_of_study ? ` in ${item.field_of_study}` : ""}
              </p>
              <p className="text-[11px] text-gray-600">{item.institution}</p>
              {item.gpa != null && <p className="text-[10px] text-gray-400">GPA: {item.gpa}</p>}
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
    </div>
  );
}

function RenderSkills({ s, design }: { s: SkillsSection; design: ResumeDesign }) {
  if (!s.groups.length) return null;
  if (design === "modern") {
    return (
      <div className="resume-section resume-avoid-break">
        <SectionDivider title="Skills" design={design} />
        <div className="flex flex-wrap gap-1.5">
          {s.groups
            .flatMap((g) => g.items.map((item) => ({ category: g.category, item })))
            .map(({ category, item }) => (
              <span
                key={`${category}-${item}`}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700"
              >
                {item}
              </span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="resume-section resume-avoid-break">
      <SectionDivider title="Skills" design={design} />
      <div className="space-y-1">
        {s.groups.map((g) => (
          <div key={g.category} className="flex gap-2 text-[10.5px]">
            <span className="w-20 shrink-0 font-medium capitalize text-gray-700">{g.category}</span>
            <span className="text-gray-600">{g.items.join(" · ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RenderProjects({ s, design }: { s: ProjectsSection; design: ResumeDesign }) {
  if (!s.items.length) return null;
  return (
    <div className="resume-section">
      <SectionDivider title="Projects" design={design} />
      <div className="space-y-2.5">
        {s.items.map((item, i) => (
          <div key={item.id ?? i} className="resume-avoid-break">
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
    </div>
  );
}

function RenderCerts({ s, design }: { s: CertsSection; design: ResumeDesign }) {
  if (!s.items.length) return null;
  return (
    <div className="resume-section resume-avoid-break">
      <SectionDivider title="Certifications" design={design} />
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
    </div>
  );
}

function ModernLayout({ sections }: { sections: ResumeSection[] }) {
  const header = getSection(sections, "header");
  const summary = getSection(sections, "summary");
  const experience = getSection(sections, "experience");
  const education = getSection(sections, "education");
  const skills = getSection(sections, "skills");
  const projects = getSection(sections, "projects");
  const certifications = getSection(sections, "certifications");

  return (
    <div className="mx-auto w-full max-w-[860px] bg-white px-10 py-8 text-gray-900 shadow-lg print:max-w-none print:shadow-none">
      {header && <RenderHeader s={header} design="modern" />}
      <div className="grid grid-cols-[1fr_220px] gap-8">
        <div>
          {summary && <RenderSummary s={summary} design="modern" />}
          {experience && <RenderExperience s={experience} design="modern" />}
          {projects && <RenderProjects s={projects} design="modern" />}
        </div>
        <div>
          {skills && <RenderSkills s={skills} design="modern" />}
          {education && <RenderEducation s={education} design="modern" />}
          {certifications && <RenderCerts s={certifications} design="modern" />}
        </div>
      </div>
    </div>
  );
}

function StandardLayout({ sections, design }: { sections: ResumeSection[]; design: ResumeDesign }) {
  return (
    <div className="mx-auto w-full max-w-[680px] bg-white px-10 py-8 text-gray-900 shadow-lg print:max-w-none print:shadow-none">
      {sections.map((section, i) => {
        switch (section.type) {
          case "header":
            return <RenderHeader key={i} s={section as HeaderSection} design={design} />;
          case "summary":
            return <RenderSummary key={i} s={section as SummarySection} design={design} />;
          case "experience":
            return <RenderExperience key={i} s={section as ExperienceSection} design={design} />;
          case "education":
            return <RenderEducation key={i} s={section as EducationSection} design={design} />;
          case "skills":
            return <RenderSkills key={i} s={section as SkillsSection} design={design} />;
          case "projects":
            return <RenderProjects key={i} s={section as ProjectsSection} design={design} />;
          case "certifications":
            return <RenderCerts key={i} s={section as CertsSection} design={design} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export function CVPreview({
  sections,
  design = "classic",
}: {
  sections: ResumeSection[];
  design?: ResumeDesign;
}) {
  if (!sections.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No content yet. Use &ldquo;Seed from profile&rdquo; or import a PDF to populate.
      </div>
    );
  }

  return (
    <div className="resume-print-root">
      {design === "modern" ? (
        <ModernLayout sections={sections} />
      ) : (
        <StandardLayout sections={sections} design={design} />
      )}
    </div>
  );
}
