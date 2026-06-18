import { redirect } from "next/navigation";
import { getSession, isDemoMode, demoCredentials } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const demo = isDemoMode() ? demoCredentials() : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-avis-grey px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 h-2 w-full rounded-full bg-avis-red" />

        <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
          <h1 className="text-4xl text-avis-red">Avis Budget Group</h1>
          <p className="mt-1 text-black/60">
            Live Reporting · Meta · Reddit · TikTok
          </p>

          <LoginForm demo={demo} />
        </div>

        <p className="mt-6 text-center text-xs text-black/40">
          Secure reporting dashboard · LSD Agency
        </p>
      </div>
    </main>
  );
}
