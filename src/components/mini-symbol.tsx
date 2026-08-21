type SymbolName = "axis" | "orbit" | "signal" | "spark";

export default function MiniSymbol({
  name,
  className = "",
}: {
  name: SymbolName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.5,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 ${className}`}
      {...common}
    >
      {name === "axis" && (
        <>
          <path d="M4 12h16M12 4v16" />
          <circle cx="12" cy="12" r="3.5" />
        </>
      )}
      {name === "orbit" && (
        <>
          <circle cx="12" cy="12" r="2.25" />
          <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-28 12 12)" />
          <circle cx="19.15" cy="7.7" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "signal" && (
        <>
          <path d="M4 18V8m5 10V4m5 14v-7m5 7V6" />
          <path d="M3 18h18" />
        </>
      )}
      {name === "spark" && (
        <path d="M12 3.5c.7 5.3 3.2 7.8 8.5 8.5-5.3.7-7.8 3.2-8.5 8.5-.7-5.3-3.2-7.8-8.5-8.5 5.3-.7 7.8-3.2 8.5-8.5Z" />
      )}
    </svg>
  );
}
