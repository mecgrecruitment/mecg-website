export default function ApplicantLoading() {
  return (
    <main className="min-h-dvh bg-[#f5f4ef] px-6 py-10 text-mecg-navy sm:px-10" aria-busy="true">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-12 w-2/5 rounded bg-mecg-navy/10" />
        <div className="h-64 rounded-2xl bg-mecg-navy/10" />
        <div className="h-48 rounded-2xl bg-mecg-navy/10" />
      </div>
      <p className="sr-only">Loading applicant portal.</p>
    </main>
  );
}
