import { notFound } from "next/navigation";
import DeliberationDeck, { type DeckEntry } from "@/app/admin/hash/deliberate/deliberation-deck";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";

const entries: DeckEntry[] = ["Zoe Example", "Ada Example"].map((name, index) => ({
  id: `synthetic-deck-${index}`, name, major: "Synthetic data", classYear: "2028", status: "GROUP_CASE",
  result: null, groupName: null, groupCase: null, speedDating: null, rounds: [], finalScore: null,
  impressions: null, decision: null,
}));

export default function DeckTestHarnessPage() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <><DeliberationDeck entries={entries} cycleId="synthetic-deck-cycle" stage="GROUP_CASE" quorum={2} canOperate initialPresentingId={null} /><HarnessReady /></>;
}
