type SymbolName = "axis" | "gears" | "orbit" | "signal" | "spark";

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
    strokeWidth: 1.4,
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
          <circle cx="12" cy="7" r="2.1" />
          <circle cx="6.8" cy="16.2" r="2.1" />
          <circle cx="17.2" cy="16.2" r="2.1" />
          <path d="M10.4 8.6 8.2 14.4M13.6 8.6l2.2 5.8M8.9 16.2h6.2" />
        </>
      )}
      {name === "gears" && (
        <>
          <circle cx="9.2" cy="13.4" r="3.15" />
          <circle cx="9.2" cy="13.4" r="1.15" />
          <path d="M9.2 8.7v1.15M9.2 17v1.15M4.5 13.4h1.15M12.75 13.4H13.9M5.85 10.05l.8.8M11.75 15.95l.8.8M5.85 16.75l.8-.8M11.75 10.85l.8-.8" />
          <circle cx="15.6" cy="8.4" r="2.45" />
          <circle cx="15.6" cy="8.4" r="0.9" />
          <path d="M15.6 4.7v.9M15.6 11.2v.9M11.9 8.4h.9M18.4 8.4h.9M13 5.8l.65.65M17.55 10.35l.65.65M13 11l.65-.65M17.55 6.45l.65-.65" />
        </>
      )}
      {name === "orbit" && (
        <>
          <circle cx="12" cy="12" r="2.4" />
          <ellipse cx="12" cy="12" rx="8.4" ry="3.6" transform="rotate(-32 12 12)" />
          <ellipse cx="12" cy="12" rx="8.4" ry="3.6" transform="rotate(32 12 12)" />
        </>
      )}
      {name === "signal" && (
        <>
          <path d="M5 18V11.5M10 18V7M15 18v-7.5M20 18V5" />
        </>
      )}
      {name === "spark" && (
        <path d="M12 3.2c.55 4.7 2.9 7.05 7.6 7.6-4.7.55-7.05 2.9-7.6 7.6-.55-4.7-2.9-7.05-7.6-7.6 4.7-.55 7.05-2.9 7.6-7.6Z" />
      )}
    </svg>
  );
}
