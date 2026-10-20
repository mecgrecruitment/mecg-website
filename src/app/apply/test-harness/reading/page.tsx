import { notFound } from "next/navigation";
import DossierTabs from "@/app/admin/applications/[id]/tabs";
import HarnessReady from "../harness-ready";

export default function ReadingHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-private workspace-stack mx-auto max-w-7xl">
    <h1>Fictional Board application</h1>
    <DossierTabs panels={{
      evidence: <section className="application-document" aria-label="Application responses">
        <nav className="reading-contents" aria-label="Jump to application section"><a href="#written-response">Written response</a><a href="#resume">Resume</a></nav>
        <article id="written-response" className="reading-response"><h2>Describe a difficult team decision.</h2>{Array.from({ length: 6 }, (_, index) => <p className="reading-answer" key={index}>In this fictional example, our team tested two approaches to a design problem. I recorded the observations and asked each teammate to explain the tradeoffs. We changed the recommendation after a test contradicted our initial assumption, and documented why the second approach better met the project constraints.</p>)}</article>
        <details id="resume" className="reading-resume"><summary>Resume</summary><p>No resume attached to this fictional application.</p></details>
      </section>,
      interviews: <p>Interview evidence is pending.</p>,
      decision: <label>Decision rationale<textarea aria-label="Decision rationale" className="mt-2 min-h-28 w-full border p-3" /></label>,
      messages: <p>No messages for this fictional application.</p>,
      history: <p>Fictional application submitted.</p>,
    }} />
    <HarnessReady />
  </main>;
}
