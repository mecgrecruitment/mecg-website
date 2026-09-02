import "server-only";

import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { requireClerkIssuer } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ResolvedIdentity = {
  appUserId: string;
  issuer: string;
  subject: string;
};

function displayName(user: NonNullable<Awaited<ReturnType<typeof clerkCurrentUser>>>, email: string) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || email.split("@", 1)[0] || "MECG user";
}

export async function resolveCurrentIdentity(): Promise<ResolvedIdentity | null> {
  const session = await auth();
  if (!session.userId) return null;

  const issuer = typeof session.sessionClaims?.iss === "string"
    ? session.sessionClaims.iss.replace(/\/+$/, "")
    : "";
  const expectedIssuer = requireClerkIssuer();
  if (issuer !== expectedIssuer || session.sessionClaims?.sub !== session.userId) {
    throw new Error("Clerk session issuer or subject did not match the configured identity provider");
  }

  const supabase = await createClient();
  const { data: mappedProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .maybeSingle();
  if (profileError) throw profileError;
  if (mappedProfile) return { appUserId: mappedProfile.id, issuer, subject: session.userId };

  // Webhooks reconcile identity metadata, but the first authenticated request
  // is the synchronous correctness path so a delayed webhook cannot strand a
  // new user between Clerk and the Rush database.
  const clerkUser = await clerkCurrentUser();
  if (!clerkUser || clerkUser.id !== session.userId) throw new Error("Clerk user could not be loaded");
  const primaryEmail = clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
  if (!primaryEmail) throw new Error("A verified primary email is required");

  const admin = createAdminClient();
  const { data: appUserId, error: provisionError } = await admin.rpc("ensure_external_identity", {
    identity_issuer: issuer,
    identity_subject: session.userId,
    identity_email: primaryEmail,
    identity_display_name: displayName(clerkUser, primaryEmail),
  });
  if (provisionError) throw provisionError;
  return { appUserId, issuer, subject: session.userId };
}
