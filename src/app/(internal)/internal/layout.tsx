export const dynamic = "force-dynamic";

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full font-body" data-zone="internal">
      <header className="border-b border-ink/14 px-6 py-3 font-mono text-xs uppercase tracking-wide">
        MECG Internal
      </header>
      {children}
    </div>
  );
}
