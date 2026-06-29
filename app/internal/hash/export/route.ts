import { createClient } from "@/lib/supabase/server";
import { requireBoard } from "@/lib/auth";

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pretty(value: unknown) {
  const text = String(value ?? "");
  if (!text) return "";
  return text.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function cell(value: unknown) {
  return `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}
function row(values: unknown[]) {
  return `<Row>${values.map(cell).join("")}</Row>`;
}
function worksheet(name: string, headers: string[], rows: unknown[][]) {
  return `
    <Worksheet ss:Name="${xml(name)}">
      <Table>
        ${row(headers)}
        ${rows.map(row).join("")}
      </Table>
    </Worksheet>
  `;
}

export async function GET() {
  await requireBoard();
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: candidates } = cycle
    ? await supabase
        .from("candidates")
        .select("id, per_cycle_seq, full_name, email, year, major, current_stage, status, created_at")
        .eq("cycle_id", cycle.id)
        .is("deleted_at", null)
        .order("full_name", { ascending: true })
    : { data: [] };

  const { data: scores } = await supabase.from("scores").select("candidate_id, stage, value");
  const { data: decisions } = await supabase
    .from("decisions")
    .select("candidate_id, value, rationale, created_at")
    .order("created_at", { ascending: false });
  const { data: checkins } = await supabase
    .from("event_checkins")
    .select("email, created_at, event:recruitment_events(title)");

  const candidateList = candidates ?? [];
  const scoreList = scores ?? [];
  const decisionList = decisions ?? [];
  const checkinList = checkins ?? [];

  function avgScore(candidateId: string, stage?: string) {
    const rows = scoreList.filter(
      (s) => s.candidate_id === candidateId && (!stage || s.stage === stage)
    );
    if (rows.length === 0) return "";
    return (rows.reduce((sum, s) => sum + Number(s.value || 0), 0) / rows.length).toFixed(2);
  }
  function attendanceFor(email: string | null) {
    if (!email) return 0;
    return checkinList.filter((c) => c.email?.toLowerCase() === email.toLowerCase()).length;
  }
  function latestDecision(candidateId: string) {
    return decisionList.find((d) => d.candidate_id === candidateId);
  }

  const summaryRows = candidateList.map((c) => {
    const decision = latestDecision(c.id);
    return [
      `C${String(c.per_cycle_seq).padStart(2, "0")}`,
      c.full_name,
      c.email,
      c.year,
      c.major,
      pretty(c.current_stage),
      pretty(c.status),
      attendanceFor(c.email),
      avgScore(c.id),
      pretty(decision?.value),
      decision?.rationale || "",
    ];
  });

  function scoreRowsFor(stage: string) {
    return candidateList
      .map((c) => {
        const avg = avgScore(c.id, stage);
        if (!avg) return null;
        return [c.full_name, c.email, pretty(stage), avg];
      })
      .filter(Boolean) as unknown[][];
  }

  const decisionRows = decisionList.map((d) => {
    const c = candidateList.find((x) => x.id === d.candidate_id);
    return [c?.full_name || "", c?.email || "", pretty(d.value), d.rationale || "", d.created_at || ""];
  });

  const attendanceRows = checkinList.map((c) => {
    const event = c.event as { title?: string } | { title?: string }[] | null;
    const title = Array.isArray(event) ? event[0]?.title : event?.title;
    return [c.email, title || "", c.created_at || ""];
  });

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>MECG Board Hash Export</Title>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top"/>
      <Font ss:FontName="Arial" ss:Size="11"/>
    </Style>
  </Styles>

  ${worksheet(
    "Summary",
    ["Code", "Candidate", "Email", "Year", "Major", "Stage", "Status", "Attendance", "Avg Score", "Decision", "Rationale"],
    summaryRows
  )}

  ${worksheet("Decisions", ["Candidate", "Email", "Decision", "Rationale", "Decided At"], decisionRows)}

  ${worksheet("Speed Dating Scores", ["Candidate", "Email", "Stage", "Avg Score"], scoreRowsFor("speed_dating"))}
  ${worksheet("Group Case Scores", ["Candidate", "Email", "Stage", "Avg Score"], scoreRowsFor("group_case"))}
  ${worksheet("Interview Scores", ["Candidate", "Email", "Stage", "Avg Score"], scoreRowsFor("interview"))}

  ${worksheet("Attendance", ["Email", "Event", "Checked In At"], attendanceRows)}
</Workbook>`;

  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": "attachment; filename=mecg-board-recruitment-export.xls",
    },
  });
}
