import type { Metadata } from "next";
import { redirectLegacyRound } from "../rounds/legacy-round-redirect";

export const metadata: Metadata = { title: "Group interview" };

export default function GroupCaseBoard() {
  return redirectLegacyRound("GROUP_CASE");
}
