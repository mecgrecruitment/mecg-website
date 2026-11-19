import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

// Standalone HTML from the hub (dashboards, demos) runs in an opaque sandboxed
// origin, so its scripts can never read the board session or call our APIs.
const SANDBOX_CSP = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Loaded only after authentication, so an anonymous request never decrypts anything.
  const { findHubFile, isBoardMember, loadConsultingHub } = await import("@/lib/consulting-hub/load");
  const { hubFileBytes } = await import("@/lib/consulting-hub/format");
  if (!isBoardMember(user)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id, name } = await params;
  const hub = await loadConsultingHub();
  if (hub.status !== "ready") return NextResponse.json({ error: "Consulting hub unavailable" }, { status: 503 });
  const file = findHubFile(hub.bundle, decodeURIComponent(id), decodeURIComponent(name));
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = new Uint8Array(hubFileBytes(hub.bundle, file));
  const encodedName = encodeURIComponent(file.name);
  return new Response(body, {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${file.inline ? "inline" : "attachment"}; filename="${file.name.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(file.sandbox ? { "Content-Security-Policy": SANDBOX_CSP } : {}),
    },
  });
}
