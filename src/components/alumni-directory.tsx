"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import {
  fieldLabels, fieldLimits, filterListings, listingFields, sharedFields,
  type AlumniDirectory as Directory, type AlumniListing, type ListingField,
} from "@/lib/alumni/model";

const field = "field-control mt-2 min-h-11";
const UNCONFIRMED = "Save could not be confirmed. Reload to check before retrying.";
const hints: Partial<Record<ListingField, string>> = {
  gradTerm: "e.g. Winter 2027", major: "e.g. Industrial and Operations Engineering", employer: "Where you work or will work",
  jobTitle: "e.g. Business analyst", location: "e.g. Detroit, MI", linkedinUrl: "https://www.linkedin.com/in/…",
  contactEmail: "A personal address that lasts after graduation", note: "e.g. Recruiting for consulting, moving to Chicago",
};

async function post(url: string, payload: unknown): Promise<string | null> {
  try {
    const { response, body } = await fetchJsonWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
    if (response.ok && body && typeof body === "object" && "ok" in body && body.ok === true) return null;
    return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : UNCONFIRMED;
  } catch {
    return `${UNCONFIRMED} Your entry is still here.`;
  }
}

// Saving or removing remounts the listing form, so the success message and
// the focus live in one region the page owns.
type Announce = (message: string) => void;
function SavedNotice({ text, focusRef }: { text: string; focusRef: RefObject<HTMLParagraphElement | null> }) {
  return <p ref={focusRef} tabIndex={-1} role="status" aria-live="polite" className={text ? "text-sm leading-6 text-success" : "sr-only"}>{text}</p>;
}

function useSubmit(onSuccess: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function run(url: string, payload: unknown) {
    if (locked.current) return;
    locked.current = true; setPending(true); setError("");
    try {
      const failure = await post(url, payload);
      if (failure) { setError(failure); return; }
      onSuccess();
      router.refresh();
    } finally { locked.current = false; setPending(false); }
  }
  return { pending, error, run };
}

