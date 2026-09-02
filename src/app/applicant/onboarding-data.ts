export const ONBOARDING_LABELS: Record<string, { title: string; detail: string; selfCompletable: boolean }> = {
  CONTACT_CONFIRMATION: { title: "Confirm contact details", detail: "Verify the email MECG should use during onboarding.", selfCompletable: true },
  ORIENTATION: { title: "Attend orientation", detail: "A Board member will confirm orientation after it happens.", selfCompletable: false },
  COMMUNICATIONS_CHANNEL: { title: "Join member communications", detail: "A Board member will help add you to the member channel.", selfCompletable: false },
  PROFILE_SETUP: { title: "Review your member profile", detail: "Confirm that your name is ready for the member directory.", selfCompletable: true },
  BOARD_HANDOFF: { title: "Complete Board handoff", detail: "The Board will close the handoff when onboarding is complete.", selfCompletable: false },
};

export type ApplicantOnboardingItem = {
  applicationId: string;
  key: string;
  completedAt: string | null;
  ownerName: string | null;
  contact: string;
  cycleName: string;
};

type RpcResult<T> = Promise<{ data: T | null; error: { code?: string; message: string } | null }>;

export function onboardingRpc<T>(client: unknown, name: string, args?: Record<string, unknown>): RpcResult<T> {
  return (client as { rpc: (rpcName: string, rpcArgs?: Record<string, unknown>) => RpcResult<T> }).rpc(name, args);
}

export function parseApplicantOnboarding(value: unknown): ApplicantOnboardingItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.applicationId !== "string" || typeof row.key !== "string") return [];
    return [{
      applicationId: row.applicationId,
      key: row.key,
      completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
      ownerName: typeof row.ownerName === "string" ? row.ownerName : null,
      contact: typeof row.contact === "string" ? row.contact : "",
      cycleName: typeof row.cycleName === "string" ? row.cycleName : "",
    }];
  });
}
