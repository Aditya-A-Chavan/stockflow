import { InputHTMLAttributes, forwardRef } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="mb-3">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-text2 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-[var(--radius)] border border-border2 bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-bg ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex bg-surface2 rounded-[var(--radius)] p-1 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 text-center text-[13px] font-medium rounded-lg border-none cursor-pointer ${
            active === tab.id
              ? "bg-surface text-text shadow-sm"
              : "bg-transparent text-text2"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 100 ? "bg-success" : clamped > 50 ? "bg-accent" : "bg-warn";
  return (
    <div className="bg-surface2 rounded-full h-2 my-1.5">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
