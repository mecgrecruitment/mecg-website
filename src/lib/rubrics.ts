export const ROUND_DEFINITIONS = [
  {
    kind: "SPEED_DATING",
    name: "Speed Dating",
    weight: 40,
    criteria: [
      ["communication", "Clear communication and concision", 25, true, "Answers clearly, concisely, and adapts to the listener."],
      ["listening", "Listening and question quality", 20, false, "Listens, follows up, and builds on the conversation."],
      ["reasoning", "Structured reasoning", 20, false, "States assumptions and works through tradeoffs."],
      ["coachability", "Collaboration and coachability", 20, false, "Receives feedback respectfully and incorporates it."],
      ["judgment", "Judgment and integrity", 15, false, "Separates facts from assumptions and acknowledges limits."],
    ],
  },
  {
    kind: "GROUP_CASE",
    name: "Group Case",
    weight: 60,
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
