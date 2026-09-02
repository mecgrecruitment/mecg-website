import "server-only";

import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { hasClerkConfiguration, requireClerkIssuer } from "@/lib/env";
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
  if (!hasClerkConfiguration()) return null;
  const session = await auth();
  if (!session.userId) return null;

  const issuer = typeof session.sessionClaims?.iss === "string"
    ? session.sessionClaims.iss.replace(/\/+$/, "")
    : "";
  const expectedIssuer = requireClerkIssuer();
  if (issuer !== expectedIssuer || session.sessionClaims?.sub !== session.userId) {
    throw new Error("Clerk session issuer or subject did not match the configured identity provider");
  }

  // Never read this back through rush.profiles. That table's select policies
  // also expose every active colleague in a shared cycle, so an unfiltered
  // maybeSingle() throws PGRST116 for any Board member or member and takes
  // /admin down with it. actor_id() resolves the caller's own row from
  // auth_identities and returns null when there is no mapping yet.
  const supabase = await createClient();
  const { data: mappedUserId, error: mappingError } = await supabase.rpc("actor_id");
  if (mappingError) throw mappingError;
  if (mappedUserId) return { appUserId: mappedUserId, issuer, subject: session.userId };

  // Webhooks reconcile identity metadata, but the first authenticated request
  // is the synchronous correctness path so a delayed webhook cannot strand a
  // new user between Clerk and the Rush database.
  const clerkUser = await clerkCurrentUser();
  if (!clerkUser || clerkUser.id !== session.userId) throw new Error("Clerk user could not be loaded");
  const primaryEmail = clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
  if (!primaryEmail) throw new Error("A verified primary email is required");

  // A Board member or prior applicant whose Clerk account was never linked by
  // scripts/migrate-auth-users.mjs still has a prepared ledger row. Claim that
  // existing domain UUID, exactly as the migration script does, or they are
  // minted a fresh membership-less profile and routed as a new applicant.
  //
  // expected_email carries no unique constraint (source_user_id is the primary
  // key, provider_subject the only unique column), so two rows can legitimately
  // share an address. A bare maybeSingle() turned that into PGRST116, which
  // this function throws, which locks that person out of sign-in permanently
  // with no recovery path in the UI. Pick deterministically instead: ascending
  // status puts 'LINKED' before 'PREPARED', so the already-claimed identity
  // wins. A genuine query error still fails closed below.
  const admin = createAdminClient();
  const { data: ledgerEntry, error: ledgerError } = await admin
    .from("auth_migration_ledger")
    .select("source_user_id")
    .eq("expected_email", primaryEmail.trim().toLowerCase())
    .in("status", ["PREPARED", "LINKED"])
    .order("status", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ledgerError) throw ledgerError;

  const { data: appUserId, error: provisionError } = await admin.rpc("ensure_external_identity", {
    identity_issuer: issuer,
    identity_subject: session.userId,
    identity_email: primaryEmail,
    identity_display_name: displayName(clerkUser, primaryEmail),
    existing_app_user_id: ledgerEntry?.source_user_id,
  });
  if (provisionError) throw provisionError;
  return { appUserId, issuer, subject: session.userId };
}
