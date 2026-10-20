"use client";

import { useState } from "react";
import SignOutAction from "@/components/sign-out-action";

export default function SignOutFixture() {
  const [open, setOpen] = useState(true);
  const [outcome, setOutcome] = useState<"reject" | "pending" | "success">("reject");
  return <main className="p-6">
    <h1>Synthetic sign-out verification</h1>
    <label>Provider response<select value={outcome} onChange={(event) => {
      const value = event.target.value;
      if (value === "reject" || value === "pending" || value === "success") setOutcome(value);
    }}><option value="reject">Reject</option><option value="pending">No acknowledgement</option><option value="success">Success</option></select></label>
    {open ? <section aria-label="Synthetic navigation"><SignOutAction className="button-primary" signOut={() => outcome === "pending" ? new Promise(() => {}) : outcome === "reject" ? Promise.reject(new Error("Synthetic provider rejection")) : Promise.resolve()} onComplete={() => setOpen(false)} /></section> : <p>Navigation closed after acknowledgement.</p>}
  </main>;
}
