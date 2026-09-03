import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };
const APPLICATION_ID = "22222222-2222-2222-2222-222222222222";
const PATH = `${USER.id}/cycle/33333333-3333-3333-3333-333333333333.webp`;
const OLD_PATH = `${USER.id}/cycle/44444444-4444-4444-4444-444444444444.webp`;

function webpBytes(size = 32) {
  const bytes = new Uint8Array(Math.max(size, 12));
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  return bytes;
}

function uploadRequest(file: File) {
  const form = new FormData();
  form.set("headshot", file);
  return new NextRequest("http://localhost/api/apply/headshot", { method: "POST", body: form });
}

function webpRequest(bytes = webpBytes()) {
  return uploadRequest(new File([bytes], "headshot.webp", { type: "image/webp" }));
}

function jpegBytes(size = 32) {
  const bytes = new Uint8Array(Math.max(size, 3));
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
}

function jpegRequest(bytes = jpegBytes()) {
  return uploadRequest(new File([bytes], "headshot.jpg", { type: "image/jpeg" }));
}

function adminRequest() {
  return new NextRequest(`http://localhost/api/admin/applications/${APPLICATION_ID}/headshot`);
}

function adminContext() {
  return { params: Promise.resolve({ id: APPLICATION_ID }) };
}

function importUploadRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function importAdminRoute(testCase: string) {
  return import(`../../admin/applications/[id]/headshot/route.ts?case=${testCase}`) as Promise<typeof import("../../admin/applications/[id]/headshot/route.ts")>;
}

// Records what the service-role client was asked to write and delete.
function adminStorage(uploadError: unknown = null) {
  const uploaded: Array<{ path: string; bytes: Uint8Array; contentType?: string }> = [];
  const removed: string[][] = [];
  const client = {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, "candidate-photos");
        return {
          upload: async (path: string, bytes: Uint8Array, options?: { contentType?: string }) => {
            uploaded.push({ path, bytes, contentType: options?.contentType });
            return { data: uploadError ? null : { path }, error: uploadError };
          },
          remove: async (paths: string[]) => {
            removed.push(paths);
            return { data: [], error: null };
          },
        };
      },
    },
  };
  return { client, uploaded, removed };
}

test("headshot upload requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await importUploadRoute("unauthorized");

  const response = await POST(webpRequest());

  assert.equal(response.status, 401);
});

test("headshot upload rejects a file that is not declared as WebP", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await importUploadRoute("wrong-mime");

  const response = await POST(uploadRequest(new File([webpBytes()], "headshot.png", { type: "image/png" })));

  assert.equal(response.status, 400);
});

test("headshot upload rejects a file over the 1 MB limit", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await importUploadRoute("oversize");

  const response = await POST(webpRequest(webpBytes(1024 * 1024 + 1)));

  assert.equal(response.status, 400);
});

test("headshot upload rejects bytes that only claim to be WebP", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await importUploadRoute("wrong-magic");
  // A PNG renamed and relabelled: the browser-supplied MIME type says WebP.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

  const response = await POST(webpRequest(png));

  assert.equal(response.status, 400);
});

test("headshot upload stores the object the database chose and clears the old one", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const userClient = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "begin_headshot_upload") return { data: { path: PATH }, error: null };
      if (name === "attach_headshot") return { data: { previousPath: OLD_PATH }, error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const { client, uploaded, removed } = adminStorage();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importUploadRoute("success");

  const response = await POST(webpRequest());

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls.map((call) => call.name), ["begin_headshot_upload", "attach_headshot"]);
  assert.deepEqual(calls[1]?.args, { target_path: PATH });
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0]?.path, PATH);
  assert.equal(uploaded[0]?.contentType, "image/webp");
  assert.deepEqual(removed, [[OLD_PATH]]);
});

test("headshot upload removes the object when attaching it fails", async (t) => {
  const userClient = {
    rpc: async (name: string) => {
      if (name === "begin_headshot_upload") return { data: { path: PATH }, error: null };
      if (name === "attach_headshot") return { data: null, error: { code: "55000", message: "applications are closed" } };
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const { client, uploaded, removed } = adminStorage();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importUploadRoute("attach-failure");

  const response = await POST(webpRequest());

  assert.equal(response.status, 409);
  assert.equal(uploaded.length, 1);
  assert.deepEqual(removed, [[PATH]]);
});

test("admin headshot route returns forbidden when the access RPC denies the user", async (t) => {
  const client = { rpc: async () => ({ data: null, error: { code: "42501", message: "forbidden" } }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { GET } = await importAdminRoute("forbidden");

  const response = await GET(adminRequest(), adminContext());

  assert.equal(response.status, 403);
});

test("admin headshot route returns not found for an application without a photo", async (t) => {
  const client = { rpc: async () => ({ data: null, error: { code: "P0002", message: "headshot not found" } }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { GET } = await importAdminRoute("not-found");

  const response = await GET(adminRequest(), adminContext());

  assert.equal(response.status, 404);
});

test("admin headshot route streams the bytes to an authorized reviewer", async (t) => {
  const bytes = webpBytes();
  const userClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "authorize_headshot_access");
      assert.deepEqual(args, { target_application_id: APPLICATION_ID });
      return { data: PATH, error: null };
    },
  };
  const adminClient = {
    storage: { from: (bucket: string) => {
      assert.equal(bucket, "candidate-photos");
      return { download: async (path: string) => {
        assert.equal(path, PATH);
        return { data: new Blob([bytes], { type: "image/webp" }), error: null };
      } };
    } },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => adminClient } });
  const { GET } = await importAdminRoute("success");

  const response = await GET(adminRequest(), adminContext());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("cache-control"), "private, max-age=60");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

// A browser that cannot encode WebP falls back to JPEG. The photo is required
// to submit, so if the server rejected that fallback those applicants could not
// apply at all. These pin the whole fallback path end to end.
test("headshot upload accepts the JPEG fallback and mints a .jpg path", async (t) => {
  const JPG_PATH = `${USER.id}/cycle/55555555-5555-5555-5555-555555555555.jpg`;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const userClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "begin_headshot_upload") return { data: { path: JPG_PATH }, error: null };
      return { data: { previousPath: null }, error: null };
    },
  };
  const { client, uploaded } = adminStorage();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => userClient } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  const { POST } = await importUploadRoute("jpeg-success");

  const response = await POST(jpegRequest());

  assert.equal(response.status, 201);
  assert.deepEqual(calls[0]?.args, { upload_extension: "jpg" });
  assert.equal(uploaded[0]?.path, JPG_PATH);
  assert.equal(uploaded[0]?.contentType, "image/jpeg");
});

test("headshot upload still refuses a PNG, and a JPEG that is not really a JPEG", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await importUploadRoute("jpeg-reject");

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const asPng = await POST(uploadRequest(new File([png], "headshot.png", { type: "image/png" })));
  assert.equal(asPng.status, 400);

  // Declared image/jpeg, actually PNG bytes: the magic check must still catch it.
  const lying = await POST(uploadRequest(new File([png], "headshot.jpg", { type: "image/jpeg" })));
  assert.equal(lying.status, 400);
});
