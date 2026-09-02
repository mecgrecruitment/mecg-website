import type { Metadata } from "next";
import { redirectLegacyRound } from "../rounds/legacy-round-redirect";

export const metadata: Metadata = { title: "Quick chats" };

export default function SpeedDatingBoard() {
  return redirectLegacyRound("SPEED_DATING");
}
