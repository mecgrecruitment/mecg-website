import type { InputHTMLAttributes } from "react";

export default function FormField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-semibold text-mecg-navy">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        {props.required && <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-mecg-navy/40">Required</span>}
      </span>
      <input
        {...props}
        className={`mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 font-normal text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14),0_1px_2px_rgba(7,13,31,0.03)] outline-none transition-[box-shadow,background-color] placeholder:text-mecg-navy/35 hover:bg-mecg-navy/[0.05] focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange),0_0_0_4px_rgba(244,121,32,0.1)] aria-invalid:bg-red-50 aria-invalid:shadow-[inset_0_0_0_1px_rgb(185,28,28)] ${props.className ?? ""}`}
      />
      {hint && <span className="mt-2 block text-xs font-normal leading-5 text-mecg-navy/50">{hint}</span>}
    </label>
  );
}
