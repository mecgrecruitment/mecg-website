"use client";

import { useRouter } from "next/navigation";

export default function GroupForms({
  cycleId,
  groups,
  applications,
  members,
}: {
  cycleId: string;
  groups: { id: string; name: string; prompt: string }[];
  applications: { id: string; name: string }[];
  members: { group_id: string; application_id: string }[];
}) {
  const router = useRouter();
  function act(payload: Record<string, unknown>) {
    void fetch("/api/admin/rush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId, ...payload }) }).then(() => router.refresh());
  }
  return (
    <div className="grid gap-6">
      <form className="rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act({ action: "CREATE_GROUP", name: data.get("name"), prompt: data.get("prompt") }); }}>
        <h2 className="font-semibold">New team</h2>
        <input name="name" required placeholder="Team A" className="mt-2 w-full rounded border px-3 py-2" />
        <textarea name="prompt" placeholder="Engineering-flavored prompt" className="mt-2 w-full rounded border px-3 py-2" />
        <button className="mt-2 rounded border px-3 py-2">Create</button>
      </form>
      {groups.map((group) => (
        <section key={group.id} className="rounded-xl border p-4">
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-sm text-gray-600">{group.prompt}</p>
          <ul className="mt-2 text-sm">{members.filter((member) => member.group_id === group.id).map((member) => <li key={member.application_id}>{applications.find((application) => application.id === member.application_id)?.name ?? member.application_id}</li>)}</ul>
          <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act({ action: "ASSIGN_GROUP", groupId: group.id, applicationId: data.get("applicationId") }); }}>
            <select name="applicationId" className="rounded border px-2 py-1">{applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}</select>
            <button className="rounded border px-2 py-1">Assign</button>
          </form>
        </section>
      ))}
    </div>
  );
}
