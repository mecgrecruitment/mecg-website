import React from "react";
import { requireBoard } from "@/lib/auth";
import { ScoringStage } from "../ScoringStage";

export default async function FinalRoundPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  await requireBoard();
  const params = await searchParams;
  return (
    <ScoringStage
      stage="interview"
      eyebrow="Board Only"
      heading="Final round scoring."
      blurb="Board-only interview scoring for candidates currently in the interview stage."
      params={params}
    />
  );
}
