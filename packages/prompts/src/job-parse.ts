import { registerPrompt } from "./registry";

export const JOB_PARSE_PROMPT_ID = "job.parse.v1";

registerPrompt({
  id: JOB_PARSE_PROMPT_ID,
  version: "1.0.0",
  name: "Job Description Parser",
  description: "Extracts structured data from a job description",
  model: "gpt-4o-mini",
  variables: ["job_description"],
  system: `You are an expert at parsing job descriptions. Extract structured information accurately.
  
Output must be valid JSON matching exactly this schema:
{
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "required_experience_years": number | null,
  "required_education": "string" | null,
  "keywords": ["string"],
  "responsibilities": ["string"],
  "benefits": ["string"]
}`,
  user: `Parse this job description and extract structured data:

{{job_description}}`,
});
