import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-server";
import { getProfileByAuthUserId } from "@/lib/profile-completion";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AdriaGo — ENC értékesítés és útdíjkezelés",
  description:
    "Webalapú ENC értékesítési és útdíjkezelő rendszer — eszközrendelés, egyenlegfeltöltés, útvonalkövetés.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const profileRow = user ? await getProfileByAuthUserId(user.id) : null;
  const profileName = profileRow?.name ?? null;

  const rawName =
    profileName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    (user?.email ? user.email.split("@")[0] : undefined);
  const displayName = rawName?.trim() || "Felhasználó";

  return (
    <html
      lang="hu"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="relative flex min-h-full flex-col text-foreground">
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/40 bg-white/55 shadow-sm backdrop-blur-xl transition-shadow duration-300 hover:shadow-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <Link
                href="/"
                className="group flex items-center gap-2.5 transition-transform duration-300 hover:scale-[1.02]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-sm font-bold text-white shadow-md shadow-primary/25 transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-primary/35">
                  AG
                </span>
                <span className="text-lg font-bold tracking-tight text-foreground">AdriaGo</span>
              </Link>
              <nav className="hidden items-center gap-0.5 text-sm font-medium md:flex">
                <Link
                  href="/dashboard"
                  className="rounded-xl px-3 py-2 text-muted transition-all duration-200 hover:bg-white/60 hover:text-foreground"
                >
                  Fiókom
                </Link>
                <Link
                  href="/order"
                  className="rounded-xl px-3 py-2 text-muted transition-all duration-200 hover:bg-white/60 hover:text-foreground"
                >
                  Rendelés
                </Link>
                <Link
                  href="/topup"
                  className="rounded-xl px-3 py-2 text-muted transition-all duration-200 hover:bg-white/60 hover:text-foreground"
                >
                  Feltöltés
                </Link>
                <Link
                  href="/kapcsolat"
                  className="rounded-xl px-3 py-2 text-muted transition-all duration-200 hover:bg-white/60 hover:text-foreground"
                >
                  Kapcsolat
                </Link>
                {user ? (
                  <Link
                    href="/dashboard"
                    className="ml-3 rounded-xl border border-slate-300/80 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-400/80 hover:bg-white"
                  >
                    Üdvözlünk, <span className="font-semibold text-slate-900">{displayName}</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="ml-3 rounded-xl border border-slate-300/85 bg-white/80 px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-300 hover:border-slate-400/85 hover:bg-white"
                    >
                      Regisztráció
                    </Link>
                    <Link
                      href="/login"
                      className="ml-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all duration-300 hover:shadow-lg hover:shadow-primary/35 hover:brightness-105"
                    >
                      Belépés
                    </Link>
                  </>
                )}
              </nav>
              <details className="relative md:hidden">
                <summary className="list-none rounded-xl border border-slate-300/85 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white">
                  Menü
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
                  <Link href="/dashboard" className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Fiókom
                  </Link>
                  <Link href="/order" className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Rendelés
                  </Link>
                  <Link href="/topup" className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Feltöltés
                  </Link>
                  <Link href="/kapcsolat" className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Kapcsolat
                  </Link>
                  {user ? (
                    <Link
                      href="/dashboard"
                      className="mt-2 block rounded-xl border border-slate-300/80 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Üdvözlünk, <span className="font-semibold text-slate-900">{displayName}</span>
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/register"
                        className="mt-2 block rounded-xl border border-slate-300/85 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Regisztráció
                      </Link>
                      <Link
                        href="/login"
                        className="mt-1 block rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Belépés
                      </Link>
                    </>
                  )}
                </div>
              </details>
            </div>
          </header>

          <main className="relative z-10 flex flex-1 flex-col">{children}</main>

          <footer className="relative z-10 border-t border-white/40 bg-white/45 backdrop-blur-lg">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
              <p>&copy; {new Date().getFullYear()} AdriaGo. Minden jog fenntartva.</p>
              <div className="flex gap-5">
                <Link href="/aszf" className="transition-colors duration-200 hover:text-foreground">
                  ÁSZF
                </Link>
                <Link href="/adatvedelem" className="transition-colors duration-200 hover:text-foreground">
                  Adatvédelem
                </Link>
                <Link href="/kapcsolat" className="transition-colors duration-200 hover:text-foreground">
                  Kapcsolat
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
