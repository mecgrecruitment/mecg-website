import { notFound } from "next/navigation";
import RetryButton from "@/app/admin/notifications/retry-button";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function NotificationRetryHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-private workspace-stack"><h1>Synthetic email retry</h1><RetryButton notificationId="synthetic-notification" /><HarnessReady /></main>;
}
