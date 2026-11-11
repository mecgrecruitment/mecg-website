import type { Benefit } from "./catalog";

export type BenefitFilters = {
  query: string;
  category: string;
  freeOnly: boolean;
  studentOnly: boolean;
};

export function filterBenefits(items: readonly Benefit[], filters: BenefitFilters): Benefit[] {
  const words = filters.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.freeOnly && !item.freeAccess) return false;
    if (filters.studentOnly && !item.studentBenefit) return false;
    const text = `${item.name} ${item.category} ${item.description} ${item.terms} ${item.cost}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
