export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateId(prefix?: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`;
}
