export type ScreeningResult = {
  code: string;
  applicantName: string;
  recommendation: string;
  score: number;
  evidence: string;
};

export function groupScreeningResults(results: ScreeningResult[]) {
  const groups = new Map<string, { code: string; applicantName: string; reviews: ScreeningResult[] }>();
  for (const result of results) {
    const key = `${result.code}\u0000${result.applicantName}`;
    const group = groups.get(key) ?? { code: result.code, applicantName: result.applicantName, reviews: [] };
    group.reviews.push(result);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const seenKeys = new Map<string, number>();
    const reviews = group.reviews.map((review) => {
      const fingerprint = `${review.recommendation}\u0000${review.score}\u0000${review.evidence}`;
      const occurrence = (seenKeys.get(fingerprint) ?? 0) + 1;
      seenKeys.set(fingerprint, occurrence);
      return { ...review, key: `${fingerprint}\u0000${occurrence}` };
    });
    return {
    ...group,
    reviews,
    averageScore: group.reviews.reduce((sum, review) => sum + review.score, 0) / group.reviews.length,
    recommendationCounts: Object.fromEntries([...new Set(group.reviews.map((review) => review.recommendation))].map((recommendation) => [
      recommendation,
      group.reviews.filter((review) => review.recommendation === recommendation).length,
    ])),
  }; });
}
