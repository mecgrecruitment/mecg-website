import type { Metadata } from "next";
import RoundBoardPage from "../round-board";

export const metadata: Metadata = { title: "Quick chats" };

export default function SpeedDatingBoard() {
  return <RoundBoardPage kind="SPEED_DATING" title="Quick chats" nav="/admin/rounds" />;
}
