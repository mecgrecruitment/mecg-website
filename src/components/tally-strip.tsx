export type TallyState = "empty" | "partial" | "done" | "YES" | "UNSURE" | "NO";
export type TallyItem = { id: string; state: TallyState };

// One segment per person, filled as the viewer's own work lands. The caption carries the
// count for assistive tech; the segments repeat it as a shape.
export default function TallyStrip({ caption, items, dark = false }: { caption: string; items: readonly TallyItem[]; dark?: boolean }) {
  return (
    <div className="tally" data-dark={dark || undefined}>
      <p className="tally-caption" aria-live="polite">{caption}</p>
      <TallySegments items={items} />
    </div>
  );
}

export function TallySegments({ items }: { items: readonly TallyItem[] }) {
  return (
    <ol className="tally-strip" aria-hidden="true">
      {items.map((item) => <li key={item.id} data-state={item.state} />)}
    </ol>
  );
}
