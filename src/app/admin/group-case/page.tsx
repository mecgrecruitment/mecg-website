import type { Metadata } from "next";
import RoundBoardPage from "../round-board";

export const metadata: Metadata = { title: "Group interview" };

export default function GroupCaseBoard() {
  return <RoundBoardPage kind="GROUP_CASE" title="Group interview" nav="/admin/rounds" />;
}
