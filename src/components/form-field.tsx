import { useId, type InputHTMLAttributes } from "react";

export default function FormField({
  label,
  hint,
  error,
  ...props
}: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return (
    <div className="block text-sm font-semibold text-mecg-navy">
      <span className="flex items-baseline justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        {props.required && <span className="text-[12px] font-medium text-mecg-navy/60">Required</span>}
      </span>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={`mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 font-normal text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14),0_1px_2px_rgba(7,13,31,0.03)] outline-none transition-[box-shadow,background-color] placeholder:text-mecg-navy/35 hover:bg-mecg-navy/[0.05] focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy),0_0_0_4px_rgba(7,13,31,0.1)] aria-invalid:bg-red-50 aria-invalid:shadow-[inset_0_0_0_1px_rgb(185,28,28)] ${props.className ?? ""}`}
      />
      {hint && <span id={hintId} className="mt-2 block text-xs font-normal leading-5 text-mecg-navy/60">{hint}</span>}
      {error && <span id={errorId} className="mt-2 block text-xs font-normal leading-5 text-red-700">{error}</span>}
    </div>
  );
}
