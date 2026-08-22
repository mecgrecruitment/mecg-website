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

export const PAST_PROJECTS = [
  {
    name: "General Motors",
    industry: "Automotive",
    website: "https://www.gm.com/",
    logo: "https://media.gm.com/content/dam/Shared/Images/Logos/gm/GM_Brandmark_Wordmark_Lockup_Blue_Horizontal_RGB.jpg",
    width: 1890,
    height: 400,
  },
  {
    name: "Legendary Sports Xperiences",
    industry: "Youth sports",
    website: "https://www.legendarysportsx.com/",
    logo: "https://static.wixstatic.com/media/17276b_5ec5e9a5a945483e9eaf5d4f61f5ba46~mv2.png",
    width: 1000,
    height: 239,
  },
  {
    name: "Glo Skin Beauty",
    industry: "Beauty and skincare",
    website: "https://www.gloskinbeauty.com/",
    logo: "https://www.gloskinbeauty.com/cdn/shop/files/logo.svg?v=1744372388",
    width: 151,
    height: 141,
  },
] as const;

/** Homepage featured case: public facts only, no unpublished outcomes. */
export const FEATURED_ENGAGEMENT = {
  client: "General Motors",
  industry: "Automotive",
  location: "Detroit / Ann Arbor",
  question: "A semester-length question from a global manufacturer.",
  body: "General Motors is among the organizations that have worked with MECG. Student teams take one focused decision, gather evidence, and hand back a recommendation the client can use after the term. Detailed case studies go live only after the client approves them.",
  href: "/work",
} as const;

export const SEMESTER_FACTS = [
  ["Cost", "Pro bono"],
  ["Length", "One academic semester"],
  ["Team", "6–8 members"],
  ["Confidentiality", "NDAs supported"],
] as const;

export const HOMEPAGE_LEADERS = BOARD.slice(0, 3);

export const ENGAGEMENT_STEPS = [
  ["01", "Explore fit", "We learn the decision, timing, available information, and the people who will use the work.", "A shared view of whether MECG is the right team."],
  ["02", "Scope the project", "Together, we define the question, client responsibilities, confidentiality needs, and what a useful answer looks like.", "An agreed project scope and working cadence."],
  ["03", "Build the evidence", "A team of 6-8 members researches, interviews, analyzes, and checks assumptions with the client.", "Research, analysis, and working materials."],
  ["04", "Recommend and hand off", "We present the recommendation, its limits, and the practical next steps the client can take.", "A decision brief, supporting files, and implementation plan."],
] as const;

export const PROJECT_OUTPUTS = [
  ["Decision brief", "The recommendation, the evidence behind it, and the tradeoffs the client needs to weigh."],
  ["Working materials", "Research notes, analysis, models, and other files built during the project."],
  ["Implementation plan", "Prioritized next steps, owners, and open questions for the client team."],
] as const;

export const CLIENT_FAQS = [
  ["What makes a good MECG project?", "A focused question, an engaged client contact, and a decision that can benefit from a semester of research and analysis."],
  ["Who does the work?", "A team of 6-8 University of Michigan students works under MECG project leadership."],
  ["What does pro bono mean?", "MECG does not charge a consulting fee. Clients contribute time, context, and access to the people or information the team needs."],
  ["How often will we meet?", "MECG and the client set a meeting cadence that fits the project. The team still needs a responsive client contact throughout the engagement."],
  ["How long does an engagement last?", "Most projects run for one academic semester. Longer engagements are possible when the scope requires them."],
  ["Can MECG sign an NDA?", "Yes. Bring confidentiality needs into the first conversation so they can be included in project scoping."],
  ["What happens after I inquire?", "The MECG board reviews the context and replies within one week to discuss fit and a possible next step."],
] as const;
