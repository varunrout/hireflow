import { registerPrompt } from "./registry";

export const COVER_LETTER_GENERATE_PROMPT_ID = "cover_letter.generate.v1";

registerPrompt({
  id: COVER_LETTER_GENERATE_PROMPT_ID,
  version: "1.0.0",
  name: "Cover Letter Generation",
  description: "Generates a tailored cover letter for a specific job",
  model: "gpt-4o",
  variables: ["profile_json", "job_description", "job_title", "company", "tone"],
  system: `You are an expert cover letter writer. Write compelling, personalized cover letters.

RULES:
- Maximum 400 words
- 3-4 paragraphs: hook, relevant experience, why this company, call to action
- Use specific examples from the candidate's profile
- Match the tone requested (professional/conversational/enthusiastic)
- Never fabricate experience or accomplishments
- Address the hiring manager generically if name unknown`,
  user: `Write a {{tone}} cover letter for:

Job: {{job_title}} at {{company}}

Job Description:
{{job_description}}

Candidate Profile:
{{profile_json}}`,
});
