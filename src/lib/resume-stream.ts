import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

type ResumeStorage = Pick<Awaited<ReturnType<typeof createClient>>, "storage">;

// Call only after the route's caller-scoped resume authorization succeeds.
// The signed credential stays server-side; every browser request reauthorizes.
export async function streamResume(supabase: ResumeStorage, path: string) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
    if (!error && data?.signedUrl) {
      const upstream = await fetch(data.signedUrl, { cache: "no-store" });
      if (upstream.ok && upstream.body) {
        return new NextResponse(upstream.body, {
          headers: {
            ...headers,
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="resume.pdf"',
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
  } catch {
    // Provider errors may contain the signed credential or private object path.
  }
  return NextResponse.json({ error: "The resume is temporarily unavailable" }, { status: 502, headers });
}
