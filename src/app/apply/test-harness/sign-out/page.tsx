import { notFound } from "next/navigation";
import HarnessReady from "../harness-ready";
import SignOutFixture from "./sign-out-fixture";

export const dynamic = "force-dynamic";
export default function SignOutTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <><SignOutFixture /><HarnessReady /></>;
}
