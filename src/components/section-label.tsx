export default function SectionLabel({
  number = "",
  children,
  className = "",
  dark = false,
}: {
  number?: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}>
      {number ? (
        <>
          <span className={dark ? "text-mecg-orange" : "text-mecg-orange-ink"}>{number}</span> /{" "}
        </>
      ) : null}
      {children}
    </p>
  );
}
