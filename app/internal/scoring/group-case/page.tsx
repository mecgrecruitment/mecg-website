import React from "react";
import { ScoringStage } from "../ScoringStage";

export default async function GroupCasePage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <ScoringStage
      stage="group_case"
      eyebrow="Group Case"
      heading="Your assigned candidates."
      blurb="Score only the people assigned to you unless you are board."
      params={params}
    />
  );
}
