import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  checkRateLimit,
  clearAttempts,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";
import { verifyCredentials } from "@/lib/auth/users";
import { loginSchema } from "@/lib/validation/schemas";
import { getSupabase } from "@/lib/supabase/server";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit(ip);

    if (!rate.allowed) {
      const minutes = Math.ceil((rate.retryAfterMs ?? 0) / 60000);
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const valid = await verifyCredentials(username, password);

    if (!valid) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    clearAttempts(ip);
    const token = await createSessionToken({ username });
    const response = NextResponse.json({ success: true, username });

    response.cookies.set(sessionCookieOptions(token));

    try {
      const supabase = getSupabase();
      await supabase.from("activity_log").insert({
        message: `User ${username} logged in`,
        username,
      });
    } catch {
      // Login still succeeds if activity log fails
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
