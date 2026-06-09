export const currentMember = {
  name: "Amani Gupta",
  email: "amanigupta25@gmail.com",
  role: "Member",
  year: "2028",
  major: "Computer Science",
  status: "Active",
};

export const internalStats = [
  { label: "Candidates", value: "128", detail: "Winter 2026 cycle" },
  { label: "In Review", value: "46", detail: "awaiting decisions" },
  { label: "Scores Submitted", value: "312", detail: "across stages" },
  { label: "Hash Queue", value: "18", detail: "pending discussion" },
];

export const stages = [
  { id: "application", label: "Application", status: "Open" },
  { id: "speed-dating", label: "Speed Dating", status: "Upcoming" },
  { id: "group-case", label: "Group Case", status: "Upcoming" },
  { id: "interview", label: "Interview", status: "Upcoming" },
  { id: "hash", label: "Hash", status: "Board Only" },
];

export const candidates = [
  {
    code: "C001",
    name: "Maya Shah",
    year: "2027",
    major: "Industrial Operations Engineering",
    email: "maya@umich.edu",
    status: "Application Review",
    stage: "Application",
    tags: ["Data", "Operations"],
    submitted: "Jan 18, 2026",
    composite: "4.42",
    reaction: "Strong Yes",
  },
  {
    code: "C002",
    name: "Ethan Lee",
    year: "2028",
    major: "Computer Science",
    email: "ethan@umich.edu",
    status: "Speed Dating",
    stage: "Speed Dating",
    tags: ["Product", "Strategy"],
    submitted: "Jan 19, 2026",
    composite: "4.18",
    reaction: "Yes",
  },
  {
    code: "C003",
    name: "Sofia Martinez",
    year: "2027",
    major: "Business",
    email: "sofia@umich.edu",
    status: "Group Case",
    stage: "Group Case",
    tags: ["Marketing", "Client Work"],
    submitted: "Jan 20, 2026",
    composite: "3.91",
    reaction: "Discuss",
  },
  {
    code: "C004",
    name: "Noah Patel",
    year: "2026",
    major: "Mechanical Engineering",
    email: "noah@umich.edu",
    status: "Interview",
    stage: "Interview",
    tags: ["Engineering", "Leadership"],
    submitted: "Jan 20, 2026",
    composite: "4.61",
    reaction: "Strong Yes",
  },
];

export const members = [
  { name: "Annie Callam", role: "President", team: "Board", status: "Active" },
  { name: "Nandini Tatiwala", role: "VP External", team: "Board", status: "Active" },
  { name: "Abby Osterhart", role: "VP Internal", team: "Board", status: "Active" },
  { name: "Jandy Arias", role: "VP Recruitment", team: "Board", status: "Active" },
  { name: "Blake Stark", role: "VP Consulting", team: "Board", status: "Active" },
  { name: "Sumedha Katti", role: "VP Consulting", team: "Board", status: "Active" },
  { name: "Maya Menon", role: "VP Education", team: "Board", status: "Active" },
  { name: "Luciano del Carpio", role: "VP Education", team: "Board", status: "Active" },
  { name: "Selena Cooper", role: "VP Finance", team: "Board", status: "Active" },
  { name: "Angela Yang", role: "VP Marketing", team: "Board", status: "Active" },
];

export const rubricCriteria = [
  { label: "Communication", description: "Clear, concise, structured responses." },
  { label: "Problem Solving", description: "Breaks ambiguous problems into logical parts." },
  { label: "Collaboration", description: "Listens, builds on ideas, and supports teammates." },
  { label: "Interest in MECG", description: "Shows genuine motivation and preparation." },
];

export const hashQueue = [
  { code: "C004", name: "Noah Patel", score: "4.61", controversy: "Low", status: "Discuss" },
  { code: "C001", name: "Maya Shah", score: "4.42", controversy: "Medium", status: "Discuss" },
  { code: "C002", name: "Ethan Lee", score: "4.18", controversy: "Low", status: "Hold" },
  { code: "C003", name: "Sofia Martinez", score: "3.91", controversy: "High", status: "Discuss" },
];

export const auditEvents = [
  { actor: "Board", action: "Created Winter 2026 cycle", time: "Jan 10, 2026 · 9:12 PM" },
  { actor: "Recruitment", action: "Opened application stage", time: "Jan 16, 2026 · 8:00 PM" },
  { actor: "System", action: "Candidate C001 submitted application", time: "Jan 18, 2026 · 1:42 PM" },
  { actor: "Board", action: "Updated speed dating rubric", time: "Jan 21, 2026 · 6:18 PM" },
];
