"use client";

import { UserProfile } from "@clerk/nextjs";

export default function PasswordForm() {
  return (
    <section className="surface-card overflow-hidden bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Account security</h2>
      <p className="mt-1 text-sm text-muted">Manage your password, email, and security settings through Clerk.</p>
      <div className="mt-5 overflow-x-auto">
        <UserProfile routing="hash" />
      </div>
    </section>
  );
}
