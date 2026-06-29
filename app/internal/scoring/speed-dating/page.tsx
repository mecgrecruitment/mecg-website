import React from "react";
import { ScoringStage } from "../ScoringStage";

export default async function SpeedDatingPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <ScoringStage
      stage="speed_dating"
      eyebrow="Speed Dating"
      heading="Score your candidates."
      blurb="Score the candidates assigned to you and save responses."
      params={params}
    />
  );
}
