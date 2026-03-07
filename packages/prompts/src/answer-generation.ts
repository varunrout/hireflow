import { registerPrompt } from "./registry";

export const ANSWER_GENERATE_PROMPT_ID = "answer.generate.v1";

registerPrompt({
  id: ANSWER_GENERATE_PROMPT_ID,
  version: "1.0.0",
  name: "Screening Answer Generation",
  description: "Generates answers to job application screening questions",
  model: "gpt-4o",
  variables: ["question", "profile_json", "job_title", "company"],
  system: `You are an expert career coach helping candidates answer job application questions.

RULES:
- Use STAR method (Situation, Task, Action, Result) for behavioral questions
- Be specific and use real examples from the candidate profile
- Maximum 200 words per answer
- Never fabricate experiences
- Be honest about gaps, frame positively
- Match professional tone`,
  user: `Answer this screening question for a {{job_title}} role at {{company}}:

Question: {{question}}

Candidate Profile:
{{profile_json}}`,
});
