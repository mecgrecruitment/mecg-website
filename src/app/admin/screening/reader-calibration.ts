import { rankScreeningResults, type ScreeningResult } from "./screening-result-groups";

// The RPC omits reviewerId for some viewers; those reviews share one anonymous reader effect.
const readerKey = (result: ScreeningResult) => result.reviewerId ?? "?";
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

// Additive model score = mu + applicant + reader, fitted by alternating least squares.
// Reader effects sum to zero, so an applicant's adjusted average is mu + their own effect.
export function calibrateScreeningResults(results: ScreeningResult[]) {
  if (results.length === 0) return { readers: [], applicants: [] };
  const mu = mean(results.map((result) => result.score));
  const byApplicant = new Map<string, ScreeningResult[]>();
  const byReader = new Map<string, ScreeningResult[]>();
  for (const result of results) {
    byApplicant.set(result.code, [...(byApplicant.get(result.code) ?? []), result]);
    byReader.set(readerKey(result), [...(byReader.get(readerKey(result)) ?? []), result]);
  }
  const a = new Map([...byApplicant.keys()].map((code) => [code, 0]));
  const b = new Map([...byReader.keys()].map((id) => [id, 0]));
  for (let iteration = 0; iteration < 100; iteration += 1) {
    for (const [code, reviews] of byApplicant) a.set(code, mean(reviews.map((review) => review.score - mu - b.get(readerKey(review))!)));
    for (const [id, reviews] of byReader) b.set(id, mean(reviews.map((review) => review.score - mu - a.get(review.code)!)));
    const shift = mean([...b.values()]);
    for (const [id, effect] of b) b.set(id, effect - shift);
    for (const [code, effect] of a) a.set(code, effect + shift);
  }

  const readers = [...byReader.entries()].map(([id, reviews]) => {
    const scores = reviews.map((review) => review.score);
    const readerMean = mean(scores);
    return {
      id,
      name: reviews[0].reviewerName ?? "Unknown reader",
      reads: reviews.length,
      effect: b.get(id)!,
      spread: Math.sqrt(mean(scores.map((score) => (score - readerMean) ** 2))),
    };
  });
  readers.sort((x, y) => y.effect - x.effect);

  const applicants = rankScreeningResults(results).map((applicant) => {
    const adjustedReviews = applicant.reviews.map((review) => {
      const effect = b.get(readerKey(review))!;
      return { reviewerId: review.reviewerId, reviewerName: review.reviewerName, score: review.score, adjusted: review.score - effect, effect };
    });
    return { ...applicant, rawRank: applicant.rank, adjustedScore: mean(adjustedReviews.map((review) => review.adjusted)), adjustedReviews };
  });
  applicants.sort((x, y) => y.adjustedScore - x.adjustedScore || (x.applicantName ?? "").localeCompare(y.applicantName ?? "") || x.code.localeCompare(y.code));
  // Dense ranking on the adjusted average, same tie rule as the raw ranking.
  let rank = 0;
  return {
    readers,
    applicants: applicants.map((applicant, index) => {
      if (index === 0 || applicant.adjustedScore !== applicants[index - 1].adjustedScore) rank += 1;
      return { ...applicant, adjustedRank: rank };
    }),
  };
}
