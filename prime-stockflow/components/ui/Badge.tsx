type BadgeVariant = "blue" | "green" | "warn" | "red" | "gray";

const styles: Record<BadgeVariant, string> = {
  blue: "bg-accent-bg text-accent border-accent-border",
  green: "bg-success-bg text-success border-success-border",
  warn: "bg-warn-bg text-warn border-warn-border",
  red: "bg-danger-bg text-danger border-danger-border",
  gray: "bg-surface2 text-text2 border-border",
};

export function Badge({
  children,
  variant = "gray",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusBadgeVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case "open":
      return "warn";
    case "partial":
      return "blue";
    case "ready":
      return "green";
    case "dispatched":
      return "gray";
    default:
      return "gray";
  }
}
