// The consulting hub's documents hold named contacts, unsent outreach and
// unapproved pricing, and this repository is public. They are committed only
// as an AES-256-GCM ciphertext; the key lives in the CONSULTING_HUB_KEY
// environment variable. This module owns the container format so the build
// script that writes it and the server that reads it cannot drift apart.
//
// Plaintext container: MAGIC | u32 header length | JSON manifest | file bytes.
// Ciphertext: ENC_MAGIC | 12-byte IV | 16-byte tag | AES-256-GCM(gzip(container)).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

const MAGIC = Buffer.from("MECGHUB1");
const ENC_MAGIC = Buffer.from("MECGENC1");
const AAD = Buffer.from("mecg-consulting-hub-v1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type HubSection = { id: string; title: string; description: string };

export type HubDoc = {
  slug: string;
  title: string;
  sectionId: string;
  folder: string;
  sourcePath: string;
  updated: string;
  html: string;
  text: string;
};

export type HubFile = {
  id: string;
  name: string;
  sectionId: string;
  folder: string;
  sourcePath: string;
  mime: string;
  size: number;
  offset: number;
  inline: boolean;
  sandbox: boolean;
};

export type HubManifest = {
  version: 1;
  title: string;
  generatedAt: string;
  overviewHtml: string;
  sections: HubSection[];
  docs: HubDoc[];
  files: HubFile[];
};

export type HubBundle = { manifest: HubManifest; blob: Buffer };

export function parseHubKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value.trim(), "base64");
  return key.length === 32 ? key : null;
}

// Offsets are assigned here, so callers pass files without them.
export function packHub(
  manifest: Omit<HubManifest, "files"> & { files: Omit<HubFile, "offset" | "size">[] },
  contents: Buffer[],
): Buffer {
  if (contents.length !== manifest.files.length) throw new Error("Every hub file needs exactly one content buffer");
  let offset = 0;
  const files: HubFile[] = manifest.files.map((file, index) => {
    const placed = { ...file, offset, size: contents[index].length };
    offset += contents[index].length;
    return placed;
  });
  const header = Buffer.from(JSON.stringify({ ...manifest, files }));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  return Buffer.concat([MAGIC, length, header, ...contents]);
}

export function unpackHub(container: Buffer): HubBundle {
  if (container.length < MAGIC.length + 4 || !container.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a consulting hub container");
  }
  const headerLength = container.readUInt32BE(MAGIC.length);
  const headerStart = MAGIC.length + 4;
  const manifest = JSON.parse(container.subarray(headerStart, headerStart + headerLength).toString("utf8")) as HubManifest;
  if (manifest.version !== 1) throw new Error(`Unsupported consulting hub version ${String(manifest.version)}`);
  const blob = container.subarray(headerStart + headerLength);
  for (const file of manifest.files) {
    if (file.offset < 0 || file.offset + file.size > blob.length) throw new Error(`Hub file ${file.name} is out of bounds`);
  }
  return { manifest, blob };
}

export function encryptHub(container: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(container, { level: 9 })), cipher.final()]);
  return Buffer.concat([ENC_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

// Throws on a wrong key or tampered file: GCM authenticates before gunzip runs.
export function decryptHub(encrypted: Buffer, key: Buffer): HubBundle {
  const ivStart = ENC_MAGIC.length;
  const tagStart = ivStart + IV_BYTES;
  const bodyStart = tagStart + TAG_BYTES;
  if (encrypted.length <= bodyStart || !encrypted.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC)) {
    throw new Error("Not an encrypted consulting hub");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(ivStart, tagStart));
  decipher.setAAD(AAD);
  decipher.setAuthTag(encrypted.subarray(tagStart, bodyStart));
  const compressed = Buffer.concat([decipher.update(encrypted.subarray(bodyStart)), decipher.final()]);
  return unpackHub(gunzipSync(compressed));
}

export function hubFileBytes(bundle: HubBundle, file: HubFile): Buffer {
  return bundle.blob.subarray(file.offset, file.offset + file.size);
}
