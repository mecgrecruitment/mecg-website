export const JOIN_REASONS = [
  {
    number: "01",
    title: "Do work that leaves the classroom",
    copy: "Members spend a semester answering a real question for a client. The work has a deadline, an audience, and a final handoff.",
  },
  {
    number: "02",
    title: "Build the fundamentals",
    copy: "Education sessions cover research, analysis, structured thinking, and communication. Project teams give you somewhere to practice each skill.",
  },
  {
    number: "03",
    title: "Learn across majors",
    copy: "MECG is open to every major. Teams benefit when technical, business, design, and social perspectives share the table.",
  },
] as const;

export const MEMBER_EXPECTATIONS = [
  {
    number: "01",
    title: "Come prepared",
    copy: "Client work depends on teammates meeting deadlines and bringing usable work to each meeting.",
  },
  {
    number: "02",
    title: "Question your first answer",
    copy: "Members surface uncertainty, listen carefully, and revise their thinking when the evidence changes.",
  },
  {
    number: "03",
    title: "Own part of the work",
    copy: "Project teams divide research, analysis, client communication, and final delivery across the group.",
  },
] as const;

export const RECRUITMENT_STEPS = [
  {
    number: "01",
    title: "Apply",
    eyebrow: "Written application",
    copy: "Tell us what you want to learn and how you work. You can save a draft before submitting.",
  },
  {
    number: "02",
    title: "Meet members",
    eyebrow: "Open events",
    copy: "Use mixers, the mass meeting, and office hours to ask candid questions. Attendance is never a score.",
  },
  {
    number: "03",
    title: "Speed Dating",
    eyebrow: "Evaluated round",
    copy: "Have short, assigned conversations with members. This is separate from the open Meet Members mixer.",
  },
  {
    number: "04",
    title: "Group Case",
    eyebrow: "Evaluated round",
    copy: "Work through a team problem. We score how each person frames, listens, and contributes, not the group's final answer.",
  },
] as const;

export const EVALUATION_TRAITS = [
  ["Clear communication", "You answer the question asked and adapt to the listener."],
  ["Structured reasoning", "You name assumptions, tradeoffs, and what would change your mind."],
  ["Collaboration", "You make room for other people and still own a piece of the work."],
  ["Judgment", "You separate facts from guesses and flag real constraints."],
] as const;

export const PREPARATION_NOTES = [
  "Read the prompt closely and answer the question that was asked.",
  "Practice explaining your reasoning without hiding behind a memorized framework.",
  "Come ready to listen, change your mind, and make room for teammates.",
  "Ask current members about this semester's time commitment before you apply.",
] as const;

export const JOIN_FAQS = [
  ["Who can apply?", "Current University of Michigan students from any school, college, or major can apply."],
  ["Do I need consulting experience?", "No. MECG teaches the work. We look at how you listen, structure a problem, and work with other people."],
  ["Does missing a rush event hurt my application?", "No. Events help you learn about MECG. Attendance is operational only and is never a score."],
  ["I applied before and was not admitted. Can I reapply?", "Yes. Reapplying is treated as continued interest, not a negative."],
  ["What is Meet Members versus Speed Dating?", "Meet Members is an open mixer. Speed Dating is the evaluated round, with short structured conversations, assigned members, and a rubric."],
  ["What is Group Case?", "It is a team problem. We score individual behavior, including how you frame, listen, and share work. We do not score whether your group found a clever answer."],
  ["How do I prepare?", "Read how we evaluate. We do not gate on memorized case frameworks."],
  ["What is the weekly commitment?", "Membership includes project work, team meetings, and organization events. Ask during recruitment for this semester's expected load."],
  ["When does recruitment happen?", "Recruitment runs by semester. When a cycle is active, the dates on this page are the live dates."],
] as const;
