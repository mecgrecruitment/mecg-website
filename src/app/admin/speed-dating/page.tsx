import type { Metadata } from "next";
import RoundBoardPage from "../round-board";

export const metadata: Metadata = { title: "Speed Dating" };

export default function SpeedDatingBoard() {
  return <RoundBoardPage kind="SPEED_DATING" title="Speed Dating" nav="/admin/speed-dating" />;
}
