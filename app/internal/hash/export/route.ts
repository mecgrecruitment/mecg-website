import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireRole } from "@/lib/internal-portal/session";

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
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function averageScore(scores: any[]) {
  if (scores.length === 0) return "";

  const avg =
    scores.reduce((sum, score) => {
      const total =
        Number(score.score_1 || 0) +
        Number(score.score_2 || 0) +
        Number(score.score_3 || 0) +
        Number(score.score_4 || 0);

      return sum + total / 4;
    }, 0) / scores.length;

  return avg.toFixed(2);
}

export async function GET() {
  await requireRole(["board"]);
  const supabase = createDemoAdminClient();

  const { data: candidates } = await supabase
    .from("demo_applications")
    .select("email,full_name,year,major,recruitment_status,status,submitted_at,created_at")
    .order("full_name", { ascending: true });

  const { data: checkins } = await supabase
    .from("demo_checkins")
    .select("email,event_name,event_id,created_at");

  const { data: scores } = await supabase
    .from("demo_candidate_scores")
    .select("*")
    .order("submitted_at", { ascending: false });

  const { data: hashVotes } = await supabase
    .from("demo_hash_votes")
    .select("*")
    .order("created_at", { ascending: false });

  const candidateList = candidates ?? [];
  const scoreList = scores ?? [];
  const hashList = hashVotes ?? [];
  const checkinList = checkins ?? [];

  const summaryRows = candidateList.map((candidate) => {
    const candidateScores = scoreList.filter(
      (score) => score.candidate_email === candidate.email
    );

    const candidateCheckins = checkinList.filter(
      (checkin) => checkin.email?.toLowerCase() === candidate.email.toLowerCase()
    );

    const candidateHashes = hashList.filter(
      (vote) => vote.candidate_email === candidate.email
    );

    const latestHash = candidateHashes[0];

    return [
      candidate.full_name,
      candidate.email,
      candidate.year,
      candidate.major,
      pretty(candidate.recruitment_status || candidate.status),
      candidateCheckins.length,
      candidateCheckins.map((checkin) => checkin.event_name).filter(Boolean).join(", "),
      averageScore(candidateScores),
      candidateScores.length,
      pretty(latestHash?.candidate_stage),
      pretty(latestHash?.decision_status || latestHash?.final_decision || latestHash?.vote),
      latestHash?.rationale || "",
      latestHash?.reviewer_email || "",
      candidate.submitted_at || candidate.created_at || "",
    ];
  });

  const hashRows = hashList.map((vote) => [
    vote.candidate_name,
    vote.candidate_email,
    pretty(vote.candidate_stage),
    pretty(vote.vote),
    pretty(vote.decision_status),
    pretty(vote.final_decision),
    vote.rationale || "",
    vote.reviewer_email || "",
    vote.created_at || "",
  ]);

  function scoreRowsFor(stage: string) {
    return scoreList
      .filter((score) => score.stage === stage)
      .map((score) => [
        score.candidate_name,
        score.candidate_email,
        score.reviewer_name,
        score.reviewer_email,
        score.team_number || "",
        score.score_1,
        score.score_2,
        score.score_3,
        score.score_4,
        averageScore([score]),
        pretty(score.recommendation),
        score.notes || "",
        score.submitted_at || "",
      ]);
  }

  const attendanceRows = checkinList.map((checkin) => [
    checkin.email,
    checkin.event_name || "",
    checkin.event_id || "",
    checkin.created_at || "",
  ]);

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
    [
      "Candidate",
      "Email",
      "Year",
      "Major",
      "Recruitment Status",
      "Attendance Count",
      "Attended Events",
      "Average Score",
      "Score Count",
      "Latest Hash Round",
      "Latest Decision",
      "Latest Rationale",
      "Latest Reviewer",
      "Submitted At",
    ],
    summaryRows
  )}

  ${worksheet(
    "Hash Votes",
    [
      "Candidate",
      "Email",
      "Round",
      "Vote",
      "Decision Status",
      "Final Decision",
      "Rationale",
      "Reviewer",
      "Created At",
    ],
    hashRows
  )}

  ${worksheet(
    "Speed Dating Scores",
    [
      "Candidate",
      "Email",
      "Reviewer",
      "Reviewer Email",
      "Team/Table",
      "Score 1",
      "Score 2",
      "Score 3",
      "Score 4",
      "Average",
      "Recommendation",
      "Notes",
      "Submitted At",
    ],
    scoreRowsFor("speed_dating")
  )}

  ${worksheet(
    "Group Case Scores",
    [
      "Candidate",
      "Email",
      "Reviewer",
      "Reviewer Email",
      "Team/Table",
      "Score 1",
      "Score 2",
      "Score 3",
      "Score 4",
      "Average",
      "Recommendation",
      "Notes",
      "Submitted At",
    ],
    scoreRowsFor("group_case")
  )}

  ${worksheet(
    "Final Round Scores",
    [
      "Candidate",
      "Email",
      "Reviewer",
      "Reviewer Email",
      "Team/Table",
      "Score 1",
      "Score 2",
      "Score 3",
      "Score 4",
      "Average",
      "Recommendation",
      "Notes",
      "Submitted At",
    ],
    scoreRowsFor("final_round")
  )}

  ${worksheet(
    "Attendance",
    ["Email", "Event", "Event ID", "Checked In At"],
    attendanceRows
  )}
</Workbook>`;

  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": "attachment; filename=mecg-board-recruitment-export.xls",
    },
  });
}
