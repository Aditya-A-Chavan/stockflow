import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Cookie-reading session helpers. These depend on `next/headers`, which is only
 * available in the Node.js server runtime — NOT in Edge middleware. Keep these
 * out of anything imported by `middleware.ts`, and import the Edge-safe token
 * primitives from `@/lib/auth/session` instead.
 */

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
