export const dynamic = "force-dynamic";

export default function InternalZoneLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
