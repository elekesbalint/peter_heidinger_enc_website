import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-server";
import { getProfileByAuthUserId } from "@/lib/profile-completion";
import { MobileNavMenu } from "./components/mobile-nav-menu";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
      <body suppressHydrationWarning className="relative flex min-h-full flex-col overflow-x-hidden text-foreground">
        <div className="relative z-10 flex min-h-full flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-40 w-full border-b border-white/40 bg-white/55 shadow-sm backdrop-blur-xl transition-shadow duration-300 hover:shadow-md">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
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
              <MobileNavMenu user={Boolean(user)} displayName={displayName} />
            </div>
          </header>

          <main className="relative z-10 flex flex-1 flex-col">{children}</main>

          <footer className="relative z-10 border-t border-white/40 bg-gradient-to-b from-white/70 to-white/55 backdrop-blur-lg">
            <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted">
              <div className="grid gap-8 md:grid-cols-3">
                <section className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-600 text-xs font-bold text-white shadow">
                      AG
                    </span>
                    <span className="text-base font-bold tracking-tight text-foreground">AdriaGo</span>
                  </div>
                  <p className="max-w-sm leading-relaxed">
                    ENC értékesítés és útdíjkezelés egy modern platformon: rendelés, feltöltés, állapotkövetés.
                  </p>
                  <a
                    href="https://encberbeadas.hu"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex font-medium text-slate-700 transition-colors duration-200 hover:text-foreground"
                  >
                    Partner: ENCbérbeadás.hu
                  </a>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Jogi információk</h3>
                  <nav className="flex flex-col gap-2">
                    <Link href="/aszf" className="transition-colors duration-200 hover:text-foreground">
                      ÁSZF
                    </Link>
                    <Link href="/adatvedelem" className="transition-colors duration-200 hover:text-foreground">
                      Adatvédelem
                    </Link>
                    <Link href="/kapcsolat" className="transition-colors duration-200 hover:text-foreground">
                      Kapcsolat
                    </Link>
                  </nav>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Navigáció</h3>
                  <nav className="flex flex-col gap-2">
                    <Link href="/" className="transition-colors duration-200 hover:text-foreground">
                      Főoldal
                    </Link>
                    <Link href="/order" className="transition-colors duration-200 hover:text-foreground">
                      Rendelés
                    </Link>
                    <Link href="/topup" className="transition-colors duration-200 hover:text-foreground">
                      Feltöltés
                    </Link>
                    <Link href="/dashboard" className="transition-colors duration-200 hover:text-foreground">
                      Fiókom
                    </Link>
                  </nav>
                </section>
              </div>

              <div className="mt-8 border-t border-slate-200/80 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted">Biztonságos fizetés</p>
                    <Image
                      src="/barion-card-strip.png"
                      alt="Barion — Mastercard, VISA, Apple Pay, Google Pay"
                      width={300}
                      height={36}
                      className="h-8 w-auto object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted">
                    <p>&copy; {new Date().getFullYear()} AdriaGo. Minden jog fenntartva.</p>
                    <p>
                      Designed &amp; coded by{" "}
                      <a
                        href="https://balintelekes.hu"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 transition-all duration-200 hover:text-blue-500 hover:underline hover:underline-offset-2"
                      >
                        Bálint Elekes
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
