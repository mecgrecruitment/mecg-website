import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyFieldsSchema,
  responseSchemaFor,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  type ApplyQuestion,
} from "@/lib/apply/schema";

// SEC-21: the ONE public write path. Anon holds no DB/Storage grant; this
// handler does all writes with the service-role key. It only inserts
// candidates + application_responses and uploads to `resumes` — it exposes
// zero evaluation data in any response (EX-63).

// EX-65 / SEC-25: success and same-cycle duplicate return this same body.
const GENERIC_OK = { ok: true, message: "Application submitted." };

type Fail = { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(status: number, body: Fail, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false; // fail closed (SEC-23)

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    // EX-61 honeypot: bots that fill the hidden field get the generic
    // confirmation with no write — nothing to learn from the response.
    if (String(form.get("website") || "") !== "") {
      return Response.json(GENERIC_OK);
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    // SEC-23: Turnstile before any DB call.
    const token = String(form.get("cf-turnstile-response") || "");
    if (!token || !(await verifyTurnstile(token, ip))) {
      return fail(400, {
        ok: false,
        error: "Verification failed. Refresh the page and try again.",
      });
    }

    // EX-51: authoritative server-side validation, shared Zod schema.
    const parsed = applyFieldsSchema.safeParse({
      full_name: form.get("full_name"),
      email: form.get("email"),
      year: form.get("year"),
      major: form.get("major"),
      phone: form.get("phone") ?? "",
      linkedin_url: form.get("linkedin_url") ?? "",
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail(400, {
        ok: false,
        error: "Fix the highlighted fields and resubmit.",
        fieldErrors,
      });
    }
    const fields = parsed.data;

    // EX-55: application/pdf only, ≤10MB, validated server-side.
    const resume = form.get("resume");
    if (
      !(resume instanceof File) ||
      resume.size === 0 ||
      resume.type !== RESUME_MIME ||
      !resume.name.toLowerCase().endsWith(".pdf")
    ) {
      return fail(400, {
        ok: false,
        error: "Resume must be a PDF file.",
        fieldErrors: { resume: "Upload your resume as a PDF." },
      });
    }
    if (resume.size > RESUME_MAX_BYTES) {
      return fail(400, {
        ok: false,
        error: "Resume must be 10MB or smaller.",
        fieldErrors: { resume: "Resume must be 10MB or smaller." },
      });
    }

    const supabase = createAdminClient();

    // Applications are open only while the active cycle's window allows.
    const { data: cycle } = await supabase
      .from("recruitment_cycles")
      .select("id, applications_open_at, applications_close_at")
      .eq("is_active", true)
      .maybeSingle();

    const now = new Date();
    const open =
      cycle &&
      (!cycle.applications_open_at ||
        new Date(cycle.applications_open_at) <= now) &&
      (!cycle.applications_close_at ||
        new Date(cycle.applications_close_at) > now);
    if (!open) {
      return fail(400, {
        ok: false,
        error: "Applications are not open right now.",
      });
    }

    // Validate essays against the cycle's configured questions (EX-49/M6).
    const { data: questionRows } = await supabase
      .from("application_questions")
      .select("key, prompt, required")
      .eq("cycle_id", cycle.id)
      .order("sort_order");
    const questions: ApplyQuestion[] = questionRows ?? [];

    const responses: { key: string; question: string; response: string }[] =
      [];
    const fieldErrors: Record<string, string> = {};
    for (const q of questions) {
      const raw = String(form.get(`q_${q.key}`) || "");
      const result = responseSchemaFor(q).safeParse(raw);
      if (!result.success) {
        fieldErrors[`q_${q.key}`] = result.error.issues[0].message;
      } else if (result.data) {
        responses.push({
          key: q.key,
          question: q.prompt,
          response: result.data,
        });
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return fail(400, {
        ok: false,
        error: "Fix the highlighted fields and resubmit.",
        fieldErrors,
      });
    }

    // SEC-24 pre-check (cheap fast-fail; the RPC re-checks transactionally).
    const ipHash = createHash("sha256").update(ip).digest("hex");
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: buckets } = await supabase
      .from("apply_rate_limit")
      .select("count")
      .eq("ip_hash", ipHash)
      .gt("window_start", since);
    const used = (buckets ?? []).reduce((sum, b) => sum + b.count, 0);
    if (used >= 5) {
      return fail(
        429,
        { ok: false, error: "Too many submissions. Try again tomorrow." },
        { "Retry-After": "86400" }
      );
    }

    // EX-57: upload first, insert second. A failed insert deletes the object
    // (no dangling resume); a failed upload means no candidate row exists.
    const candidateId = randomUUID();
    const resumePath = `${candidateId}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(resumePath, resume, { contentType: RESUME_MIME });
    if (uploadError) {
      return fail(502, {
        ok: false,
        error: "Could not save your resume. Try again in a moment.",
      });
    }

    const { data: outcome, error: rpcError } = await supabase.rpc(
      "submit_application",
      {
        p_candidate_id: candidateId,
        p_ip_hash: ipHash,
        p_cycle_id: cycle.id,
        p_full_name: fields.full_name,
        p_email: fields.email,
        p_phone: fields.phone || "",
        p_year: fields.year,
        p_major: fields.major,
        p_linkedin_url: fields.linkedin_url || "",
        p_resume_storage_path: resumePath,
        p_responses: responses,
      }
    );

    if (rpcError || outcome !== "ok") {
      // Compensating cleanup: the row didn't land, so the object must go.
      await supabase.storage.from("resumes").remove([resumePath]);

      if (rpcError?.message.includes("rate_limited")) {
        return fail(
          429,
          { ok: false, error: "Too many submissions. Try again tomorrow." },
          { "Retry-After": "86400" }
        );
      }
      if (outcome === "duplicate") {
        return Response.json(GENERIC_OK); // SEC-25: enumeration-safe
      }
      return fail(500, {
        ok: false,
        error: "Something went wrong on our end. Try again in a moment.",
      });
    }

    // Opportunistic cleanup of expired rate-limit buckets; never blocks.
    await supabase.rpc("prune_apply_rate_limit");

    return Response.json(GENERIC_OK);
  } catch {
    return fail(500, {
      ok: false,
      error: "Something went wrong on our end. Try again in a moment.",
    });
  }
}
