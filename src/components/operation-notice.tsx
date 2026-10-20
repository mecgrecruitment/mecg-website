export default function OperationNotice({
  kind,
  children,
  id,
}: {
  kind: "error" | "success" | "info";
  children?: React.ReactNode;
  id?: string;
}) {
  if (!children) return null;

  const appearance = {
    error: "bg-red-50 text-red-800 shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]",
    success: "bg-emerald-50 text-emerald-900 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)]",
    info: "bg-mecg-blue/[0.08] text-mecg-navy shadow-[inset_0_0_0_1px_rgba(63,99,175,0.14)]",
  }[kind];

  return (
    <p
      id={id}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={`operation-notice panel-seat rounded-xl px-4 py-3 text-sm leading-6 ${appearance}`}
    >
      {children}
    </p>
  );
}
