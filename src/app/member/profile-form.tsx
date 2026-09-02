"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";

export type MemberProfile = {
  displayName: string;
  gradTerm: string;
  major: string;
  position: string;
  bio: string;
};

// Everything except the name is optional. A member who fills in nothing keeps
// working exactly as before; this only exists so the directory has something to
// show and so the roster stops being a hand-edited content file.
export default function ProfileForm({ initial }: { initial: MemberProfile }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/member/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: data.get("displayName"),
          gradTerm: data.get("gradTerm"),
          major: data.get("major"),
          position: data.get("position"),
          bio: data.get("bio"),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not save your profile");
        return;
      }
      setNotice("Profile saved.");
      router.refresh();
    } catch {
      setError("Could not save your profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="rounded-2xl bg-paper p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <p className="text-[13px] font-semibold text-mecg-navy/45">Your profile</p>
      <h3 className="mt-2 text-lg font-semibold">How you appear in the directory</h3>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">Only your name is required. Nothing here is shown to applicants.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Display name" name="displayName" required defaultValue={initial.displayName} placeholder="Jordan Lee" />
        <FormField label="Position" name="position" defaultValue={initial.position} placeholder="Engagement lead" />
        <FormField label="Graduation term" name="gradTerm" defaultValue={initial.gradTerm} placeholder="Winter 2027" />
        <FormField label="Major" name="major" defaultValue={initial.major} placeholder="Industrial Engineering" />
      </div>
      <label className="mt-3 block text-sm font-medium">
        Short bio
        <textarea
          name="bio"
          rows={3}
          maxLength={1000}
          defaultValue={initial.bio}
          className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
      </label>
      <button type="submit" disabled={pending} className="button-primary mt-4">
        {pending ? "Saving…" : "Save profile"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    </form>
  );
}
