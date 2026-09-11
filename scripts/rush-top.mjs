import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv, requireServiceRoleKey } from "./lib/supabase-env.mjs";

const { url, serviceRoleKey } = loadSupabaseEnv(resolve(import.meta.dirname, ".."));
const db = createClient(url, requireServiceRoleKey(serviceRoleKey), { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "rush" } });

const ONCE = process.env.RUSH_TOP_ONCE === "1";
const TZ = "America/New_York";
const STATUSES = ["DRAFT", "SUBMITTED", "NEEDS_INFO", "ELIGIBLE", "INVITED", "IN_PROCESS", "FINAL_REVIEW", "OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"];
const STEPS = ["details", "responses", "materials", "review", "(none)"];
const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;

const c = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const R = "\x1b[0m", B = "\x1b[1m", D = "\x1b[2m", FLASH = "\x1b[48;2;20;90;40m";
const GREEN = c(80, 220, 120), AMBER = c(240, 180, 60), BLUE = c(90, 160, 255), PURPLE = c(190, 120, 255), RED = c(255, 90, 90), GREY = c(120, 120, 130), WHITE = c(240, 240, 245);
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const vis = (s) => [...strip(s)].length;
const pad = (s, n) => s + " ".repeat(Math.max(0, n - vis(s)));
const padL = (s, n) => " ".repeat(Math.max(0, n - vis(s))) + s;
const trunc = (s, n) => { const a = [...String(s ?? "")]; return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join(""); };
const bar = (v, max, n) => { const f = max ? Math.round((v / max) * n) : 0; return "█".repeat(f) + D + "░".repeat(n - f) + R; };
const spark = (vals) => { const max = Math.max(...vals, 1); return vals.map((v) => "▁▂▃▄▅▆▇█"[v ? Math.ceil((v / max) * 7) : 0]).join(""); };
const box = (title, lines, w) => [
  `┌─ ${B}${title}${R} ${"─".repeat(Math.max(0, w - 5 - vis(title)))}┐`,
  ...lines.map((l) => `│ ${pad(l, w - 4)} │`),
  `└${"─".repeat(w - 2)}┘`,
];
const cols = (...panels) => { const h = Math.max(...panels.map((p) => p.length)); return Array.from({ length: h }, (_, i) => panels.map((p) => pad(p[i] ?? "", vis(p[0]))).join("")); };
const count = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
const ms = (d) => new Date(d).getTime();
const hhmm = (d) => new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const hourOf = (d) => new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).slice(0, 2);
const when = (d) => new Date(d).toLocaleString("en-GB", { timeZone: TZ, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const s = Math.max(0, Math.round((Date.now() - t) / 1e3)); return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`; };

async function fetchAll() {
  const cycles = await db.from("rush_cycles").select("id,name,status,opens_at,closes_at,created_at").order("created_at", { ascending: false });
  if (cycles.error) throw new Error(cycles.error.message);
  const cycle = cycles.data.find((x) => x.status === "OPEN") ?? cycles.data[0];
  if (!cycle) throw new Error("no rush cycles");
  const byCycle = (table, sel) => db.from(table).select(sel).eq("cycle_id", cycle.id);
  const [apps, questions, interest, referrals, events, checkins] = await Promise.all([
    byCycle("applications", "id,status,created_at,updated_at,submitted_at,draft_payload,pnms!inner(name,preferred_name,major)"),
    db.from("application_questions").select("id", { count: "exact", head: true }).eq("cycle_id", cycle.id),
    byCycle("interest_signups", "name,class_year,created_at"),
    byCycle("referrals", "name,year_major,status,created_at"),
    byCycle("events", "id,name,kind,starts_at,ends_at,status"),
    db.from("checkins").select("event_id,checked_in_at"),
  ]);
  for (const r of [apps, questions, interest, referrals, events, checkins]) if (r.error) throw new Error(r.error.message);
  const eventIds = new Set(events.data.map((e) => e.id));
  return { cycle, apps: apps.data, questionCount: questions.count ?? 0, interest: interest.data, referrals: referrals.data, events: events.data, checkins: checkins.data.filter((x) => eventIds.has(x.event_id)) };
}

const state = { data: null, interval: 10e3, sound: true, fetching: false, updatedAt: 0, error: null, prevConv: null, convDelta: 0, seen: null, flash: new Map(), frame: 0 };

function render() {
  const { data } = state;
  const now = Date.now(), today = dayKey(now), W = Math.max(process.stdout.columns || 100, 100);
  const out = [];
  if ((process.stdout.columns || 100) < 100) out.push(`${RED}widen terminal to 100 cols${R}`);
  if (!data) { out.push(`${B}MECG Rush Top${R}  loading…`); return out; }
  const { cycle, apps, questionCount, interest, referrals, events, checkins } = data;
  const submitted = apps.filter((a) => a.submitted_at);
  const drafts = apps.filter((a) => a.status === "DRAFT");
  const blink = state.frame % 2 === 0;

  const closes = cycle.closes_at ? ms(cycle.closes_at) - now : null;
  const countdown = closes === null ? `${D}no close date${R}` : closes <= 0 ? `${RED}closed${R}` : `${closes < DAY ? RED : ""}closes in ${Math.floor(closes / DAY)}d ${String(Math.floor((closes % DAY) / HOUR)).padStart(2, "0")}h${R}`;
  const left = `${B}${WHITE}MECG Rush Top${R}  ${cycle.name}  ${cycle.status === "OPEN" ? GREEN : AMBER}${cycle.status}${R}  ${countdown}`;
  const clock = `${D}${hhmm(now)} ET${R}`;
  out.push(pad(left, W - vis(clock)) + clock, "");

  const draftsToday = drafts.filter((a) => dayKey(a.created_at) === today).length;
  const subToday = submitted.filter((a) => dayKey(a.submitted_at) === today).length;
  const conv = drafts.length + submitted.length ? (submitted.length / (drafts.length + submitted.length)) * 100 : 0;
  const delta = state.convDelta;
  const active = apps.filter((a) => now - ms(a.updated_at) < 15 * MIN).length;
  const tiles = [
    [`${B}${WHITE}${drafts.length}${R} ${D}+${draftsToday} today${R}`, "DRAFTS"],
    [`${B}${GREEN}${submitted.length}${R} ${D}+${subToday} today${R}`, "SUBMITTED"],
    [`${B}${WHITE}${conv.toFixed(1)}%${R} ${Math.abs(delta) >= 0.05 ? (delta > 0 ? GREEN + "▲" : RED + "▼") + Math.abs(delta).toFixed(1) + "pt" + R : ""}`, "CONVERSION"],
    [`${B}${WHITE}${active}${R} ${active ? (blink ? GREEN + "●" : GREY + "●") : GREY + "○"}${R}`, "ACTIVE NOW (15m)"],
  ];
  const tw = Math.floor(W / 4);
  out.push(tiles.map((t) => pad(`  ${t[0]}`, tw)).join(""), tiles.map((t) => pad(`  ${D}${t[1]}${R}`, tw)).join(""), "");

  const half = Math.floor(W / 2), bw = half - 20;
  const stepCounts = count(drafts, (a) => (STEPS.includes(a.draft_payload?.currentStep) ? a.draft_payload.currentStep : "(none)"));
  const stepMax = Math.max(...stepCounts.values(), 1);
  const filled = drafts.reduce((n, a) => n + Object.values(a.draft_payload?.answers ?? {}).filter((v) => typeof v === "string" && v.trim()).length, 0);
  const progress = box("Draft progress", [
    ...STEPS.map((s) => `${pad(s, 10)} ${padL(String(stepCounts.get(s) ?? 0), 4)} ${bar(stepCounts.get(s) ?? 0, stepMax, bw)}`),
    `${D}answers filled: avg ${(drafts.length ? filled / drafts.length : 0).toFixed(1)} / ${questionCount}${R}`,
  ], half);
  const windows = [["15m", 15 * MIN], ["1h", HOUR], ["24h", DAY], ["7d", 7 * DAY]];
  const pulseCounts = windows.map(([, w]) => apps.filter((a) => now - ms(a.updated_at) < w).length);
  const pulse = box("Pulse (updated within)", windows.map(([l], i) => `${pad(l, 10)} ${padL(String(pulseCounts[i]), 4)} ${bar(pulseCounts[i], Math.max(...pulseCounts, 1), W - half - 20)}`), W - half);
  out.push(...cols(progress, pulse));

  const hourly = Array(24).fill(0);
  for (const a of submitted) { const i = 23 - Math.floor((now - ms(a.submitted_at)) / HOUR); if (i >= 0) hourly[i]++; }
  const peak = Math.max(...hourly), peakAt = hourly.indexOf(peak);
  out.push(...box("Submissions / hour, last 24h", [`${GREEN}${spark(hourly)}${R}  peak ${peak} @ ${hourOf(now - (23 - peakAt) * HOUR)}:00 · ${subToday} today · ${submitted.length} total`], W));

  const start = ms(cycle.opens_at ?? apps.reduce((m, a) => (a.created_at < m ? a.created_at : m), apps[0]?.created_at ?? now));
  const perDay = count(submitted, (a) => dayKey(a.submitted_at));
  const days = [];
  for (let t = start; dayKey(t) <= today && days.length < 400; t += DAY) days.push(perDay.get(dayKey(t)) ?? 0);
  const avg = days.length ? submitted.length / days.length : 0;
  const last7 = days.slice(-7), avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
  const daysLeft = closes === null ? null : Math.max(0, Math.ceil(closes / DAY));
  const proj = daysLeft === null ? "" : ` · projecting ~${Math.round(submitted.length + avg7 * daysLeft)} by close at current pace`;
  out.push(...box("Submissions / day since open", [`${GREEN}${spark(days.slice(-(W - 60)))}${R}  avg ${avg.toFixed(1)}/day${proj}`], W));

  const byStatus = count(apps, (a) => a.status), statusMax = Math.max(...byStatus.values(), 1);
  const pipeline = box("Pipeline", STATUSES.map((s) => { const n = byStatus.get(s) ?? 0; return n ? `${pad(s, 13)} ${padL(String(n), 4)} ${bar(n, statusMax, bw - 3)}` : `${D}${pad(s, 13)} ${padL("0", 4)} ${"░".repeat(bw - 3)}${R}`; }), half);
  const feedRows = [
    ...submitted.map((a) => ({ t: ms(a.submitted_at), name: a.pnms.preferred_name || a.pnms.name, major: a.pnms.major, tag: "SUBMIT", color: GREEN, id: a.id })),
    ...apps.map((a) => ({ t: ms(a.created_at), name: a.pnms.preferred_name || a.pnms.name, major: a.pnms.major, tag: "START", color: AMBER })),
    ...interest.map((x) => ({ t: ms(x.created_at), name: x.name, major: x.class_year, tag: "INTEREST", color: BLUE })),
    ...referrals.map((x) => ({ t: ms(x.created_at), name: x.name, major: x.year_major, tag: "REFERRAL", color: PURPLE })),
  ].sort((a, b) => b.t - a.t).slice(0, 8);
  const feed = box("Live feed", feedRows.map((r) => { const line = `${D}${hhmm(r.t)}${R}  ${pad(trunc(r.name, 14), 14)}  ${pad(trunc(r.major ?? "", 12), 12)}  ${r.color}${r.tag}${R}`; return r.id && (state.flash.get(r.id) ?? 0) > now ? FLASH + line.replaceAll(R, R + FLASH) + R : line; }), W - half);
  out.push(...cols(pipeline, feed));

  const third = Math.floor(W / 3);
  const majors = [...count(submitted, (a) => a.pnms.major || "(unknown)")].sort((a, b) => b[1] - a[1]);
  const top = majors.slice(0, 6), other = majors.slice(6).reduce((n, [, v]) => n + v, 0);
  const majorsPanel = box("Top majors (submitted)", [...top.map(([m, n]) => `${pad(trunc(m, third - 12), third - 12)} ${padL(String(n), 4)}`), `${D}${pad("other", third - 12)} ${padL(String(other), 4)}${R}`], third);
  const refStatus = count(referrals, (x) => x.status);
  const irPanel = box("Interest and referrals", [
    `${BLUE}interest${R}   ${interest.length} total · ${interest.filter((x) => dayKey(x.created_at) === today).length} today`,
    `${PURPLE}referrals${R}  ${referrals.length} total`,
    ...["NEW", "REVIEWED", "INVITED", "PASSED"].map((s) => `  ${D}${pad(s, 10)}${R} ${refStatus.get(s) ?? 0}`),
  ], third);
  const next = events.filter((e) => ms(e.starts_at) > now).sort((a, b) => ms(a.starts_at) - ms(b.starts_at))[0];
  const eventsPanel = box("Events", [
    next ? `${B}${trunc(next.name, W - 2 * third - 6)}${R}` : `${D}no upcoming events${R}`,
    next ? `${when(next.starts_at)} · ${next.kind}` : "",
    next ? `${checkins.filter((x) => x.event_id === next.id).length} checked in so far` : "",
    `${D}${events.length} events · ${checkins.length} checkins total${R}`,
  ], W - 2 * third);
  out.push(...cols(majorsPanel, irPanel, eventsPanel));

  const spin = state.fetching ? `${AMBER}${"◐◓◑◒"[state.frame % 4]}${R} ` : "";
  const footer = `${D}q quit · r refresh · s sound:${state.sound ? "on" : "off"} · +/- interval ${state.interval / 1e3}s · ${R}${spin}${D}updated ${state.updatedAt ? ago(state.updatedAt) : "never"}${R}`;
  out.push(state.error ? `${footer}  ${RED}${trunc(state.error, W - vis(footer) - 2)}${R}` : footer);
  return out;
}

function draw() {
  state.frame++;
  process.stdout.write((ONCE ? "" : "\x1b[H") + render().join("\n") + (ONCE ? "\n" : "\x1b[J"));
}

async function tick() {
  if (state.fetching) return;
  state.fetching = true;
  if (!ONCE) draw();
  try {
    const data = await fetchAll();
    const ids = new Set(data.apps.filter((a) => a.submitted_at).map((a) => a.id));
    const fresh = state.seen ? [...ids].filter((id) => !state.seen.has(id)) : [];
    if (fresh.length) {
      for (const id of fresh) state.flash.set(id, Date.now() + 2500);
      setTimeout(draw, 1000);
      if (state.sound) {
        process.stdout.write("\x07");
        if (process.platform === "darwin") execFile("say", ["-v", "Samantha", "New application"], () => {});
      }
    }
    const base = data.apps.filter((a) => a.submitted_at || a.status === "DRAFT").length;
    const conv = base ? (ids.size / base) * 100 : 0;
    state.convDelta = state.prevConv === null ? 0 : conv - state.prevConv;
    state.prevConv = conv;
    state.seen = ids;
    state.data = data;
    state.updatedAt = Date.now();
    state.error = null;
  } catch (err) {
    state.error = err.message ?? String(err);
  }
  state.fetching = false;
  draw();
}

if (ONCE) {
  await tick();
  if (state.error) { console.error(state.error); process.exit(1); }
  process.exit(0);
}

let pollTimer;
const schedule = () => { clearInterval(pollTimer); pollTimer = setInterval(tick, state.interval); };
const quit = () => { process.stdout.write("\x1b[?25h\x1b[?1049l"); process.exit(0); };
process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[J");
process.on("SIGTERM", quit);
process.on("SIGINT", quit);
process.stdout.on("resize", draw);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (key) => {
  if (key === "q" || key === "\x03") quit();
  if (key === "r") tick();
  if (key === "s") state.sound = !state.sound;
  if (key === "+" || key === "=") state.interval = Math.min(60e3, state.interval + 5e3);
  if (key === "-") state.interval = Math.max(5e3, state.interval - 5e3);
  if ("+=-".includes(key)) schedule();
  draw();
});
setInterval(draw, 1000);
schedule();
tick();
