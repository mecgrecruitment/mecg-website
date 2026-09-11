const MAJOR_ALIASES: Record<string, string> = {
  "ioe": "Industrial and Operations Engineering",
  "industrial and operations engineering": "Industrial and Operations Engineering",
  "industrial operations engineering": "Industrial and Operations Engineering",
  "cs": "Computer Science",
  "cse": "Computer Science",
  "computer science": "Computer Science",
  "computer science engineering": "Computer Science",
  "ee": "Electrical Engineering",
  "electrical": "Electrical Engineering",
  "electrical engineering": "Electrical Engineering",
  "bme": "Biomedical Engineering",
  "biomedical": "Biomedical Engineering",
  "biomedical engineering": "Biomedical Engineering",
  "me": "Mechanical Engineering",
  "meche": "Mechanical Engineering",
  "mechanical": "Mechanical Engineering",
  "mechanical engineering": "Mechanical Engineering",
  "aero": "Aerospace Engineering",
  "aerospace": "Aerospace Engineering",
  "aerospace engineering": "Aerospace Engineering",
  "ibe": "Integrated Business and Engineering",
  "integrated business and engineering": "Integrated Business and Engineering",
  "ds": "Data Science",
  "data science": "Data Science",
  "nuclear": "Nuclear Engineering",
  "nuclear engineering": "Nuclear Engineering",
  "physics": "Physics",
  "business": "Business",
  "business administration": "Business",
};

export function canonicalMajor(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Concentrations and dual-degree notes ride along after " - " or " ("; the base major is the match key.
  const normalized = trimmed
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .split(/ - | — | \(/)[0]
    .trim();
  return MAJOR_ALIASES[normalized] ?? trimmed;
}
