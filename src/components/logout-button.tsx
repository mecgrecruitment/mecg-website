"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

function ConfiguredLogoutButton() {
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await clerk.signOut({ redirectUrl: "/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className="text-sm underline text-gray-600 disabled:opacity-50">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

export default function LogoutButton() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) return null;
  return <ConfiguredLogoutButton />;
}