function ListingForm({ mine, defaults, announce }: { mine: AlumniListing | null; defaults: Directory["defaults"]; announce: Announce }) {
  const id = useId();
  const submit = useSubmit(() => announce(mine ? "Listing saved." : "You are listed. Members can find you below."));
  const start = (name: ListingField) => mine ? mine[name] : name === "gradTerm" || name === "major" ? defaults[name] : "";
  function send(form: HTMLFormElement) {
    const data = new FormData(form);
    const listing = Object.fromEntries(listingFields.map((name) => [name, String(data.get(name) ?? "")]));
    void submit.run("/api/member/alumni", { revision: mine?.revision ?? 0, listing });
  }
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); send(event.currentTarget); }}>
    <p className="text-sm leading-6 text-muted">Fill in only what you want to share. Leave a field empty and it isn’t shown. Your name comes from your profile.{!mine && (defaults.gradTerm || defaults.major) ? " Graduation term and major are filled in from your profile; clear them to keep them off your listing." : ""}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {listingFields.map((name) => <label key={name} htmlFor={`${id}-${name}`} className={`block text-sm font-semibold${name === "note" ? " sm:col-span-2" : ""}`}>{fieldLabels[name]}
        {name === "note"
          ? <textarea id={`${id}-${name}`} name={name} maxLength={fieldLimits[name]} defaultValue={start(name)} placeholder={hints[name]} className="field-control mt-2 min-h-20 py-3 text-sm" />
          : <input id={`${id}-${name}`} name={name} maxLength={fieldLimits[name]} defaultValue={start(name)} placeholder={hints[name]}
            type={name === "linkedinUrl" ? "url" : name === "contactEmail" ? "email" : "text"}
            autoComplete={name === "contactEmail" ? "email" : name === "location" ? "address-level2" : "off"} className={field} />}
      </label>)}
    </div>
    <button type="submit" className="button-primary" aria-disabled={submit.pending}>{submit.pending ? "Saving…" : mine ? "Save listing" : "List me in the directory"}</button>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function RemoveButton({ listing, label, announce }: { listing: AlumniListing; label: string; announce: Announce }) {
  const submit = useSubmit(() => announce(listing.isMine ? "You are no longer listed. Your shared details were deleted." : `${listing.name ?? "That listing"} removed from the directory.`));
  return <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void submit.run("/api/member/alumni/remove", { id: listing.isMine ? null : listing.id }); }}>
    <button type="submit" className="button-secondary" aria-disabled={submit.pending}>{submit.pending ? "Removing…" : label}{listing.isMine ? null : <span className="sr-only"> {listing.name ?? "this listing"}</span>}</button>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function Entry({ listing, canRemove, announce }: { listing: AlumniListing; canRemove: boolean; announce: Announce }) {
  const name = listing.name ?? "Name not set";
  const headline = [listing.jobTitle, listing.employer].filter(Boolean).join(", ");
  const facts = (["gradTerm", "major", "location"] as const).filter((name) => listing[name]);
  return <article className="min-w-0 space-y-3 rounded-xl bg-paper p-5">
    <header>
      <h3 className="break-words text-lg font-semibold text-mecg-navy">{name}{listing.isMine ? <span className="text-sm font-normal text-muted"> · you</span> : null}</h3>
      {headline && <p className="mt-1 break-words text-sm">{headline}</p>}
    </header>
    {facts.length > 0 && <dl className="grid gap-3 text-sm sm:grid-cols-3">
      {facts.map((name) => <div key={name} className="min-w-0"><dt className="text-xs text-muted">{fieldLabels[name]}</dt><dd className="break-words">{listing[name]}</dd></div>)}
    </dl>}
    {listing.note && <p className="whitespace-pre-line break-words text-sm leading-6"><span className="font-semibold">Happy to talk about:</span> {listing.note}</p>}
    {(listing.linkedinUrl || listing.contactEmail) && <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {listing.linkedinUrl && <a href={listing.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">LinkedIn<span className="sr-only"> profile of {name} (opens in a new tab)</span></a>}
      {listing.contactEmail && <a href={`mailto:${encodeURIComponent(listing.contactEmail).replace(/%40/g, "@")}`} className="inline-flex min-h-11 items-center break-all font-semibold text-mecg-blue underline underline-offset-4">{listing.contactEmail}</a>}
    </p>}
    {canRemove && !listing.isMine && <details className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Remove on their request<span className="sr-only"> {name}</span></summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-muted">For an alum who asked to come off the directory but can’t sign in any more. This deletes their shared details.</p>
        <RemoveButton listing={listing} label="Remove listing" announce={announce} />
      </div>
    </details>}
  </article>;
}

function Unavailable() {
  return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="alert">
    <h2 className="text-lg font-semibold">The alumni directory is unavailable</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load the directory. Reload to try again. If this is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
}

export function AlumniDirectory({ directory }: { directory: Directory | null }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const announce: Announce = (message) => { setNotice(message); requestAnimationFrame(() => noticeRef.current?.focus()); };
  if (!directory) return <Unavailable />;
  const { mine } = directory;
  const shown = filterListings(directory.entries, query);
  const shared = mine ? sharedFields(mine).map((name) => name === "linkedinUrl" ? "LinkedIn link" : name === "note" ? "note" : fieldLabels[name].toLowerCase()) : [];
  return <>
    <section aria-labelledby="my-listing-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <div>
        <h2 id="my-listing-heading" className="text-xl font-semibold text-mecg-navy">Your listing</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{mine
          ? `You are listed. Members and the board see your name${shared.length ? ` and your ${shared.join(", ")}` : " only"}.`
          : "You aren’t listed. Graduating or graduated? Add yourself so members can find you. Only members and the board see the directory; it is never public."}</p>
      </div>
      <details className="rounded-xl bg-paper p-4" open={!mine}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{mine ? "Edit what you share" : "Choose what to share"}</summary>
        <div className="mt-4"><ListingForm key={mine?.revision ?? 0} mine={mine} defaults={directory.defaults} announce={announce} /></div>
      </details>
      {mine && <div className="space-y-2">
        <p className="text-xs leading-5 text-muted">Opting out deletes your listing straight away. You can add yourself again later.</p>
        <RemoveButton listing={mine} label="Take me off the directory" announce={announce} />
      </div>}
    </section>
    <SavedNotice text={notice} focusRef={noticeRef} />
    <section aria-labelledby="directory-heading" className="space-y-4">
      <h2 id="directory-heading" className="text-xl font-semibold text-mecg-navy">Alumni</h2>
      {directory.entries.length === 0
        ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">Nobody is listed yet. Alumni appear here once they add themselves.</p>
        : <>
          <div className="space-y-2">
            <label htmlFor={`${id}-search`} className="block text-sm font-semibold sm:max-w-md">Search by name, employer, city, major or year
              <input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={field} />
            </label>
            <p role="status" aria-live="polite" className="tabular text-xs text-muted">{shown.length === directory.entries.length ? `${directory.entries.length} listed` : `Showing ${shown.length} of ${directory.entries.length}`}</p>
          </div>
          {shown.length === 0
            ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No one matches that search.</p>
            : <div className="grid gap-4 lg:grid-cols-2">{shown.map((listing) => <Entry key={listing.id} listing={listing} canRemove={directory.canRemoveOthers} announce={announce} />)}</div>}
        </>}
      <p className="text-xs leading-5 text-muted">Use these details only to reach out about careers and the club. Don’t copy the directory elsewhere.</p>
    </section>
  </>;
}
