import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import OperationNotice from "@/components/operation-notice";
import { CloneCycleForm, CycleControls } from "../rush-controls";
import QuestionEditor, { type IntakeQuestion } from "./question-editor";
import CycleWindowForm from "./cycle-window-form";
import RecruitmentAnalyticsPanel from "./recruitment-analytics-panel";
import { parseRecruitmentAnalytics } from "./recruitment-analytics";
import { cycleStatusLabel } from "@/lib/labels";
import { screeningRpc } from "@/lib/screening-rpc";

export const metadata: Metadata = { title: "Cycle settings" };

const INPUT_TYPES = new Set(["short_text", "long_text", "url", "select"]);

// A malformed row must not silently render as an empty editor, which would then
// save an empty question set over a good one.
function parseQuestions(value: unknown): IntakeQuestion[] | null {
  if (!Array.isArray(value)) return null;
  const questions: IntakeQuestion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.key !== "string" || typeof row.prompt !== "string") return null;
    if (typeof row.inputType !== "string" || !INPUT_TYPES.has(row.inputType)) return null;
    if (!Array.isArray(row.options) || row.options.length > 50) return null;
    const options: string[] = [];
    const optionSet = new Set<string>();
    for (const option of row.options) {
      if (typeof option !== "string" || !option.trim() || option.trim().length > 200) return null;
      const normalized = option.trim();
      if (optionSet.has(normalized)) return null;
      optionSet.add(normalized);
      options.push(normalized);
    }
    if (row.inputType === "select" && options.length === 0) return null;
    const maxWords = row.maxWords == null
      ? null
      : typeof row.maxWords === "number" && Number.isInteger(row.maxWords) && row.maxWords >= 1 && row.maxWords <= 2000
        ? row.maxWords
        : undefined;
    if (maxWords === undefined) return null;
    questions.push({
      key: row.key,
      prompt: row.prompt,
      inputType: row.inputType as IntakeQuestion["inputType"],
      required: row.required !== false,
      options,
      maxWords,
    });
  }
  return questions;
}

export default async function SettingsPage() {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const supabase = await createClient();
  const [cycleResult, questionsResult, submittedResult, analyticsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status,opens_at,closes_at").eq("id", cycleId).single(),
    supabase.rpc("cycle_application_questions", { target_cycle_id: cycleId }),
    // The RPC refuses edits once anyone has submitted; ask the same question up
    // front so the editor renders locked instead of failing on save.
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId).neq("status", "DRAFT"),
    screeningRpc<unknown>(supabase, "recruitment_analytics", { target_cycle_id: cycleId }),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");
  if (questionsResult.error) console.error("cycle_application_questions failed", questionsResult.error);
  const questions = questionsResult.error ? null : parseQuestions(questionsResult.data);
  if (!questions && !questionsResult.error) console.error("cycle_application_questions returned an unusable payload", questionsResult.data);
  if (analyticsResult.error) console.error("recruitment_analytics failed", analyticsResult.error);
  const analytics = analyticsResult.error ? null : parseRecruitmentAnalytics(analyticsResult.data);
  if (!analytics && !analyticsResult.error) console.error("recruitment_analytics returned an unusable payload");

  return (
    <main className="workspace-stack mx-auto flex max-w-4xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Cycle settings"
        description="The workflow state that governs what everyone else in the workspace can do."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/settings" />
      <CycleControls cycleId={cycleId} cycleStatus={cycle.status} />
      {questions ? (
        <QuestionEditor cycleId={cycleId} initial={questions} locked={Boolean(submittedResult.count)} />
      ) : (
        <OperationNotice kind="error">
          Application questions could not be loaded safely. No changes can be made until the data is available again.
        </OperationNotice>
      )}
      {hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS") && (
        <CloneCycleForm cycleId={cycleId} cycleName={cycle.name} />
      )}
      <CycleWindowForm
        cycleId={cycleId}
        cycleStatus={cycle.status}
        opensAt={cycle.opens_at}
        closesAt={cycle.closes_at}
      />
      <RecruitmentAnalyticsPanel analytics={analytics} />
    </main>
  );
}
