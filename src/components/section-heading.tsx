import type { ComponentPropsWithoutRef } from "react";

export default function SectionHeading({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={`identity-section-heading text-balance text-3xl font-semibold tracking-display sm:text-4xl ${className}`}
      {...props}
    >
      {children}
    </h2>
  );
}
