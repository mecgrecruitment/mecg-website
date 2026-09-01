import type { ComponentPropsWithoutRef } from "react";

const TONES = {
  white: "bg-white text-mecg-navy",
  paper: "bg-paper text-mecg-navy",
  softBlue: "bg-mecg-blue/[0.07] text-mecg-navy",
  blue: "bg-mecg-blue text-white",
  navy: "bg-mecg-navy text-white",
} as const;

const SPACING = {
  compact: "py-10 sm:py-12",
  standard: "py-16 sm:py-20",
} as const;

type MarketingSectionProps = ComponentPropsWithoutRef<"section"> & {
  readonly innerClassName?: string;
  readonly spacing?: keyof typeof SPACING;
  readonly tone?: keyof typeof TONES;
};

export default function MarketingSection({
  children,
  className = "",
  innerClassName = "",
  spacing = "standard",
  tone = "white",
  ...props
}: MarketingSectionProps) {
  return (
    <section
      className={`${TONES[tone]} px-6 sm:px-10 ${SPACING[spacing]} ${className}`}
      {...props}
    >
      <div className={`mx-auto max-w-6xl ${innerClassName}`}>{children}</div>
    </section>
  );
}
