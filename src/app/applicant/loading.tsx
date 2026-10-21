export default function ApplicantLoading() {
  return (
    <main className="min-h-dvh bg-paper px-6 py-10 text-mecg-navy sm:px-10" aria-busy="true">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-12 w-2/5 rounded bg-mecg-navy/10" />
        <div className="h-64 rounded-xl bg-mecg-navy/10" />
        <div className="h-48 rounded-xl bg-mecg-navy/10" />
      </div>
      <p className="sr-only">Loading applicant portal.</p>
    </main>
  );
}
