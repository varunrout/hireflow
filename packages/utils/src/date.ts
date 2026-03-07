export function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseYearMonth(ym: string): Date {
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) throw new Error(`Invalid year-month: ${ym}`);
  return new Date(year, month - 1, 1);
}

export function monthDiff(startYM: string, endYM: string): number {
  const start = parseYearMonth(startYM);
  const end = parseYearMonth(endYM);
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export function toISOString(date: Date): string {
  return date.toISOString();
}
