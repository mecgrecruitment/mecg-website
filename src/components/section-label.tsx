export default function SectionLabel({ number, children, className = "text-mecg-orange-ink" }: { number: string; children: React.ReactNode; className?: string }) {
  return <p className={`font-mono text-xs font-medium uppercase tracking-[0.2em] ${className}`}>{number} / {children}</p>;
}
