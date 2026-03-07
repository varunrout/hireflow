import { registerPrompt } from "./registry";

export const RESUME_TAILOR_PROMPT_ID = "resume.tailor.v1";
export const RESUME_SUMMARY_PROMPT_ID = "resume.summary.v1";

registerPrompt({
  id: RESUME_TAILOR_PROMPT_ID,
  version: "1.0.0",
  name: "Resume Tailoring",
  description: "Tailors a resume to match a specific job description",
  model: "gpt-4o",
  variables: ["profile_json", "job_description", "job_title", "company"],
  system: `You are an expert resume writer and career coach. Your task is to tailor a candidate's resume 
to match a specific job description.

RULES:
- Never invent or fabricate experience, skills, or achievements
- Only reorder, reword, and emphasize existing verified data
- Highlight skills and experiences most relevant to the job
- Use keywords from the job description naturally
- Keep content truthful and professional
- Output must be valid JSON matching the provided schema`,
  user: `Tailor the following candidate profile for the job:

Job Title: {{job_title}}
Company: {{company}}

Job Description:
{{job_description}}

Candidate Profile:
{{profile_json}}

Return a JSON object with these fields:
- summary: tailored professional summary (max 300 words)
- highlighted_experiences: array of experience IDs to emphasize, in priority order
- highlighted_skills: array of skill names most relevant to this role
- suggested_section_order: array of section types in recommended order
- tailoring_notes: brief explanation of changes made`,
});

registerPrompt({
  id: RESUME_SUMMARY_PROMPT_ID,
  version: "1.0.0",
  name: "Resume Summary Generation",
  description: "Generates a professional summary from candidate profile",
  model: "gpt-4o-mini",
  variables: ["profile_json", "target_role"],
  system: `You are an expert resume writer. Generate a concise, impactful professional summary.
  
RULES:
- Maximum 3 sentences, 60-100 words
- Start with years of experience and key expertise
- Include 2-3 top differentiating skills or achievements
- End with career goal aligned to target role
- No generic clichés ("passionate", "team player", "self-motivated")
- Output plain text only`,
  user: `Generate a professional summary for this candidate targeting a {{target_role}} role:

{{profile_json}}`,
});
