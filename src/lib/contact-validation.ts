export const CONTACT_FIELDS = ["name", "email", "subject", "message"] as const;
export type ContactField = typeof CONTACT_FIELDS[number];
export type ContactErrors = Partial<Record<ContactField, string>>;

export function contactErrors(fields: Record<ContactField, string>): ContactErrors {
  const { name, email, subject, message } = fields;
  const errors: ContactErrors = {};
  if (!name.trim() || name.trim().length > 100) errors.name = "Enter your name, up to 100 characters.";
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!subject.trim() || subject.trim().length > 150 || /[\r\n]/.test(subject)) errors.subject = "Enter a subject on one line, up to 150 characters.";
  if (message.trim().length < 10 || message.trim().length > 5000) errors.message = "Write a message between 10 and 5,000 characters, excluding surrounding spaces.";
  return errors;
}

export function parseContactErrors(value: unknown): ContactErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const errors: ContactErrors = {};
  for (const [key, message] of Object.entries(value)) {
    const field = CONTACT_FIELDS.find((field) => field === key);
    if (field && typeof message === "string") errors[field] = message;
  }
  return errors;
}
