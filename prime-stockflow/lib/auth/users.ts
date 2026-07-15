import bcrypt from "bcryptjs";

export type AppUsers = Record<string, string>;

export function parseAppUsers(): AppUsers {
  const raw = process.env.APP_USERS;
  if (!raw) {
    throw new Error("APP_USERS environment variable is not set");
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("APP_USERS must be a JSON object");
    }
    return parsed as AppUsers;
  } catch {
    throw new Error("APP_USERS must be valid JSON");
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const users = parseAppUsers();
  const hash = users[username];
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
