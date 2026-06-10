export default function AdminPage() {
  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Admin</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Admin controls.
        </h2>
        <p className="mt-4 text-white/54">
          Demo admin area for managing cycles, roles, events, and recruitment settings.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {["Manage cycle", "Manage events", "Manage members"].map((item) => (
          <article key={item} className="panel rounded-[1.5rem] p-6">
            <p className="eyebrow">Admin</p>
            <h3 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em]">{item}</h3>
          </article>
        ))}
      </section>
    </div>
  );
}
