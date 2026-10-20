"use client";

import { useClerk } from "@clerk/nextjs";
import SignOutAction from "@/components/sign-out-action";

const DEFAULT_CLASS =
  "inline-flex min-h-11 items-center rounded-full bg-white px-4 text-xs font-semibold text-mecg-navy transition-[background-color,scale] duration-150 ease-out hover:bg-mecg-orange active:scale-[0.96] disabled:cursor-wait disabled:opacity-50 disabled:scale-100";

function ConfiguredLogoutButton({ className }: { className: string }) {
  const clerk = useClerk();
  return <SignOutAction className={className} signOut={() => clerk.signOut({ redirectUrl: "/login" })} />;
}

export default function LogoutButton({ className = DEFAULT_CLASS }: { className?: string }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) return null;
  return <ConfiguredLogoutButton className={className} />;
}
