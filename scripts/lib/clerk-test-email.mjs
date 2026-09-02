export function clerkTestEmail(label, entropy = crypto.randomUUID()) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 24) || "fixture";
  const suffix = entropy.toLowerCase().replace(/[^a-z0-9]/gu, "").slice(0, 12);
  if (!suffix) throw new Error("Clerk test email entropy is required");
  return `${safeLabel}+clerk_test_${suffix}@example.com`;
}
