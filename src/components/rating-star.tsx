export default function RatingStar({ state, pop = false }: { state: "filled" | "preview" | "empty"; pop?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.5" strokeLinejoin="round" className="rating-star" data-state={state} data-pop={pop || undefined} aria-hidden="true">
      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8Z" />
    </svg>
  );
}
