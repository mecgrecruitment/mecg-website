export const STATS = [
  { value: "70+", label: "Members", context: "Active in 2026" },
  { value: "30+", label: "Organizations", context: "Partnered since founding" },
  { value: "2023", label: "Founded", context: "First cohort, Winter 2024" },
  { value: "All", label: "Majors", context: "Open across Michigan" },
];

export const BOARD = [
  { name: "Annie Callam", role: "President", src: "/board/annie-2026.jpg", imageClass: "scale-[1.02]", imagePosition: "50% 18%", linkedin: "https://www.linkedin.com/in/ana-callam-413bb5274/" },
  { name: "Nandini Tatiwala", role: "VP External", src: "/board/nandini.jpeg", imageClass: "scale-[1.18]", imagePosition: "50% 24%", linkedin: "https://www.linkedin.com/in/nandini-tatiwala/" },
  { name: "Abby Osterhart", role: "VP Internal", src: "/board/abby.jpeg", imageClass: "scale-[1.18]", imagePosition: "50% 24%", linkedin: "https://www.linkedin.com/in/abigailosterhart/" },
  { name: "Jandy Arias", role: "VP Recruitment", src: "/board/jandy.jpeg", imageClass: "scale-[1.16]", imagePosition: "50% 22%", linkedin: "https://www.linkedin.com/in/jandy-arias/" },
  { name: "Blake Stark", role: "VP Consulting", src: "/board/blake.jpeg", imageClass: "scale-[1.18]", imagePosition: "50% 22%", linkedin: "https://www.linkedin.com/in/blakeastark" },
  { name: "Sumedha Katti", role: "VP Consulting", src: "/board/sumedha.jpeg", imageClass: "scale-[1.32]", imagePosition: "50% 22%", imageOrigin: "50% 30%", linkedin: "https://www.linkedin.com/in/sumedha-katti/" },
  { name: "Maya Menon", role: "VP Education", src: "/board/maya.jpeg", imageClass: "scale-[1.06]", imagePosition: "50% 18%", linkedin: "https://www.linkedin.com/in/mayamenon28" },
  { name: "Luciano del Carpio", role: "VP Education", src: "/board/luciano.jpeg", imageClass: "scale-[1.3]", imagePosition: "50% 22%", imageOrigin: "50% 28%", linkedin: "https://www.linkedin.com/in/luciano-del-carpio/" },
  { name: "Selena Cooper", role: "VP Finance", src: "/board/selena.png", imageClass: "scale-[1.06]", imagePosition: "50% 18%", linkedin: "https://www.linkedin.com/in/selena-cooper/" },
  { name: "Angela Yang", role: "VP Marketing", src: "/board/angela.png", imageClass: "scale-[1.5]", imagePosition: "50% 24%", imageOrigin: "50% 42%", linkedin: "https://www.linkedin.com/in/anngelayang/" },
];

export const PAST_PROJECTS = [
  {
    name: "General Motors",
    logo: "/images/clients/general-motors.svg",
  },
  {
    name: "Legendary Sports Xperiences",
    logo: "/images/clients/legendary-sports-xperiences.png",
  },
  {
    name: "Glo Skin Spa",
    logo: "/images/clients/glo-skin-spa.png",
  },
  {
    name: "Koops Automation",
    logo: "/images/clients/koops-automation.jpg",
  },
  {
    name: "Gypsy Spirits",
    logo: "/images/clients/gypsy-spirits.jpg",
  },
  {
    name: "Here Here Market",
    logo: "/images/clients/here-here-market.jpg",
  },
  {
    name: "Red Hawk Golf Club",
    logo: "/images/clients/red-hawk-golf-club.png",
  },
  {
    name: "Lynkr",
    logo: "/images/clients/lynkr.png",
  },
  {
    name: "Frankel Jewish Academy",
    logo: "/images/clients/frankel-jewish-academy.png",
  },
  {
    name: "Dani Plan",
    logo: "/images/clients/dani-plan.png",
  },
  {
    name: "Fired and Fused",
    logo: "/images/clients/fired-and-fused.png",
  },
  {
    name: "The Probate Pro",
    logo: "/images/clients/the-probate-pro.png",
  },
  {
    name: "Michigan Creamery",
    logo: "/images/clients/michigan-creamery.png",
  },
  {
    name: "Homeschool Connections",
    logo: "/images/clients/homeschool-connections.png",
  },
  {
    name: "The Store House",
    logo: "/images/clients/the-store-house.png",
  },
] as const;

export const PILLARS = [
  {
    title: "Professional Development",
    body: "We help members build confidence in consulting, communication, networking, and recruiting through workshops, mentorship, and hands-on practice.",
  },
  {
    title: "Education",
    body: "Members learn the basics of consulting, problem solving, analysis, and presentation in a way that is approachable no matter their major or background.",
  },
  {
    title: "Project Experience",
    body: "Our teams work with real clients during the semester, turning open-ended questions into research, recommendations, and clear next steps.",
  },
  {
    title: "Community",
    body: "MECG is also a group of people who want to know each other well. We make space for mentorship, social events, and friendships outside of project work.",
  },
] as const;

export const SERVICES = [
  { title: "Strategy", body: "We help clients think through growth, positioning, competitors, customers, and practical next steps." },
  { title: "Operations & Management", body: "We look at how work gets done and recommend ways to make processes clearer, smoother, or easier to manage." },
  { title: "Data Analytics", body: "We organize information, look for patterns, and turn data into insights that clients can use." },
  { title: "Product Development", body: "We support early product thinking through user research, feature ideas, customer needs, and launch planning." },
  { title: "Marketing", body: "We help clients understand their audience, refine messaging, and improve how they appear online or in the market." },
] as const;

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
  ["03", "Build the evidence", "A team of 6–8 members researches, interviews, analyzes, and checks assumptions with the client.", "Research, analysis, and working materials."],
  ["04", "Recommend and hand off", "We present the recommendation, its limits, and the practical next steps the client can take.", "A decision brief, supporting files, and implementation plan."],
] as const;

export const CLIENT_FAQS = [
  ["What makes a good MECG project?", "A focused question, an engaged client contact, and a decision that can benefit from a semester of research and analysis."],
  ["Who does the work?", "A team of 6–8 University of Michigan students works under MECG project leadership."],
  ["What does pro bono mean?", "MECG does not charge a consulting fee. Clients contribute time, context, and access to the people or information the team needs."],
  ["How often will we meet?", "MECG and the client set a meeting cadence that fits the project. The team still needs a responsive client contact throughout the engagement."],
  ["How long does an engagement last?", "Most projects run for one academic semester. Longer engagements are possible when the scope requires them."],
  ["Can MECG sign an NDA?", "Yes. Bring confidentiality needs into the first conversation so they can be included in project scoping."],
  ["What happens after I inquire?", "The MECG board reviews the context and replies within one week to discuss fit and a possible next step."],
] as const;
