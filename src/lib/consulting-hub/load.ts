import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CurrentUser } from "@/lib/auth";
import { decryptHub, parseHubKey, type HubBundle, type HubDoc, type HubFile } from "./format";

// Traced into the /admin/consulting routes by outputFileTracingIncludes in next.config.ts.
export const HUB_CONTENT_PATH = path.join(process.cwd(), "content", "consulting-hub.enc");

export type HubLoadResult =
  | { status: "ready"; bundle: HubBundle }
  | { status: "missing-key" | "missing-content" | "unreadable" };

// One decrypt per server instance. Failures are not cached, so fixing the key
// or redeploying the content takes effect without a cold start.
let ready: Promise<HubLoadResult> | null = null;

async function open(): Promise<HubLoadResult> {
  const key = parseHubKey(process.env.CONSULTING_HUB_KEY);
  if (!key) return { status: "missing-key" };
  let encrypted: Buffer;
  try {
    encrypted = await readFile(HUB_CONTENT_PATH);
  } catch {
    return { status: "missing-content" };
  }
  try {
    return { status: "ready", bundle: decryptHub(encrypted, key) };
  } catch (error) {
    console.error("consulting hub could not be decrypted", error instanceof Error ? error.message : error);
    return { status: "unreadable" };
  }
}

export async function loadConsultingHub(): Promise<HubLoadResult> {
  const pending = ready ?? open();
  const result = await pending;
  ready = result.status === "ready" ? pending : null;
  return result;
}

// Mirrors requireBoard() without redirecting, for route handlers that answer with a status code.
export function isBoardMember(user: CurrentUser): boolean {
  return user.memberships.some((membership) => membership.active && ["BOARD", "OWNER"].includes(membership.role));
}

export function findHubDoc(bundle: HubBundle, slug: string): HubDoc | undefined {
  return bundle.manifest.docs.find((doc) => doc.slug === slug);
}

export function findHubFile(bundle: HubBundle, id: string, name: string): HubFile | undefined {
  return bundle.manifest.files.find((file) => file.id === id && file.name === name);
}

export const HUB_UNAVAILABLE_MESSAGE: Record<Exclude<HubLoadResult["status"], "ready">, string> = {
  "missing-key": "The hub's decryption key is not set on this deployment (CONSULTING_HUB_KEY).",
  "missing-content": "The encrypted hub content is missing from this deployment.",
  unreadable: "The hub content could not be opened with this deployment's key. Rebuild it with the current key.",
};
