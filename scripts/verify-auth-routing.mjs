import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchWithTimeout,
  loadSupabaseEnv,
  requireServiceRoleKey,
} from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url: supabaseUrl, anonKey: publicKey, serviceRoleKey } = loadSupabaseEnv(root);
const serviceKey = requireServiceRoleKey(serviceRoleKey);
const baseUrl = (process.argv[2] ?? process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/u, "");
const supabaseOptions = {
  db: { schema: "rush" },
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
};
const admin = createClient(supabaseUrl, serviceKey, supabaseOptions);
const suffix = crypto.randomUUID();
const password = `${crypto.randomUUID()}Aa1!`;
const cycleId = `auth-route-${suffix}`;
const users = [];
let primaryError;

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
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.destination !== testCase.destination) {
    const diagnostic = createClient(supabaseUrl, publicKey, supabaseOptions);
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

async function fetchPage(pathname, cookie) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
}

async function expectPage(pathname, cookie) {
  const response = await fetchPage(pathname, cookie);
  if (response.status !== 200) {
    throw new Error(`${pathname} returned ${response.status}, expected 200`);
  }
  const html = await response.text();
  if (html.includes("__next-page-redirect")) {
    throw new Error(`${pathname} redirected away, expected it to render`);
  }
}

// Next.js does not always express a Server Component redirect as a 3xx. Since
// 16 it commonly answers 200 with a `__next-page-redirect` meta refresh, and
// the page body is not rendered either way. Asserting a status code here tested
// the framework's transport rather than the thing that matters, and broke on
// upgrade while the app was behaving correctly.
//
// What matters is the security property: the caller does not get the page, and
// is sent to the right place. Accept either transport, and require both.
async function expectRedirect(pathname, cookie, expectedLocation) {
  const response = await fetchPage(pathname, cookie);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location?.endsWith(expectedLocation)) {
      throw new Error(`${pathname} redirected to ${location}, expected ${expectedLocation}`);
    }
    return;
  }
  if (response.status !== 200) {
    throw new Error(`${pathname} returned ${response.status}, expected a redirect to ${expectedLocation}`);
  }
  const html = await response.text();
  const meta = html.match(/<meta id="__next-page-redirect"[^>]*url=([^"']+)/);
  if (!meta) {
    throw new Error(`${pathname} rendered instead of redirecting to ${expectedLocation}`);
  }
  if (!meta[1].endsWith(expectedLocation)) {
    throw new Error(`${pathname} redirected to ${meta[1]}, expected ${expectedLocation}`);
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

  await expectRedirect("/member", cookies.get("submitted-applicant"), "/applicant");
  await expectRedirect("/apply", cookies.get("member"), "/member");
  await expectRedirect("/login", cookies.get("board"), "/admin");
  console.log(`Authentication routing passed for ${cases.length} account states against ${baseUrl}.`);
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanupErrors = [];
  const cleanup = async (operation) => {
    try {
      const { error } = await operation();
      if (error) cleanupErrors.push(error);
    } catch (error) {
      cleanupErrors.push(error);
    }
  };
  await cleanup(() => admin.from("applications").delete().eq("id", `auth-app-${suffix}`));
  await cleanup(() => admin.from("pnms").delete().eq("id", `auth-pnm-${suffix}`));
  await cleanup(() => admin.from("memberships").delete().eq("cycle_id", cycleId));
  await cleanup(() => admin.from("rush_cycles").delete().eq("id", cycleId));
  for (const userId of users) {
    await cleanup(() => admin.auth.admin.deleteUser(userId));
  }
  if (cleanupErrors.length) {
    const cleanupError = new AggregateError(cleanupErrors, "Could not clean up every authentication routing fixture");
    if (primaryError) console.error(cleanupError);
    else throw cleanupError;
  }
}
