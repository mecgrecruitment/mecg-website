import PlaceholderPage from "@/components/shared/PlaceholderPage";

type HashSessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function HashSessionPage({ params }: HashSessionPageProps) {
  const { id } = await params;

  return (
    <PlaceholderPage
      title="Hash Session"
      path="/internal/hash/[id]"
      zone="internal"
      params={{ id }}
    />
  );
}
