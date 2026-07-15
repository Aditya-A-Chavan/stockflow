import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="px-4 pb-8">
      {params.expired && (
        <p className="text-center text-sm text-warn mt-4">
          Your session expired. Please sign in again.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
