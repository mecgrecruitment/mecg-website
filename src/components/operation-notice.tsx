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
    error: "bg-danger-wash text-danger inset-ring inset-ring-danger/15",
    success: "bg-success-wash text-success inset-ring inset-ring-success/15",
    info: "bg-mecg-blue/10 text-mecg-navy inset-ring inset-ring-mecg-blue/15",
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
