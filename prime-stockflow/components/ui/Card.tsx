export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-border bg-surface p-4 mb-3 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between mb-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-text3 mt-5 mb-2.5 first:mt-0">
      {children}
    </h3>
  );
}

export function EmptyState({
  message,
  icon,
}: {
  message: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-5 text-text2">
      {icon && <div className="mb-3 flex justify-center text-text3">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function DataRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-b-0">
      <span className="text-[13px] text-text2">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}
