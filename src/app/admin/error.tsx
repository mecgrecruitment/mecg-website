"use client";

import { useEffect } from "react";
import { WorkspaceError } from "@/components/workspace-state";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("admin workspace error", error);
  }, [error]);

  return <WorkspaceError title="This board workspace could not be loaded." retry={reset} backHref="/member" backLabel="My work" />;
}
