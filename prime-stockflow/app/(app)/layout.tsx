import { BottomNav } from "@/components/nav/BottomNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSession } from "@/lib/auth/session-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      <main className="flex-1 px-4 max-w-[600px] w-full mx-auto pb-20 pt-4">
        {session && (
          <div className="flex justify-end mb-2">
            <LogoutButton username={session.username} />
          </div>
        )}
        {children}
      </main>
      <BottomNav />
    </>
  );
}
