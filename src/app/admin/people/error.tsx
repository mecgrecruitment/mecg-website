"use client";

import { useEffect } from "react";
import { WorkspaceError } from "@/components/workspace-state";

export default function PeopleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("people workspace error", error); }, [error]);
  return <WorkspaceError title="People could not be loaded." description="The directory and access tools may be temporarily unavailable. Try loading them again." retry={reset} backHref="/member" backLabel="My work" />;
}
