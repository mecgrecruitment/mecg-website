import type { Metadata } from "next";
import RoundBoardPage from "../round-board";

export const metadata: Metadata = { title: "Group Case" };

export default function GroupCaseBoard() {
  return <RoundBoardPage kind="GROUP_CASE" title="Group Case" nav="/admin/group-case" />;
}
