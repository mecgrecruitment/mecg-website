export default function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-mecg-orange">{number} / {children}</p>;
}
