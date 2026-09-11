import type { ScreeningOverview } from "@/lib/screening-rpc";

export type ScreeningResult = NonNullable<ScreeningOverview["results"]>[number];

export function rankScreeningResults(results: ScreeningResult[]) {
  const groups = new Map<string, ScreeningResult[]>();
  for (const result of results) groups.set(result.code, [...(groups.get(result.code) ?? []), result]);
  const applicants = [...groups.entries()].map(([code, reviews]) => {
    const counts: Record<string, number> = {};
    for (const review of reviews) counts[review.recommendation] = (counts[review.recommendation] ?? 0) + 1;
    const { applicationId, applicantName, classYear, major } = reviews[0];
    return {
      code,
      applicationId,
      applicantName,
      classYear,
      major,
      reviews,
      averageScore: reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length,
      recommendationCounts: counts,
    };
  });
  applicants.sort((a, b) => b.averageScore - a.averageScore || (a.applicantName ?? "").localeCompare(b.applicantName ?? "") || a.code.localeCompare(b.code));
  const mean = applicants.reduce((sum, applicant) => sum + applicant.averageScore, 0) / applicants.length;
  const stdDev = Math.sqrt(applicants.reduce((sum, applicant) => sum + (applicant.averageScore - mean) ** 2, 0) / applicants.length);
  return applicants.map((applicant, index) => ({
    ...applicant,
    rank: index + 1,
    zScore: applicants.length < 2 || stdDev === 0 ? null : (applicant.averageScore - mean) / stdDev,
  }));
}
