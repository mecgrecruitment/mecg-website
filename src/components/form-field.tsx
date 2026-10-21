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
    <div className="workspace-field-group block text-sm font-semibold text-mecg-navy">
      <span className="flex items-baseline justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        {props.required && <span className="text-xs font-medium text-muted">Required</span>}
      </span>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={`form-field-input mt-2 min-h-12 w-full rounded-xl bg-wash px-4 font-normal text-mecg-navy inset-ring inset-ring-line-strong shadow-xs outline-none transition-[box-shadow,background-color] placeholder:text-mecg-navy/35 hover:bg-wash focus:bg-white focus:inset-ring-2 focus:inset-ring-mecg-navy focus:ring-4 focus:ring-mecg-navy/10 aria-invalid:bg-danger-wash aria-invalid:inset-ring-danger ${props.className ?? ""}`}
      />
      {hint && <span id={hintId} className="mt-2 block text-xs font-normal leading-5 text-muted">{hint}</span>}
      {error && <span id={errorId} className="mt-2 block text-xs font-normal leading-5 text-danger">{error}</span>}
    </div>
  );
}
