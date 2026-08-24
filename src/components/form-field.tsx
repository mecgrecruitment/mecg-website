import type { InputHTMLAttributes } from "react";

export default function FormField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        {...props}
        className={`mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)] focus-visible:outline-2 focus-visible:outline-mecg-orange focus-visible:outline-offset-2 ${props.className ?? ""}`}
      />
    </label>
  );
}
