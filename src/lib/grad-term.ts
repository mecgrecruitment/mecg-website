export const GRAD_TERMS = ["Winter", "Spring", "Summer", "Fall"] as const;
export type GradTermName = (typeof GRAD_TERMS)[number];
export type GradTerm = { term: GradTermName; year: number };

export const GRAD_YEAR_SPAN = 6;

export function formatGradTerm({ term, year }: GradTerm) {
  return `${term} ${year}`;
}

export function parseGradTerm(value: string): GradTerm | null {
  const match = /^\s*([a-z]+)\s+(\d{4})\s*$/i.exec(value);
  if (!match) return null;
  const term = GRAD_TERMS.find((candidate) => candidate.toLowerCase() === match[1]!.toLowerCase());
  return term ? { term, year: Number(match[2]) } : null;
}

// Computed once on the server and passed down, so server and client render the
// same year list even across midnight on New Year's Eve.
export function gradTermBaseYear(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", year: "numeric" }).format(now));
}

export function gradYearOptions(baseYear: number, selected: number | null) {
  const years = Array.from({ length: GRAD_YEAR_SPAN + 1 }, (_, index) => baseYear + index);
  if (selected !== null && !years.includes(selected)) years.push(selected);
  return years.sort((left, right) => left - right);
}

// Both picked saves the term, both blank clears it, and one of each keeps the
// saved value so resetting a single select never wipes it unasked.
export function gradTermFromSelection(term: GradTermName | "", year: string, current: string) {
  if (term && year) return { value: formatGradTerm({ term, year: Number(year) }), partial: false };
  if (!term && !year) return { value: "", partial: false };
  return { value: current, partial: true };
}
