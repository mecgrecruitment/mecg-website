"use client";

export default function SegmentedControl({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <div role="group" aria-label={name} className="flex gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-[--t-detent] ease-[--ease-detent] active:scale-[0.96] ${
              selected
                ? "bg-mecg-navy text-white"
                : "text-mecg-navy inset-ring inset-ring-line-strong hover:inset-ring-mecg-navy/40"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
