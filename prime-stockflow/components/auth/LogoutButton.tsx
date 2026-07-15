"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ username }: { username: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="text-xs text-text3 hover:text-text2"
    >
      {username} · Log out
    </button>
  );
}
