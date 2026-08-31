import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, ".env.local"), "utf8");
const read = (name) => source.match(new RegExp(`^${name}=["']?([^\\n"']+)`, "m"))?.[1]?.trim();
const supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL");
const publicKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");
const baseUrl = (process.argv[2] ?? process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/u, "");
if (!supabaseUrl || !publicKey || !serviceKey) throw new Error("Supabase environment is incomplete");

const admin = createClient(supabaseUrl, serviceKey, {
  db: { schema: "rush" },
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = crypto.randomUUID();
const password = `${crypto.randomUUID()}Aa1!`;
const cycleId = `auth-route-${suffix}`;
const users = [];

const cases = [
  { label: "new-applicant", destination: "/apply" },
  { label: "submitted-applicant", destination: "/applicant" },
  { label: "member", destination: "/member", role: "MEMBER" },
  { label: "board", destination: "/admin", role: "BOARD" },
  { label: "inactive", destination: "/access-denied", inactive: true },
];

function assertNoError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function login(testCase) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testCase.email, password }),
    redirect: "manual",
  });
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.destination !== testCase.destination) {
    const diagnostic = createClient(supabaseUrl, publicKey, {
      db: { schema: "rush" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await diagnostic.auth.signInWithPassword({ email: testCase.email, password });
    const results = signInError ? { signIn: signInError } : Object.fromEntries(await Promise.all([
      ["profiles", diagnostic.from("profiles").select("active").eq("id", testCase.userId).maybeSingle()],
      ["memberships", diagnostic.from("memberships").select("role, rush_cycles!inner(status)").eq("user_id", testCase.userId).eq("active", true)],
      ["is_applicant", diagnostic.rpc("is_applicant")],
    ].map(async ([label, query]) => [label, await query])));
    await diagnostic.auth.signOut();
    throw new Error(`${testCase.label} routed to ${body?.destination ?? response.status}, expected ${testCase.destination}; queries=${JSON.stringify(results)}`);
  }
  const cookie = cookieHeader(response);
  if (!cookie) throw new Error(`${testCase.label} login did not set a session cookie`);
  return cookie;
}

async function expectPage(pathname, cookie, expectedStatus = 200, expectedLocation) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} returned ${response.status}, expected ${expectedStatus}`);
  }
  if (expectedLocation) {
    const location = response.headers.get("location");
    if (!location?.endsWith(expectedLocation)) throw new Error(`${pathname} redirected to ${location}, expected ${expectedLocation}`);
  }
}

try {
  for (const testCase of cases) {
    const email = `auth-${testCase.label}-${suffix}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `Auth ${testCase.label}` },
    });
    if (error || !data.user) throw new Error(`Could not create ${testCase.label}: ${error?.message}`);
    testCase.email = email;
    testCase.userId = data.user.id;
    users.push(data.user.id);
  }

  const { error: cycleError } = await admin.from("rush_cycles").insert({ id: cycleId, name: `Auth routing ${suffix}`, status: "DRAFT" });
  assertNoError(cycleError, "create temporary cycle");

  const memberships = cases.filter((testCase) => testCase.role).map((testCase) => ({
    user_id: testCase.userId,
    cycle_id: cycleId,
    role: testCase.role,
  }));
  const { error: membershipError } = await admin.from("memberships").insert(memberships);
  assertNoError(membershipError, "create temporary memberships");

  const submittedApplicant = cases.find((testCase) => testCase.label === "submitted-applicant");
  const pnmId = `auth-pnm-${suffix}`;
  const applicationId = `auth-app-${suffix}`;
  const { error: pnmError } = await admin.from("pnms").insert({
    id: pnmId,
    auth_user_id: submittedApplicant.userId,
    name: "Auth submitted applicant",
    contact: submittedApplicant.email,
    normalized_contact: submittedApplicant.email,
  });
  assertNoError(pnmError, "create temporary applicant");
  const { error: applicationError } = await admin.from("applications").insert({
    id: applicationId,
    pnm_id: pnmId,
    cycle_id: cycleId,
    status: "SUBMITTED",
    submitted_at: new Date().toISOString(),
  });
  assertNoError(applicationError, "create temporary application");

  const inactive = cases.find((testCase) => testCase.inactive);
  const { error: inactiveError } = await admin.from("profiles").update({ active: false }).eq("id", inactive.userId);
  assertNoError(inactiveError, "deactivate temporary profile");

  const cookies = new Map();
  for (const testCase of cases) {
    const cookie = await login(testCase);
    cookies.set(testCase.label, cookie);
    await expectPage(testCase.destination, cookie);
  }

  await expectPage("/member", cookies.get("submitted-applicant"), 307, "/applicant");
  await expectPage("/apply", cookies.get("member"), 307, "/member");
  await expectPage("/login", cookies.get("board"), 307, "/admin");
  console.log(`Authentication routing passed for ${cases.length} account states against ${baseUrl}.`);
} finally {
  await admin.from("applications").delete().eq("id", `auth-app-${suffix}`);
  await admin.from("pnms").delete().eq("id", `auth-pnm-${suffix}`);
  await admin.from("memberships").delete().eq("cycle_id", cycleId);
  await admin.from("rush_cycles").delete().eq("id", cycleId);
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
}
