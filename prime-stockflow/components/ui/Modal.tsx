"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-500 flex items-end bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto rounded-t-[20px] bg-surface px-5 pt-5 pb-8">
        <div className="w-10 h-1 bg-border2 rounded mx-auto mb-4" />
        <h2 className="text-[17px] font-semibold mb-3.5">{title}</h2>
        {children}
        {actions && (
          <div className="flex gap-2.5 mt-4 flex-wrap">{actions}</div>
        )}
      </div>
    </div>
  );
}
