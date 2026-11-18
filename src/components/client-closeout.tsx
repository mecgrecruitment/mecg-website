"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import { rehireLabels, type Closeout } from "@/lib/engagement/closeout";

const stateLabels = { ACTIVE: "Link open", EXPIRED: "Link expired", REVOKED: "Link cancelled", RECEIVED: "Feedback received" } as const;
const allowed = (value: boolean | null) => value ? "Allowed" : "Not allowed";

function errorText(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

export default function ClientCloseout({ projectId, cycleId, closeout, hasLead }: { projectId: string; cycleId: string; closeout: Closeout | undefined; hasLead: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const locked = useRef(false);

  async function act(action: "create" | "revoke") {
    if (locked.current) return;
    locked.current = true; setPending(true); setNotice(null); setCopied(false);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/projects/closeout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, projectId, cycleId }) }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        setNotice({ error: true, text: errorText(body, "The change could not be confirmed. Reload to check before retrying.") });
        return;
      }
      if (action === "revoke") {
        setLink(null);
        setNotice({ error: false, text: "Link cancelled. It no longer opens the form." });
      } else if ("link" in body && typeof body.link === "string" && "expiresAt" in body && typeof body.expiresAt === "string") {
        setLink({ url: body.link, expiresAt: body.expiresAt });
      } else {
        setNotice({ error: true, text: "The link could not be shown. Reload, then create a new one." });
      }
      router.refresh();
    } catch {
      setNotice({ error: true, text: "The change could not be confirmed. Reload to check before retrying." });
    } finally { locked.current = false; setPending(false); }
  }

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setNotice(null); } catch {
      setCopied(false);
      setNotice({ error: true, text: "Couldn’t copy automatically. Select the link above and copy it." });
    }
  }

  const received = closeout?.state === "RECEIVED" ? closeout : null;
  return <section aria-label="Client close-out" className="space-y-3 rounded-xl bg-white p-4 inset-ring inset-ring-line">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-base font-semibold">Client close-out</h4>
      <StatusPill tone={received ? "navy" : closeout?.state === "ACTIVE" ? "orange" : "neutral"}>{closeout ? stateLabels[closeout.state] : "Not requested"}</StatusPill>
    </div>

    {received ? <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">Satisfaction</dt><dd><span className="tabular">{received.satisfaction}</span> of 5</dd></div>
        <div><dt className="text-xs text-muted">Would work with us again</dt><dd>{received.wouldRehire ? rehireLabels[received.wouldRehire] : "Not answered"}</dd></div>
        {received.quote && <div className="sm:col-span-2"><dt className="text-xs text-muted">What they wrote</dt><dd className="whitespace-pre-wrap break-words">“{received.quote}”{received.attribution ? ` · ${received.attribution}` : ""}</dd></div>}
        <div><dt className="text-xs text-muted">Quote</dt><dd>{allowed(received.quotePermission)}</dd></div>
        <div><dt className="text-xs text-muted">Logo</dt><dd>{allowed(received.logoPermission)}</dd></div>
        {received.permissionScope && <div className="sm:col-span-2"><dt className="text-xs text-muted">Allowed use, in the client’s words</dt><dd className="whitespace-pre-wrap break-words">{received.permissionScope}</dd></div>}
      </dl>
      <p className="text-xs leading-5 text-muted">
        Received {received.submittedAt ? formatEasternDateTime(received.submittedAt) : ""}. {received.evidenceCreated ? `A draft evidence entry is waiting for ${received.leadName ?? "the project lead"} in Project evidence. It stays Pending and Restricted until the lead completes it and an evidence reviewer checks it.` : "The draft evidence entry was removed."} Nothing is published.
      </p>
    </> : <>
      <p className="text-sm leading-6 text-muted">
        {closeout?.state === "ACTIVE" && closeout.expiresAt
          ? `Link created ${formatEasternDateTime(closeout.requestedAt)}, open until ${formatEasternDateTime(closeout.expiresAt)}. No answer yet.`
          : "Create a one-time link and send it to the client yourself. Nothing is emailed. Their answers become a draft evidence entry for the project lead."}
      </p>
      {!hasLead && <p className="text-sm text-warning">Assign a lead before asking for feedback. The draft evidence goes to them.</p>}
      {link && <div className="space-y-2 rounded-xl bg-wash p-3">
        <label className="block text-xs font-semibold">Feedback link · shown once, copy it now
          <input readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} className="field-control mt-2 min-h-11 font-mono text-xs" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="button-secondary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          <span className="text-xs text-muted">Works once. Expires {formatEasternDateTime(link.expiresAt)}.</span>
        </div>
      </div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-secondary" disabled={pending || !hasLead} onClick={() => void act("create")}>
          {pending ? "Working…" : closeout?.state === "ACTIVE" ? "Replace link" : closeout ? "Create a new link" : "Create feedback link"}
        </button>
        {closeout?.state === "ACTIVE" && <button type="button" className="button-secondary" disabled={pending} onClick={() => void act("revoke")}>Cancel link</button>}
      </div>
      {closeout?.state === "ACTIVE" && <p className="text-xs leading-5 text-muted">Replacing or cancelling stops the earlier link from working.</p>}
    </>}
    {notice && <p role={notice.error ? "alert" : "status"} className={`text-sm leading-6 ${notice.error ? "text-danger" : "text-success"}`}>{notice.text}</p>}
  </section>;
}
