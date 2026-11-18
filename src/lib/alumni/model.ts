// Alumni directory. The database functions in
// 20261118210000_alumni_directory.sql are the authority; these checks mirror
// them so a bad form fails before a round trip, and parse responses so a
// malformed read shows the unavailable state instead of guesses.
// Listing is opt-in, every detail is optional, and empty means not shared.

export const listingFields = ["gradTerm", "major", "employer", "jobTitle", "location", "linkedinUrl", "contactEmail", "note"] as const;
export type ListingField = typeof listingFields[number];
export type ListingInput = Record<ListingField, string>;

export const fieldLabels: Record<ListingField, string> = {
  gradTerm: "Graduation term", major: "Major", employer: "Employer", jobTitle: "Role", location: "City",
  linkedinUrl: "LinkedIn", contactEmail: "Email for members", note: "Happy to talk about",
};
export const fieldLimits: Record<ListingField, number> = {
  gradTerm: 40, major: 120, employer: 120, jobTitle: 120, location: 120, linkedinUrl: 300, contactEmail: 254, note: 500,
};

export type AlumniListing = ListingInput & {
  id: string;
  isMine: boolean;
  name: string | null;
  revision: number;
  updatedAt: string;
};
export type AlumniDirectory = {
  canRemoveOthers: boolean;
  mine: AlumniListing | null;
  defaults: { gradTerm: string; major: string };
  entries: AlumniListing[];
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactly(value: Record<string, unknown>, keys: readonly string[]) {
  const own = Object.keys(value);
  return own.length === keys.length && own.every((key) => keys.includes(key));
}

// Same rules as the database: https on linkedin.com or one of its subdomains.
const linkedin = /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/\S*$/i;
// No character that changes a mailto: link (?, &, comma, ;, %, quotes,
// brackets, slashes), so a listing cannot add recipients, a subject or a body.
const email = /^[^\s@?&,;%"<>()[\]\\/]+@[^\s@?&,;%"<>()[\]\\/]+\.[^\s@?&,;%"<>()[\]\\/]+$/;
export function isLinkedinUrl(value: string): boolean {
  return value.length <= fieldLimits.linkedinUrl && linkedin.test(value);
}
export function isContactEmail(value: string): boolean {
  return value.length <= fieldLimits.contactEmail && email.test(value);
}

export function parseListingInput(input: unknown): Parsed<ListingInput> {
  if (!isObject(input) || !hasExactly(input, listingFields)) return { ok: false, error: "Invalid listing form." };
  const value = {} as ListingInput;
  for (const field of listingFields) {
    const raw = input[field];
    if (typeof raw !== "string") return { ok: false, error: "Invalid listing form." };
    const trimmed = raw.trim();
    if (trimmed.length > fieldLimits[field]) return { ok: false, error: `Shorten ${fieldLabels[field].toLowerCase()} to ${fieldLimits[field]} characters.` };
    value[field] = trimmed;
  }
  if (value.linkedinUrl && !isLinkedinUrl(value.linkedinUrl)) return { ok: false, error: "The LinkedIn link must be a full https://linkedin.com address." };
  if (value.contactEmail && !isContactEmail(value.contactEmail)) return { ok: false, error: "Check the email address." };
  return { ok: true, value };
}

export function sharedFields(listing: ListingInput): ListingField[] {
  return listingFields.filter((field) => listing[field] !== "");
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid alumni response");
  return value;
}

// Stored rows are read leniently: the database already enforced its limits,
// and its whitespace and length rules count characters slightly differently
// from JavaScript, so one stored row must not blank the whole directory. The
// LinkedIn link becomes an href, so it must be a LinkedIn https link whatever
// else it holds, and the email must pass the mailto-safe rule; anything else
// is dropped rather than linked.
function parseListing(value: unknown): AlumniListing {
  if (!isObject(value)) throw new Error("Invalid alumni response");
  const { id, isMine, name, revision, updatedAt } = value;
  if (typeof isMine !== "boolean") throw new Error("Invalid alumni response");
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision");
  if (name !== null && typeof name !== "string") throw new Error("Invalid alumni response");
  const fields = {} as ListingInput;
  for (const field of listingFields) fields[field] = text(value[field]);
  if (fields.linkedinUrl && !linkedin.test(fields.linkedinUrl)) fields.linkedinUrl = "";
  // The email becomes a mailto: link, so the same rule applies on the way out.
  if (fields.contactEmail && !email.test(fields.contactEmail)) fields.contactEmail = "";
  return { id: text(id), isMine, name, ...fields, revision, updatedAt: text(updatedAt) };
}

export function parseAlumniDirectory(value: unknown): AlumniDirectory {
  if (!isObject(value) || typeof value.canRemoveOthers !== "boolean" || !Array.isArray(value.entries)) throw new Error("Invalid alumni response");
  // The caller's profile may be missing, so defaults fall back to empty.
  const defaults = isObject(value.defaults) ? value.defaults : {};
  return {
    canRemoveOthers: value.canRemoveOthers,
    mine: value.mine === null || value.mine === undefined ? null : parseListing(value.mine),
    defaults: { gradTerm: typeof defaults.gradTerm === "string" ? defaults.gradTerm : "", major: typeof defaults.major === "string" ? defaults.major : "" },
    entries: value.entries.map(parseListing),
  };
}

// Case-insensitive match on every shared detail and the name, so "ford",
// "detroit" or "2025" all find people.
export function filterListings(entries: readonly AlumniListing[], query: string): AlumniListing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter((entry) => {
    const haystack = [entry.name ?? "", ...listingFields.filter((field) => field !== "linkedinUrl").map((field) => entry[field])].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
