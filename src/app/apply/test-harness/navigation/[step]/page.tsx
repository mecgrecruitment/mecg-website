import PlainLink from "next/link";
import { notFound } from "next/navigation";
import Link from "@/components/workspace-link";
import WorkspaceSidebar from "@/components/workspace-sidebar";

// Stands in for a workspace page: rendered per request, with a server wait the size
// of a slow database read, so the e2e test can time what a click actually waits for.
const SERVER_WAIT_MS = 600;

export const dynamic = "force-dynamic";
export default async function NavigationHarness({ params }: { params: Promise<{ step: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > 50) notFound();
  await new Promise((resolve) => setTimeout(resolve, SERVER_WAIT_MS));
  return <>
  <WorkspaceSidebar current={`/apply/test-harness/navigation/${step}`} cycle="Sample cycle" account="Sample member" signOut={<span>Fictional session</span>} groups={[{ label: "Steps", links: [[`/apply/test-harness/navigation/${step + 10}`, `Sidebar step ${step + 10}`]] }]} />
  <main className="workspace-stack mx-auto flex w-full max-w-3xl flex-col gap-4">
    <h1 className="text-2xl font-semibold">Navigation step {step}</h1>
    <Link href={`/apply/test-harness/navigation/${step + 1}`}>Workspace link to step {step + 1}</Link>
    <PlainLink href={`/apply/test-harness/navigation/${step + 2}`}>Plain link to step {step + 2}</PlainLink>
  </main>
  </>;
}
