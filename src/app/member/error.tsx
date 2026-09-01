"use client";

import { WorkspaceError } from "@/components/workspace-state";

export default function MemberError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <WorkspaceError
      title="The member workspace could not be loaded."
      description="The problem may be temporary. Try loading your assignments again."
      retry={reset}
      backHref="/member"
      backLabel="Evaluation Hub"
    />
  );
}
