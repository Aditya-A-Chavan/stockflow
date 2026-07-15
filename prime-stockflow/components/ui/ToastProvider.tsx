"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      offset={72}
      toastOptions={{
        style: {
          background: "#1a1a18",
          color: "#fff",
          borderRadius: "30px",
          fontSize: "14px",
          fontWeight: 500,
        },
      }}
    />
  );
}

export { toast } from "sonner";
