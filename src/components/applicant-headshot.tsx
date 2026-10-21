"use client";

import { useState } from "react";
import { refreshSessionToken } from "@/lib/client-fetch";
import { initials } from "@/lib/initials";

export default function Headshot({ applicant, failed, onFail }: { applicant: { applicationId: string; name: string }; failed: boolean; onFail: () => void }) {
  // An <img> cannot retry a 401 on its own. The first failure is usually a
  // session cookie that expired while the phone slept; refresh it and ask once
  // more with a cache-busting query before settling for initials.
  const [retried, setRetried] = useState(false);
  const handleFailure = () => {
    if (retried) { onFail(); return; }
    void refreshSessionToken().finally(() => setRetried(true));
  };
  if (failed) return <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-wash text-xs font-semibold text-muted" aria-hidden="true">{initials(applicant.name)}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
    <img
      src={`/api/admin/applications/${encodeURIComponent(applicant.applicationId)}/headshot${retried ? "?retry=1" : ""}`}
      alt=""
      loading="lazy"
      className="size-11 shrink-0 rounded-full object-cover"
      // The server-rendered img can fail before React attaches onError, so also check on mount.
      ref={(node) => { if (node?.complete && node.naturalWidth === 0) handleFailure(); }}
      onError={handleFailure}
    />
  );
}
