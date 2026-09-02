import type { Metadata } from "next";
import RoundBoardPage from "../../round-board";

export const metadata: Metadata = { title: "Interview round" };

export default async function InterviewRoundPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  return <RoundBoardPage roundId={roundId} />;
}
