import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "default" | "primary" | "success" | "danger";

const variants: Record<Variant, string> = {
  default: "bg-surface text-text border-border2",
  primary: "bg-accent text-white border-accent",
  success: "bg-success text-white border-success",
  danger: "bg-danger text-white border-danger",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
  sm?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      full,
      sm,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
          sm ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-sm",
          full ? "w-full" : "",
          variants[variant],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
