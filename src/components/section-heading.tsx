import type { ComponentPropsWithoutRef } from "react";

export default function SectionHeading({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={`text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl ${className}`}
      {...props}
    >
      {children}
    </h2>
  );
}
