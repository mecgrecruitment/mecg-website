export default function SectionLabel({ number, children, className = "text-mecg-orange-ink" }: { number: string; children: React.ReactNode; className?: string }) {
  void number;
  return <p className={`text-sm font-semibold ${className}`}>{children}</p>;
}
