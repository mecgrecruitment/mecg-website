"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import GradTermPicker from "@/components/grad-term-picker";
import { postMemberAction } from "@/lib/member-action";

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
export default function ProfileForm({ initial, gradBaseYear }: { initial: MemberProfile; gradBaseYear: number }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [gradTerm, setGradTerm] = useState(initial.gradTerm);

  async function save(form: HTMLFormElement) {
    if (inFlight.current) return;
    inFlight.current = true;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setNotice("");
    const result = await postMemberAction({ path: "/api/member/profile", payload: {
      displayName: data.get("displayName"), gradTerm: data.get("gradTerm"),
      major: data.get("major"), position: data.get("position"), bio: data.get("bio"),
    } });
    inFlight.current = false;
    setPending(false);
    if (result.kind === "saved") { setNotice("Profile saved."); router.refresh(); }
    else if (result.kind === "rejected") setError(result.message);
    else setError("Your profile save could not be confirmed. Your changes are still here; retry saving when your connection is available.");
  }

  return (
    <form
      className="rounded-xl bg-paper p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <p className="text-[13px] font-semibold text-muted">Your profile</p>
      <h3 className="mt-2 text-lg font-semibold">How you appear in the directory</h3>
      <p className="mt-1 text-sm leading-6 text-muted">Only your name is required. Nothing here is shown to applicants.</p>
      <fieldset disabled={pending} className="mt-4 min-w-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Display name" name="displayName" maxLength={120} required defaultValue={initial.displayName} placeholder="Jordan Lee" />
          <FormField label="Position" name="position" maxLength={120} defaultValue={initial.position} placeholder="Engagement lead" />
          <GradTermPicker id="profile-grad-term" name="gradTerm" value={gradTerm} onChange={setGradTerm} baseYear={gradBaseYear} legend="Graduation term" legendClassName="text-sm font-semibold text-mecg-navy" selectClassName="select-control mt-2 min-h-12" />
          <FormField label="Major" name="major" maxLength={120} defaultValue={initial.major} placeholder="Industrial Engineering" />
        </div>
        <label className="mt-3 block text-sm font-medium">
          Short bio
          <textarea
            name="bio"
            rows={3}
            maxLength={1000}
            defaultValue={initial.bio}
            className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
          />
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className="button-primary mt-4">
        {pending ? "Saving…" : "Save profile"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
    </form>
  );
}
