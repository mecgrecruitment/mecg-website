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
    // Fall recruitment guide: Collaboration and Composure weighted 2x (see 20260914140000).
    criteria: [
      ["collaboration", "Team Collaboration", 25, true, "Builds on teammates' ideas, pulls in quieter people, resolves disagreement productively and credits others. Weighted 2x."],
      ["problem_solving", "Structured Problem-Solving", 13, false, "Breaks the problem into parts, uses the numbers in the data pack to justify the recommendation and anticipates the counterargument."],
      ["leadership", "Leadership & Initiative", 12, false, "Steps up without being asked and without dominating; organizes the group's approach and owns a piece of the deliverable."],
      ["creativity", "Creativity & Business Judgment", 12, false, "Ideas are specific to this client and industry, reflect the stated constraints and show awareness of trade-offs."],
      ["composure", "Composure & Time Management", 25, false, "Paces work against the clock, stays calm when plans change and helps the group land a finished deliverable on time. Weighted 2x."],
      ["presentation", "Presentation & Communication", 13, false, "Clear, confident delivery; answers follow-up questions by reasoning in real time rather than restating the slide."],
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

// Per-dimension 1..5 anchors from the Fall recruitment guide, keyed by the
// criterion name the Group Case rubric carries. A renamed criterion falls
// back to SCORE_ANCHORS.
export const GROUP_CASE_DIMENSION_ANCHORS: Record<string, Record<number, string>> = {
  "Team Collaboration": {
    1: "Talked over teammates, dismissed others' ideas without discussion, or checked out of the conversation entirely.",
    2: "Waited to be asked before contributing; rarely built on what teammates said.",
    3: "Participated when prompted and was polite, but mostly worked in parallel rather than integrating ideas.",
    4: "Actively built on teammates' ideas, asked others for input, and helped the group converge.",
    5: "Made the team better: pulled in quieter teammates, resolved disagreements productively, credited others, kept the group on track without steamrolling it.",
  },
  "Structured Problem-Solving": {
    1: "No framework; jumped to a solution with no reasoning shown.",
    2: "Listed ideas without prioritizing or connecting them to the client's actual constraint.",
    3: "Used a basic framework (pros/cons, simple list) and reached a reasonable answer.",
    4: "Broke the problem into clear parts, used the data given to size the decision, and prioritized.",
    5: "Structured the problem like a real case (issue tree, hypothesis-driven), used the numbers given to justify the recommendation, and anticipated the obvious counterargument.",
  },
  "Leadership & Initiative": {
    1: "Never stepped up to organize the group or offered to own a piece of the work.",
    2: "Followed along; didn't volunteer for tasks unless assigned.",
    3: "Took ownership of a clear piece of the deliverable when the group divided work.",
    4: "Helped structure how the team would use its time and kept the group moving toward a deliverable.",
    5: "Stepped up naturally without being asked and without dominating, organized the group's approach, and kept everyone bought in.",
  },
  "Creativity & Business Judgment": {
    1: "Ideas were generic, unrealistic, or ignored the stated constraints entirely.",
    2: "Ideas were safe or obvious with little justification for why they'd work.",
    3: "At least one idea was specific and reasonably justified for this client.",
    4: "Ideas were tailored to the specific company and industry, not generic, and showed awareness of trade-offs.",
    5: "Original, well-justified idea that clearly reflects the constraints given (budget, timeline, industry realities) and shows real business instinct.",
  },
  "Composure & Time Management": {
    1: "Visibly frustrated, checked out, or the group blew through time with no usable deliverable.",
    2: "Rushed at the end; work clearly wasn't paced against the clock.",
    3: "Finished on time with a workable, if rough, deliverable.",
    4: "Managed time deliberately and stayed calm when plans changed.",
    5: "Stayed composed under real time pressure, adapted when an idea wasn't working instead of forcing it, and helped the group land a finished, on-time deliverable.",
  },
  "Presentation & Communication": {
    1: "Unclear, unprepared, or unable to answer basic follow-up questions.",
    2: "Read off slides; little eye contact or confidence.",
    3: "Clear and organized; handled follow-ups adequately.",
    4: "Confident, concise delivery; answered follow-ups with real reasoning, not just restating the slide.",
    5: "Executive-presence delivery: crisp, confident, and handled tough follow-up questions by reasoning in real time.",
  },
};

export function groupCaseAnchors(criterionName: string): Record<number, string> {
  return GROUP_CASE_DIMENSION_ANCHORS[criterionName] ?? SCORE_ANCHORS;
}

// Weighted score = Collaboration x2 + Problem-Solving + Leadership + Creativity + Composure x2 + Presentation, out of 40.
export const GROUP_CASE_SCORE_BANDS = [
  { min: 34, max: 40, label: "Yes, should already be in MECG" },
  { min: 27, max: 33, label: "Leaning yes" },
  { min: 20, max: 26, label: "Average" },
  { min: 13, max: 19, label: "Leaning no" },
  { min: 6, max: 12, label: "Hard no" },
] as const;

export const GROUP_CASE_RED_FLAGS = [
  "Interrupted or talked over teammates repeatedly.",
  "Took credit for a teammate's idea, or dismissed an idea without engaging with it.",
  "Disengaged (on phone, not participating) once it was clear they weren't presenting.",
  "Became visibly frustrated or condescending when the group disagreed with them.",
] as const;

export const GROUP_CASE_GREEN_FLAGS = [
  "Explicitly pulled a quieter teammate into the conversation.",
  "Said \"I could be wrong, but...\" or otherwise invited pushback.",
  "Changed their own position when a teammate made a better point.",
  "Volunteered for the least glamorous task (timekeeping, notes, formatting) without being asked.",
] as const;

// Weighted 1..5 stars rescaled to the guide's 6..40 range: 8 x weighted mean. Null until every criterion has a score.
export function groupCaseTotal(scores: Record<string, number | null>, criteria: Array<{ id: string; weight: number }>): { total: number; band: string } | null {
  if (criteria.length === 0 || criteria.some((criterion) => scores[criterion.id] == null)) return null;
  const weightSum = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const total = Math.round(8 * criteria.reduce((sum, criterion) => sum + criterion.weight * (scores[criterion.id] as number), 0) / weightSum);
  const band = GROUP_CASE_SCORE_BANDS.find((entry) => total >= entry.min && total <= entry.max) ?? GROUP_CASE_SCORE_BANDS[0];
  return { total, band: band.label };
}
