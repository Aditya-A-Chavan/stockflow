"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ActionResult } from "@/lib/actions/result";

export function useActionAuth<T>(
  action: () => Promise<ActionResult<T>>
): () => Promise<ActionResult<T>> {
  const router = useRouter();

  return useCallback(async () => {
    const result = await action();
    if (!result.success && result.code === "UNAUTHORIZED") {
      router.push("/login?expired=1");
    }
    return result;
  }, [action, router]);
}

export function handleActionError(result: ActionResult<unknown>): string | null {
  if (!result.success) return result.error;
  return null;
}
