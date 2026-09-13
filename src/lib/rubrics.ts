export const ROUND_DEFINITIONS = [
  {
    kind: "SPEED_DATING",
    name: "Speed Dating",
    weight: 40,
    minimumObservedCriteria: 1,
    criteria: [
      ["overall", "Overall Speed Dating assessment", 100, true, "Rate the full interaction: listening, clear communication, reasoning, collaboration, and judgment."],
    ],
  },
  {
    kind: "GROUP_CASE",
    name: "Group Case",
    weight: 60,
    minimumObservedCriteria: 3,
    criteria: [
      ["framing", "Problem framing and assumptions", 20, false, "Clarifies the objective, ambiguity, and assumptions."],
      ["analysis", "Analysis and evidence", 20, false, "Uses evidence and tests assumptions."],
      ["collaboration", "Collaboration and inclusion", 25, true, "Invites contributions and resolves disagreement constructively."],
      ["communication", "Communication and listening", 15, false, "Synthesizes clearly and keeps the group aligned."],
      ["ownership", "Ownership and reliability", 10, false, "Follows through without taking over."],
      ["recommendation", "Recommendation and judgment", 10, false, "Prioritizes actions, limitations, and next steps."],
    ],
  },
] as const;

// Round scores live on 0..100 (scoreEvaluation); Speed Dating reads back as 1..5 stars.
export function starsFromScore(score: number) {
  return score / 25 + 1;
}

export const SCORE_ANCHORS: Record<number, string> = {
  1: "Serious concern or behavior undermined the criterion",
  2: "Below the expected bar or inconsistent evidence",
  3: "Meets the expected bar with ordinary evidence",
  4: "Strong and repeated evidence",
  5: "Exceptional, adaptive, and constructive evidence",
};

export const SPEED_DATING_SCORE_LABELS: Record<number, string> = {
  1: "Hard no",
  2: "Leaning no",
  3: "Average",
  4: "Leaning yes",
  5: "Yes",
};

export const SPEED_DATING_SCORE_ANCHORS: Record<number, string> = {
  1: "This candidate said something extremely disrespectful or unwarranted. They should be removed from MECG’s recruitment process.",
  2: "This candidate was not very memorable and might not be a good fit for MECG.",
  3: "This candidate was likeable and had average answers, but nothing really stood out. They could potentially be a good fit.",
  4: "This candidate was likeable and has qualities that many current members possess. They would be a good addition.",
  5: "This candidate should be in MECG already. They were super personable and had super memorable answers. I would vouch for their character strongly.",
};
