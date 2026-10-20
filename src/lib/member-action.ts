import { authorizedFetch, fetchJsonWithTimeout } from "./client-fetch";

type MemberActionResult = { kind: "saved" } | { kind: "rejected"; message: string } | { kind: "unknown" };

/** These endpoints acknowledge writes with { ok: true }; an absent receipt is not a failed write. */
export async function postMemberAction({ path, payload }: {
  path: "/api/member/conflicts" | "/api/member/buddy" | "/api/member/profile";
  payload: Record<string, unknown>;
}): Promise<MemberActionResult> {
  try {
    const { response, body } = await fetchJsonWithTimeout(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }, 15_000, authorizedFetch);
    if (response.ok && body && typeof body === "object" && "ok" in body && body.ok === true) return { kind: "saved" };
    if (response.status >= 400 && response.status < 500 && body && typeof body === "object" && "error" in body && typeof body.error === "string") return { kind: "rejected", message: body.error };
    return { kind: "unknown" };
  } catch { return { kind: "unknown" }; }
}
