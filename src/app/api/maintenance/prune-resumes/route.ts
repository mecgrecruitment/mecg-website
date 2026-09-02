import { NextRequest, NextResponse } from "next/server";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Removes resume uploads that were started but never finalized or cancelled.
// Supabase forbids deleting storage.objects from SQL, so the storage half has to
// happen here through the Storage API; the database only reports the work list
// and retires each row once its object is confirmed gone.
//
// Scheduled by vercel.json. Guarded by CRON_SECRET rather than a session,
// because the caller is a scheduler with no user; Vercel Cron sends it as a
// bearer automatically. Fails closed when the secret is unset, so a
// misconfigured deploy skips the job instead of exposing it.
//
// Vercel Cron issues a GET, so GET is the entry point. That is safe here only
// because the route carries no ambient credentials: it ignores cookies entirely
// and admits nothing without the shared secret, so it is not CSRF-reachable.
export const dynamic = "force-dynamic";

async function prune(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("prune-resumes: CRON_SECRET is unset, refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!hasValidCronAuthorization(request.headers, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: stale, error } = await supabase.rpc("stale_pending_resume_uploads");
  if (error) {
    console.error("prune-resumes: could not list stale uploads", error);
    return NextResponse.json({ error: "Could not list stale uploads" }, { status: 503 });
  }
  if (!stale?.length) return NextResponse.json({ ok: true, removed: 0, failed: 0 });

  // One object at a time so a single bad path cannot strand the rest, and so a
  // row is only retired when its own delete actually succeeded.
  let removed = 0;
  const failed: string[] = [];
  for (const row of stale) {
    const { error: removeError } = await supabase.storage.from("resumes").remove([row.object_path]);
    if (removeError) {
      console.error("prune-resumes: storage delete failed", { path: row.object_path, removeError });
      failed.push(row.document_id);
      continue;
    }
    const { error: retireError } = await supabase.rpc("retire_pending_resume_upload", {
      document_id: row.document_id,
    });
    if (retireError) {
      console.error("prune-resumes: row retire failed after delete", { id: row.document_id, retireError });
      failed.push(row.document_id);
      continue;
    }
    removed += 1;
  }
  return NextResponse.json(
    { ok: failed.length === 0, removed, failed: failed.length },
    { status: failed.length === 0 ? 200 : 503 },
  );
}

export const GET = prune;
export const POST = prune;
