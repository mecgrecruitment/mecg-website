export default function ApplyLoading() {
  return (
    <main className="min-h-dvh bg-[#f5f4ef] px-6 py-10 text-mecg-navy sm:px-10" aria-busy="true">
      <div className="mx-auto max-w-2xl animate-pulse rounded-[28px] bg-white p-8 shadow-[0_24px_80px_rgba(7,13,31,0.09)]">
        <div className="h-3 w-32 rounded bg-mecg-navy/10" />
        <div className="mt-5 h-11 w-3/4 rounded bg-mecg-navy/10" />
        <div className="mt-8 h-12 rounded-xl bg-mecg-navy/10" />
        <div className="mt-4 h-12 rounded-xl bg-mecg-navy/10" />
      </div>
      <p className="sr-only">Loading application.</p>
    </main>
  );
}
