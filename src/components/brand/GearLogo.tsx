import React from "react";
export function GearLogo({
  className = "",
  spin = false,
}: {
  className?: string;
  spin?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${className} ${spin ? "gear-svg" : ""}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M64.8 6 69 20.2a41.7 41.7 0 0 1 9.8 4.1l13.4-7.2 10.7 10.7-7.2 13.4a41.7 41.7 0 0 1 4.1 9.8L114 55.2v15.1l-14.2 4.2a41.7 41.7 0 0 1-4.1 9.8l7.2 13.4-10.7 10.7-13.4-7.2a41.7 41.7 0 0 1-9.8 4.1L64.8 119H49.7l-4.2-14.2a41.7 41.7 0 0 1-9.8-4.1l-13.4 7.2-10.7-10.7 7.2-13.4a41.7 41.7 0 0 1-4.1-9.8L1 70.3V55.2L15.2 51a41.7 41.7 0 0 1 4.1-9.8l-7.2-13.4 10.7-10.7 13.4 7.2a41.7 41.7 0 0 1 9.8-4.1L49.7 6h15.1Z"
      />
      <circle cx="57.25" cy="62.75" r="29" fill="#050914" />
      <circle cx="57.25" cy="62.75" r="15" fill="currentColor" />
    </svg>
  );
}
