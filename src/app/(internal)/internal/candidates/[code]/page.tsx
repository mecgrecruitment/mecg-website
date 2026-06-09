import PlaceholderPage from "@/components/shared/PlaceholderPage";

type CandidateProfilePageProps = {
  params: Promise<{ code: string }>;
};

export default async function CandidateProfilePage({
  params,
}: CandidateProfilePageProps) {
  const { code } = await params;

  return (
    <PlaceholderPage
      title="Candidate Profile"
      path="/internal/candidates/[code]"
      zone="internal"
      params={{ code }}
    />
  );
}
