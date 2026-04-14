"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validateUserLoginContext(): Promise<boolean> {
    const supabase = createSupabaseBrowserClient();
    const validate = await fetch("/api/auth/validate-login-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "user" }),
      credentials: "include",
    });
    const data = (await validate.json()) as {
      ok?: boolean;
      code?: string;
      message?: string;
    };
    if (!data.ok) {
      await supabase.auth.signOut();
      setError(
        data.message ??
          "Admin fiókkal csak az admin bejelentkezés oldalon lehet belépni.",
      );
      return false;
    }
    return true;
  }

  useEffect(() => {
    let cancelled = false;

    async function handleOAuthReturn() {
      if (typeof window === "undefined") return;
      const search = new URLSearchParams(window.location.search);
      if (search.get("oauth") !== "google") return;

      setIsGoogleLoading(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setError("Google bejelentkezés nem sikerült. Próbáld újra.");
          }
          return;
        }
        const ok = await validateUserLoginContext();
        if (ok && !cancelled) {
          router.push("/dashboard");
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          setError("Google bejelentkezés közben hiba történt.");
        }
      } finally {
        if (!cancelled) {
          setIsGoogleLoading(false);
        }
      }
    }

    void handleOAuthReturn();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes("email not confirmed")) {
          setError("Még nem erősítetted meg az e-mailed.");
        } else if (message.includes("invalid login credentials")) {
          setError(
            "Hibás e-mail vagy jelszó. Ellenőrizd, hogy ugyanazzal az e-mail címmel próbálsz belépni, és az e-mail megerősítés is megtörtént.",
          );
        } else {
          setError(signInError.message);
        }
        return;
      }

      const ok = await validateUserLoginContext();
      if (!ok) return;

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?oauth=google`
          : undefined;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          ...(redirectTo ? { redirectTo } : {}),
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsGoogleLoading(false);
      }
    } catch {
      setError("Google bejelentkezés indítása sikertelen.");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
              AG
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Bejelentkezés</h1>
            <p className="mt-1 text-sm text-muted">
              Lépj be a fiókodba az e-mail címeddel.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="email">
                E-mail cím
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                placeholder="te@pelda.hu"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="password">
                Jelszó
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                placeholder="••••••••"
                required
              />
              <Link
                href="/forgot-password"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Elfelejtetted a jelszavadat?
              </Link>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Belépés folyamatban…" : "Belépés"}
            </button>
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {isGoogleLoading ? "Google belépés folyamatban…" : "Belépés Google-fiókkal"}
            </button>
          </form>
          <div className="mt-6 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <Link href="/register" className="font-medium text-primary hover:underline">
                Új fiók létrehozása
              </Link>
              <Link href="/" className="text-muted hover:text-foreground">
                Főoldal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
