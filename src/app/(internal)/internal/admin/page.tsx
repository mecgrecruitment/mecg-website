import { requireBoard } from "@/lib/auth";
import { stages } from "../../../../lib/internal-data";

export default async function AdminPage() {
  await requireBoard();

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Admin</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment configuration.
        </h2>
        <p className="mt-4 text-white/54">Board-only controls for stages, rubrics, roles, and hash sessions.</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Stages</p>
          <div className="mt-6 grid gap-3">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between border-b border-white/10 py-4">
                <span className="font-bold">{stage.label}</span>
                <span className="text-sm text-[var(--orange)]">{stage.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow">Controls</p>
          <div className="mt-6 grid gap-3">
            {["Manage roles", "Edit rubrics", "Create hash session", "Export candidate data"].map((item) => (
              <button key={item} className="rounded-full border border-white/10 px-5 py-4 text-left font-bold hover:border-[var(--orange)]">
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
