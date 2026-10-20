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
    <p data-tone={dark ? "dark" : "light"} className={`section-label ${className}`}>
      {number ? (
        <>
          <span className={dark ? "text-mecg-orange" : "text-mecg-orange-ink"}>{number}</span> /{" "}
        </>
      ) : null}
      {children}
    </p>
  );
}
