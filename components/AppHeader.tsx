import Link from "next/link";
import type { Session } from "@/lib/auth";

/** Top bar shown on every authenticated page. Avis branding + nav + role + logout. */
export default function AppHeader({
  session,
  title,
}: {
  session: Session;
  title?: string;
}) {
  const isAdmin = session.role === "admin";
  return (
    <header className="sticky top-0 z-10 border-b border-avis-grey bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/avis-logo.svg"
              alt="Avis Budget Group"
              className="h-6 w-auto"
            />
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-black/60 sm:flex">
            <Link
              href="/dashboard"
              className="border-b-2 border-transparent pb-0.5 hover:border-avis-red hover:text-black"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="border-b-2 border-transparent pb-0.5 hover:border-avis-red hover:text-black"
            >
              History
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/settings"
                className="border-b-2 border-transparent pb-0.5 hover:border-avis-red hover:text-black"
              >
                Settings
              </Link>
            )}
          </nav>
        </div>

        {title && (
          <span className="hidden font-display text-sm font-bold text-black/70 md:block">
            {title}
          </span>
        )}

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isAdmin ? "bg-avis-red text-white" : "bg-avis-grey text-black/70"
            }`}
          >
            {isAdmin ? "LSD Agency" : "Avis team"}
          </span>
          <span className="hidden text-sm text-black/60 lg:inline">
            {session.email}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-avis-grey"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
