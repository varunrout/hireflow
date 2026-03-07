export interface PromptTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  system: string;
  user: string;
  variables: string[];
  model: string;
}

export const PROMPT_REGISTRY: Record<string, PromptTemplate> = {};

export function registerPrompt(template: PromptTemplate): void {
  PROMPT_REGISTRY[template.id] = template;
}

export function getPrompt(id: string): PromptTemplate {
  const template = PROMPT_REGISTRY[id];
  if (!template) {
    throw new Error(`Prompt template not found: ${id}`);
  }
  return template;
}

export function renderPrompt(
  template: PromptTemplate,
  variables: Record<string, string>
): { system: string; user: string } {
  let system = template.system;
  let user = template.user;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    system = system.replaceAll(placeholder, value);
    user = user.replaceAll(placeholder, value);
  }
  return { system, user };
}
