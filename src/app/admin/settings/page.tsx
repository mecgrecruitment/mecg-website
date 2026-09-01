import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { CycleControls } from "../rush-controls";
import QuestionEditor, { type IntakeQuestion } from "./question-editor";

export const metadata: Metadata = { title: "Cycle settings" };

const INPUT_TYPES = new Set(["short_text", "long_text", "url", "select"]);

// A malformed row must not silently render as an empty editor, which would then
// save an empty question set over a good one.
function parseQuestions(value: unknown): IntakeQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.key !== "string" || typeof row.prompt !== "string") return [];
    const inputType = typeof row.inputType === "string" && INPUT_TYPES.has(row.inputType) ? row.inputType : "long_text";
    return [{
      key: row.key,
      prompt: row.prompt,
      inputType: inputType as IntakeQuestion["inputType"],
      required: row.required !== false,
    }];
  });
}

export default async function SettingsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const supabase = await createClient();
  const [cycleResult, questionsResult, submittedResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status,opens_at,closes_at").eq("id", cycleId).single(),
    supabase.rpc("cycle_application_questions", { target_cycle_id: cycleId }),
    // The RPC refuses edits once anyone has submitted; ask the same question up
    // front so the editor renders locked instead of failing on save.
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId).neq("status", "DRAFT"),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");
  if (questionsResult.error) console.error("cycle_application_questions failed", questionsResult.error);
  const questions = parseQuestions(questionsResult.data);

  const window = [
    ["Opens", cycle.opens_at],
    ["Closes", cycle.closes_at],
  ] as const;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Cycle settings"
        description="The workflow state that governs what everyone else in the workspace can do."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/settings" />
      <CycleControls cycleId={cycleId} cycleStatus={cycle.status} />
      <QuestionEditor cycleId={cycleId} initial={questions} locked={Boolean(submittedResult.count)} />
      <section className="rounded-2xl bg-paper p-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Application window</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {window.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-mecg-navy/45">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-mecg-navy">
                {value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Detroit" }) : "Not set"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-5 text-mecg-navy/45">
          The window is seeded with the cycle. Editing it here needs a cycle editor, which is not built yet.
        </p>
      </section>
    </main>
  );
}
