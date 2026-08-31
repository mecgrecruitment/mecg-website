import type { ReactNode } from "react";

const TONES = {
  light: "bg-white text-mecg-navy shadow-[0_16px_40px_rgba(7,13,31,0.08)]",
  paper: "bg-paper text-mecg-navy",
  accent: "bg-mecg-blue/[0.08] text-mecg-navy",
  dark: "bg-mecg-navy text-white",
  orange: "bg-mecg-orange text-mecg-navy",
  blue: "bg-mecg-blue text-white",
} as const;

const SPANS = {
  "1": "",
  "2": "sm:col-span-2",
  full: "col-span-full",
} as const;

const COLS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function BentoGrid({
  children,
  cols = 4,
  className = "",
}: {
  children: ReactNode;
  cols?: keyof typeof COLS;
  className?: string;
}) {
  return <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${COLS[cols]} ${className}`}>{children}</div>;
}

export function BentoTile({
  children,
  tone = "light",
  span = "1",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  span?: keyof typeof SPANS;
  className?: string;
}) {
  return <div className={`rounded-2xl p-5 outline outline-1 -outline-offset-1 outline-mecg-navy/[0.06] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(7,13,31,0.11)] sm:p-6 ${TONES[tone]} ${SPANS[span]} ${className}`}>{children}</div>;
}
