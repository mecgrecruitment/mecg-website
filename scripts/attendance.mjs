// Export who checked in to which rush event, for the open cycle, as
// backups/attendance-<timestamp>.csv (one row per check-in) and print a
// per-event headcount. Output holds applicant PII: backups/ is gitignored.
//
// Usage: npm run attendance
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { csvEscape, fetchRows } from "./backup-rush.mjs";
import { loadSupabaseEnv, requireServiceRoleKey } from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url, serviceRoleKey } = loadSupabaseEnv(root);
const db = createClient(url, requireServiceRoleKey(serviceRoleKey), { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "rush" } });
const TZ = "America/New_York";
const local = (d) => (d ? new Date(d).toLocaleString("en-US", { timeZone: TZ }) : "");

const cycles = await fetchRows(db, "rush_cycles", (q) => q, "created_at");
const cycle = cycles.find((c) => c.status === "OPEN") ?? cycles.at(-1);
if (!cycle) throw new Error("no rush cycles");

const events = await fetchRows(db, "events", (q) => q.eq("cycle_id", cycle.id), "starts_at");
const eventById = new Map(events.map((e) => [e.id, e]));
const checkins = (await fetchRows(db, "checkins", (q) => q.in("event_id", [...eventById.keys()]), "checked_in_at"));
const pnms = await fetchRows(db, "pnms", (q) => q.in("id", [...new Set(checkins.map((c) => c.pnm_id))]));
const pnmById = new Map(pnms.map((p) => [p.id, p]));

const header = ["event", "event_kind", "event_starts_at", "name", "preferred_name", "email", "phone", "class_year", "major", "checked_in_at"];
const rows = checkins
  .map((c) => ({ e: eventById.get(c.event_id), p: pnmById.get(c.pnm_id) ?? {}, c }))
  .sort((a, b) => a.e.starts_at.localeCompare(b.e.starts_at) || String(a.p.name).localeCompare(String(b.p.name)))
  .map(({ e, p, c }) => [e.name, e.kind, local(e.starts_at), p.name, p.preferred_name, p.contact, p.phone, p.class_year, p.major, local(c.checked_in_at)]);
const csv = `${[header, ...rows].map((r) => r.map((v) => csvEscape(String(v ?? ""))).join(",")).join("\n")}\n`;

await mkdir(join(root, "backups"), { recursive: true });
const file = join(root, "backups", `attendance-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-")}.csv`);
await writeFile(file, csv);

console.log(`${cycle.name}: ${checkins.length} check-ins, ${pnmById.size} people, ${events.length} events`);
for (const e of events) console.log(`  ${String(checkins.filter((c) => c.event_id === e.id).length).padStart(4)}  ${e.name} (${local(e.starts_at)})`);
console.log(`wrote ${file}`);
