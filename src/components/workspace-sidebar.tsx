"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceNavLink } from "@/lib/workspace-navigation";

type Group = { label: string; links: readonly WorkspaceNavLink[] };

function NavigationIcon({ href }: { href: string }) {
  const path = href.split("?", 1)[0];
  const d = path === "/member" ? "M4 5h16v14H4z M4 10h16 M9 10v9"
    : path === "/admin" ? "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"
    : path.includes("screening") ? "M6 3h9l4 4v14H6z M10 11h5 M10 15h5 M14 3v5h5"
    : path.includes("rounds") || path.includes("event") ? "M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16"
    : path.includes("hash") ? "M5 4h14v17H5z M8 9l2 2 5-5 M9 16h6"
    : path.includes("messages") ? "M3 5h18v14H3z M3 6l9 7 9-7"
    : path.includes("people") || path.includes("refer") ? "M16 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M17 8h5 M19.5 5.5v5"
    : path.includes("settings") || path.includes("operations") ? "M4 7h16 M4 17h16 M8 4v6 M16 14v6"
    : "M5 4h14v17H5z M9 8h6 M9 12h6 M9 16h4";
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function WorkspaceSidebar({ current, groups, cycle, account, switcher, signOut }: {
  current: string; groups: readonly Group[]; cycle: string; account: string; switcher?: ReactNode; signOut: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [openPath, setOpenPath] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const open = openPath === locationKey;
  const previouslyOpen = useRef(false);
  useEffect(() => {
    if (previouslyOpen.current && !open && window.matchMedia("(max-width: 1023px)").matches) toggle.current?.focus({ preventScroll: true });
    previouslyOpen.current = open;
  }, [open]);
  const currentPath = current.split(/[?#]/, 1)[0];
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpenPath(null); toggle.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <aside className="workspace-sidebar" data-open={open} aria-label="Workspace navigation">
    <div className="workspace-sidebar-brand">
      <Link href="/home" aria-label="MECG home" className="workspace-wordmark"><Image src="/logos/mecg-white.svg" alt="MECG" width={128} height={38} style={{ width: 128, height: "auto" }} /></Link>
      <span className="workspace-brand-caption">{switcher ? "Recruitment workspace" : cycle}</span>
      <button ref={toggle} type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls="workspace-sidebar-content" onClick={() => setOpenPath(open ? null : locationKey)}>{open ? "Close menu" : "Menu"}</button>
    </div>
    <div className="workspace-sidebar-body" id="workspace-sidebar-content">
      {switcher && <div className="workspace-cohort">{switcher}</div>}
      <nav aria-label="Workspace" className="workspace-sidebar-groups">
        {groups.filter(group => group.links.length).map(group => <div key={group.label} className="workspace-sidebar-group"><p>{group.label}</p>{group.links.map(([href, label]) => {
          const selected = href.split(/[?#]/, 1)[0] === currentPath;
          return <Link key={href} href={href} onClick={() => setOpenPath(null)} aria-current={selected ? "page" : undefined} className="workspace-sidebar-link"><NavigationIcon href={href} /><span>{label}</span>{selected && <span className="workspace-current-mark" aria-hidden="true" />}</Link>;
        })}</div>)}
      </nav>
      <div className="workspace-sidebar-account"><span className="workspace-account-avatar" aria-hidden="true">{account.trim().charAt(0)}</span><div><p>{account}</p><Link href="/home">Back to public site</Link></div>{signOut}</div>
    </div>
  </aside>;
}
