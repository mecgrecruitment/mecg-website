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

export const SCORE_ANCHORS: Record<number, string> = {
  1: "Serious concern or behavior undermined the criterion",
  2: "Below the expected bar or inconsistent evidence",
  3: "Meets the expected bar with ordinary evidence",
  4: "Strong and repeated evidence",
  5: "Exceptional, adaptive, and constructive evidence",
};

export const SPEED_DATING_SCORE_ANCHORS: Record<number, string> = {
  1: "Serious concern: behavior conflicted with MECG’s expectations.",
  2: "Below the bar: a material concern or too little positive evidence.",
  3: "Meets the bar: communicated clearly and engaged constructively.",
  4: "Strong: listened, reasoned, and contributed with clear positive evidence.",
  5: "Exceptional: adapted well and showed unusually strong judgment or collaboration.",
};
