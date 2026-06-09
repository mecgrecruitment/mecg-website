import PlaceholderPage from "@/components/shared/PlaceholderPage";

type ScorecardPageProps = {
  params: Promise<{ code: string; stage: string }>;
};

export default async function ScorecardPage({ params }: ScorecardPageProps) {
  const { code, stage } = await params;

  return (
    <PlaceholderPage
      title="Scorecard"
      path="/internal/score/[code]/[stage]"
      zone="internal"
      params={{ code, stage }}
    />
  );
}
