export const STATS = [
  { value: "70+", label: "Members", context: "Current organization figure, 2026" },
  { value: "30+", label: "Organizations served", context: "Since MECG was founded" },
  { value: "2023", label: "Founded at Michigan", context: "First member cohort in Winter 2024" },
  { value: "All", label: "Majors welcome", context: "Open across the university" },
];

export const BOARD = [
  { name: "Annie Callam", role: "President", src: "/board/annie.jpeg", linkedin: "https://www.linkedin.com/in/ana-callam-413bb5274/" },
  { name: "Nandini Tatiwala", role: "VP External", src: "/board/nandini.jpeg", linkedin: "https://www.linkedin.com/in/nandini-tatiwala/" },
  { name: "Abby Osterhart", role: "VP Internal", src: "/board/abby.jpeg", linkedin: "https://www.linkedin.com/in/abigailosterhart/" },
  { name: "Jandy Arias", role: "VP Recruitment", src: "/board/jandy.jpeg", linkedin: "https://www.linkedin.com/in/jandy-arias/" },
  { name: "Blake Stark", role: "VP Consulting", src: "/board/blake.jpeg", linkedin: "https://www.linkedin.com/in/blakeastark" },
  { name: "Sumedha Katti", role: "VP Consulting", src: "/board/sumedha.jpeg", linkedin: "https://www.linkedin.com/in/sumedha-katti/" },
  { name: "Maya Menon", role: "VP Education", src: "/board/maya.jpeg", linkedin: "https://www.linkedin.com/in/mayamenon28" },
  { name: "Luciano del Carpio", role: "VP Education", src: "/board/luciano.jpeg", linkedin: "https://www.linkedin.com/in/luciano-del-carpio/" },
  { name: "Selena Cooper", role: "VP Finance", src: "/board/selena.png", linkedin: "https://www.linkedin.com/in/selena-cooper/" },
  { name: "Angela Yang", role: "VP Marketing", src: "/board/angela.png", linkedin: "https://www.linkedin.com/in/anngelayang/" },
];

export const PROJECTS = [
  {
    number: "001",
    eyebrow: "Research and strategy",
    title: "Find the decision hiding inside the data.",
    summary: "A typical research project turns customer interviews, market data, and internal evidence into a choice a client can act on.",
    details: [
      ["Challenge", "Define the question before collecting more information."],
      ["Approach", "Combine primary research with a clear analytical model."],
      ["Deliverable", "A recommendation with evidence, limits, and next steps."],
    ],
    tone: "from-mecg-blue/55 to-mecg-navy",
  },
  {
    number: "002",
    eyebrow: "Operations and growth",
    title: "Make a good process easier to run.",
    summary: "A typical operations project maps how work moves today, finds expensive friction, and proposes a practical operating plan.",
    details: [
      ["Challenge", "Locate delays, repeated work, and unclear ownership."],
      ["Approach", "Map the process and test changes against real constraints."],
      ["Deliverable", "A prioritized plan the client can use after the semester."],
    ],
    tone: "from-mecg-orange/45 to-mecg-navy",
  },
  {
    number: "003",
    eyebrow: "Technical and product",
    title: "Connect the business case to the build.",
    summary: "A typical product project compares technical options and tests whether the business case holds up under real constraints.",
    details: [
      ["Challenge", "Separate useful requirements from a long wish list."],
      ["Approach", "Compare options through cost, risk, and implementation effort."],
      ["Deliverable", "A scoped recommendation with a credible path to execution."],
    ],
    tone: "from-mecg-blue/45 to-mecg-navy",
  },
] as const;

export const ENGAGEMENT_STEPS = [
  ["01", "Frame the question", "We agree on the decision the project needs to support, the people involved, and what a useful answer looks like."],
  ["02", "Build the evidence", "A student team researches, interviews, analyzes, and checks its assumptions with the client throughout the semester."],
  ["03", "Hand off the work", "The final recommendation includes the reasoning and materials the client needs to take the next step."],
] as const;

export const PROJECT_OUTPUTS = [
  ["Decision brief", "The recommendation, the evidence behind it, and the tradeoffs the client needs to weigh."],
  ["Working materials", "Research notes, analysis, models, and other files built during the project."],
  ["Implementation plan", "Prioritized next steps, owners, and open questions for the client team."],
] as const;

export const CLIENT_FAQS = [
  ["What makes a good MECG project?", "A focused question, an engaged client contact, and a decision that can benefit from a semester of research and analysis."],
  ["Who does the work?", "A small student team works under MECG project leadership and meets with the client throughout the semester."],
  ["What does pro bono mean?", "MECG does not charge a consulting fee. Clients contribute time, context, and access to the people or information the team needs."],
  ["Can you work with confidential information?", "Raise confidentiality needs in the first conversation so the board can decide whether the project is a responsible fit."],
] as const;
