import { NextResponse } from "next/server";
import { currentUser, type CurrentUser } from "@/lib/auth";
import { mapRpcErrorVerbose } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { exportFilename, parseExport, projectsCsv, recordsCsv, type ExportSection } from "@/lib/cycle-records/model";

const isCycleOwner = (user: CurrentUser, cycleId: string) =>
  user.memberships.some((membership) => membership.active && membership.role === "OWNER" && membership.cycleId === cycleId);

function cycleParam(value: string | null) {
  const cycleId = value?.trim() ?? "";
  return cycleId && cycleId.length <= 100 ? cycleId : null;
}

// Download one cycle's records. Every call is an audited export in the
// database, which also re-checks that the caller is that cycle's Owner and
// withholds member-tool content the Owner is not a reviewer for.
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // A download is an audited export that can unlock archiving, so a link on
  // another site must not trigger one with the Owner's session.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Start the download from the Cycle records page." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const cycleId = cycleParam(params.get("cycleId"));
  if (!cycleId) return NextResponse.json({ error: "Choose a cycle." }, { status: 400 });
  if (!isCycleOwner(user, cycleId)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const format = params.get("format") ?? "json";
  const section = (params.get("section") ?? (format === "json" ? "all" : "records")) as ExportSection;
  if (!(format === "json" && section === "all") && !(format === "csv" && (section === "records" || section === "projects"))) {
    return NextResponse.json({ error: "Unknown export." }, { status: 400 });
  }

  const client = await createClient();
  const { data, error } = await client.rpc("export_cycle_records", { c: cycleId, section });
  if (error) {
    console.error("export_cycle_records failed", error);
    const mapped = mapRpcErrorVerbose(error, "The records could not be exported.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const exported = parseExport(data);
  if (!exported || exported.cycle.id !== cycleId) {
    console.error("export_cycle_records returned an invalid response");
    return NextResponse.json({ error: "The records could not be exported." }, { status: 500 });
  }
  const body = format === "json" ? `${JSON.stringify(exported, null, 2)}\n` : section === "records" ? recordsCsv(exported) : projectsCsv(exported);
  return new NextResponse(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename({ id: cycleId, exportedAt: exported.exportedAt }, section, format)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Archive a closed cycle. The database refuses unless an export has been
// recorded since the cycle was closed.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleId = cycleParam(new URL(request.url).searchParams.get("cycleId"));
  if (!cycleId) return NextResponse.json({ error: "Choose a cycle." }, { status: 400 });
  if (!isCycleOwner(user, cycleId)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const client = await createClient();
  const { data, error } = await client.rpc("archive_cycle_records", { c: cycleId });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "The cycle could not be archived. Reload to check its status.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const changed = !!data && typeof data === "object" && (data as { changed?: unknown }).changed === true;
  return NextResponse.json({ ok: true, changed });
}
