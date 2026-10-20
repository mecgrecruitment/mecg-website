import { notFound } from "next/navigation";
import ObservationRoster from "@/app/member/event/observation-roster";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function ObservationsHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-private workspace-stack"><h1>Synthetic observations</h1><ObservationRoster eventId="synthetic-event" rows={[
    { application_id: "synthetic-ada", applicant_name: "Ada Example", observation_id: null, tags: [], note: "" },
    { application_id: "synthetic-bo", applicant_name: "Bo Example", observation_id: null, tags: [], note: "" },
  ]} /><HarnessReady /></main>;
}
