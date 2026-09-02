import type { Metadata } from "next";
import { redirectLegacyRound } from "../rounds/legacy-round-redirect";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return redirectLegacyRound("GROUP_CASE");
}
