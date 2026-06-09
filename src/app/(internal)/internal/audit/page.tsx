import { auditEvents } from "../../../../lib/internal-data";

export default function AuditPage() {
  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Audit log</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          System activity.
        </h2>
        <p className="mt-4 text-white/54">
          Board-only append-only activity trail. This will become database-backed.
        </p>
      </section>

      <section className="panel rounded-[2rem] overflow-hidden">
        {auditEvents.map((event) => (
          <article key={`${event.actor}-${event.time}`} className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-[12rem_1fr_16rem]">
            <p className="font-bold text-[var(--orange)]">{event.actor}</p>
            <p>{event.action}</p>
            <p className="text-sm text-white/42">{event.time}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
