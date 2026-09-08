"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { memberRoleLabel } from "@/lib/labels";
import {
  directoryInitials,
  filterAndSortDirectory,
  isProfileIncomplete,
  primaryDirectoryRole,
  type DirectoryEntry,
  type DirectoryRoleFilter,
  type DirectorySort,
} from "./directory-model";

const ROLE_FILTERS: Array<{ value: DirectoryRoleFilter; label: string }> = [
  { value: "ALL", label: "Everyone" },
  { value: "BOARD", label: "Board" },
  { value: "MEMBER", label: "Members" },
  { value: "RECRUITMENT_COMMITTEE", label: "Recruitment" },
  { value: "PANEL", label: "Panel" },
];

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-mecg-navy text-white",
  BOARD: "bg-mecg-orange/20 text-mecg-orange-ink",
  RECRUITMENT_COMMITTEE: "bg-mecg-blue/10 text-mecg-navy",
  PANEL: "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.22)]",
  MEMBER: "bg-mecg-navy/[0.06] text-mecg-navy/70",
};
const NO_DUPLICATE_ACCOUNT_IDS: string[] = [];

function RolePills({ roles }: { roles: string[] }) {
  const ordered = [...roles].sort((a, b) => {
    const priority = ["OWNER", "BOARD", "RECRUITMENT_COMMITTEE", "PANEL", "MEMBER"];
    return priority.indexOf(a) - priority.indexOf(b);
  });
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((role) => (
        <span key={role} className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-semibold ${ROLE_STYLE[role] ?? ROLE_STYLE.MEMBER}`}>
          {memberRoleLabel(role)}
        </span>
      ))}
    </div>
  );
}

function PersonAvatar({ person, size = "small" }: { person: DirectoryEntry; size?: "small" | "large" }) {
  const dimensions = size === "large" ? "h-24 w-24 text-2xl" : "h-14 w-14 text-sm";
  return (
    <span className={`image-outline relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mecg-blue/10 font-semibold text-mecg-navy ${dimensions}`}>
      {person.imageSrc ? <Image src={person.imageSrc} alt="" fill sizes={size === "large" ? "96px" : "56px"} className="object-cover" /> : directoryInitials(person.name)}
    </span>
  );
}

function ProfileDialog({ person, onClose }: { person: DirectoryEntry; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby="directory-profile-title" onClose={onClose} onCancel={onClose} className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 text-mecg-navy shadow-2xl backdrop:bg-mecg-navy/50 sm:w-[min(28rem,100vw)]">
      <div className="flex min-h-full flex-col p-6 sm:p-8">
        <button type="button" onClick={() => dialogRef.current?.close()} className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-xl text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] transition-[background-color,scale] hover:bg-mecg-blue/[0.08] active:scale-[0.96]" aria-label="Close profile">×</button>
        <div className="mt-4"><PersonAvatar person={person} size="large" /></div>
        <h2 id="directory-profile-title" className="mt-5 text-balance text-2xl font-semibold">{person.name}</h2>
        {person.position && <p className="mt-1 text-sm font-semibold text-mecg-orange-ink">{person.position}</p>}
        <div className="mt-4"><RolePills roles={person.roles} /></div>
        {(person.major || person.gradTerm) && (
          <dl className="mt-7 grid gap-4 rounded-2xl bg-paper p-4 sm:grid-cols-2">
            {person.major && <div><dt className="text-xs font-semibold text-mecg-navy/55">Major</dt><dd className="mt-1 text-sm">{person.major}</dd></div>}
            {person.gradTerm && <div><dt className="text-xs font-semibold text-mecg-navy/55">Graduation</dt><dd className="mt-1 text-sm">{person.gradTerm}</dd></div>}
          </dl>
        )}
        {person.bio && <p className="mt-7 text-pretty text-sm leading-7 text-mecg-navy/70">{person.bio}</p>}
        {!person.bio && !person.major && !person.gradTerm && !person.position && <p className="mt-7 text-sm leading-6 text-mecg-navy/60">This member has not added profile details yet.</p>}
        {person.linkedin && <a href={person.linkedin} target="_blank" rel="noreferrer" className="button-secondary mt-auto w-full justify-center sm:w-auto">View LinkedIn <span aria-hidden="true">↗</span></a>}
      </div>
    </dialog>
  );
}

export default function PeopleDirectory({ directory, currentUserId, canManage, duplicateAccountIds = NO_DUPLICATE_ACCOUNT_IDS }: { directory: DirectoryEntry[]; currentUserId: string; canManage: boolean; duplicateAccountIds?: string[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<DirectoryRoleFilter>("ALL");
  const [sort, setSort] = useState<DirectorySort>("NAME");
  const [layout, setLayout] = useState<"CARDS" | "LIST">("CARDS");
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  const duplicateIds = useMemo(() => new Set(duplicateAccountIds), [duplicateAccountIds]);
  const people = useMemo(() => filterAndSortDirectory(directory, query, role, sort), [directory, query, role, sort]);
  const boardCount = directory.filter((person) => person.roles.some((value) => value === "BOARD" || value === "OWNER")).length;
  const incompleteCount = directory.filter(isProfileIncomplete).length;
  const clear = () => { setQuery(""); setRole("ALL"); setSort("NAME"); };

  return (
    <section aria-labelledby="directory-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[13px] font-semibold text-mecg-navy/55">Team directory</p><h2 id="directory-heading" className="mt-1 text-xl font-semibold">Find the right person</h2></div>
        <p className="text-sm text-mecg-navy/60"><span className="tabular-nums">{directory.length}</span> people · <span className="tabular-nums">{boardCount}</span> Board{canManage ? ` · ${incompleteCount} profiles incomplete` : ""}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.09)] sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_11rem_auto]">
          <label className="relative block"><span className="sr-only">Search people</span><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-mecg-navy/40" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-control pl-10 text-base sm:text-sm" placeholder="Search name, major, position, or role" /></label>
          <label><span className="sr-only">Sort directory</span><select value={sort} onChange={(event) => setSort(event.target.value as DirectorySort)} className="select-control text-base sm:text-sm"><option value="NAME">Sort: Name</option><option value="ROLE">Sort: Role</option><option value="GRADUATION">Sort: Graduation</option></select></label>
          <div className="hidden gap-1 rounded-xl bg-mecg-navy/[0.04] p-1 sm:flex" aria-label="Directory layout">
            {(["CARDS", "LIST"] as const).map((value) => <button key={value} type="button" aria-pressed={layout === value} onClick={() => setLayout(value)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-[background-color,color,scale] active:scale-[0.96] ${layout === value ? "bg-mecg-navy text-white" : "text-mecg-navy/65 hover:bg-white"}`}>{value === "CARDS" ? "Cards" : "List"}</button>)}
          </div>
        </div>
        <div className="scroll-cue mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter directory by role">
          {ROLE_FILTERS.map((option) => <button key={option.value} type="button" aria-pressed={role === option.value} onClick={() => setRole(option.value)} className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-[background-color,color,scale] active:scale-[0.96] ${role === option.value ? "bg-mecg-navy text-white" : "bg-mecg-navy/[0.045] text-mecg-navy/70 hover:bg-mecg-blue/10"}`}>{option.label}</button>)}
        </div>
      </div>

      <p className="mt-3 text-xs text-mecg-navy/60" aria-live="polite">Showing <span className="tabular-nums">{people.length}</span> of <span className="tabular-nums">{directory.length}</span> people</p>

      {people.length > 0 && layout === "CARDS" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => {
            const board = ["BOARD", "OWNER"].includes(primaryDirectoryRole(person.roles));
            return (
              <button key={person.id} type="button" onClick={() => setSelected(person)} className={`task-row relative min-h-44 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)] ${board ? "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-mecg-orange" : ""}`}>
                <div className="flex items-start justify-between gap-3"><PersonAvatar person={person} /><span className="task-row-arrow mt-1 text-lg text-mecg-navy/35" aria-hidden="true">→</span></div>
                <p className="mt-4 text-balance text-[15px] font-semibold text-mecg-navy">{person.name}{person.id === currentUserId && <span className="ml-1.5 text-xs font-medium text-mecg-orange-ink">You</span>}</p>
                {person.position && <p className="mt-1 text-[13px] text-mecg-navy/65">{person.position}</p>}
                {(person.major || person.gradTerm) && <p className="mt-1.5 text-xs text-mecg-navy/55">{[person.major, person.gradTerm].filter(Boolean).join(" · ")}</p>}
                <div className="mt-3"><RolePills roles={person.roles} /></div>
                {canManage && (isProfileIncomplete(person) || duplicateIds.has(person.id)) && <div className="mt-3 flex flex-wrap gap-2">{isProfileIncomplete(person) && <span className="text-[11px] font-semibold text-mecg-orange-ink">Profile incomplete</span>}{duplicateIds.has(person.id) && <span className="text-[11px] font-semibold text-amber-800">Possible duplicate account</span>}</div>}
              </button>
            );
          })}
        </div>
      )}

      {people.length > 0 && layout === "LIST" && (
        <div className="mt-3 divide-y divide-mecg-navy/10 overflow-hidden rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(7,13,31,0.09)]">
          {people.map((person) => <button key={person.id} type="button" onClick={() => setSelected(person)} className="task-row grid min-h-20 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left md:grid-cols-[auto_minmax(12rem,1.2fr)_minmax(8rem,1fr)_minmax(7rem,.8fr)_auto_auto]"><PersonAvatar person={person} /><div><p className="font-semibold">{person.name}{person.id === currentUserId ? " · You" : ""}</p><p className="mt-0.5 text-xs text-mecg-navy/55">{person.position || "Team member"}</p></div><p className="hidden text-sm text-mecg-navy/65 md:block">{person.major || "—"}</p><p className="hidden text-sm text-mecg-navy/65 md:block">{person.gradTerm || "—"}</p><div className="hidden md:block"><RolePills roles={[primaryDirectoryRole(person.roles)]} /></div><span className="task-row-arrow text-lg text-mecg-navy/35" aria-hidden="true">→</span></button>)}
        </div>
      )}

      {!people.length && <div className="mt-3 rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-8 text-center"><p className="text-sm font-semibold">{directory.length ? "No people match these filters" : "No active members are in this cycle"}</p>{directory.length > 0 && <button type="button" onClick={clear} className="button-secondary mt-4">Clear filters</button>}</div>}
      {selected && <ProfileDialog person={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
