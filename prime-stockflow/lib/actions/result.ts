export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: "UNAUTHORIZED" | "VALIDATION" | "SERVER" };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(
  error: string,
  code: "UNAUTHORIZED" | "VALIDATION" | "SERVER" = "SERVER"
): ActionResult<never> {
  return { success: false, error, code };
}

export function unauthorized(): ActionResult<never> {
  return { success: false, error: "Session expired. Please log in again.", code: "UNAUTHORIZED" };
}

export async function withAuth<T>(
  fn: (username: string) => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  const { getSession } = await import("@/lib/auth/session-server");
  const session = await getSession();
  if (!session) return unauthorized();
  return fn(session.username);
}
