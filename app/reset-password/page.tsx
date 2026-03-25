"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    async function checkSession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setIsCheckingSession(false);
        return;
      }

      if (!data.session) {
        setError("Lejárt vagy érvénytelen visszaállítási link. Kérj új linket.");
        setIsCheckingSession(false);
        return;
      }

      setIsCheckingSession(false);
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("A jelszónak legalább 6 karakter hosszúnak kell lennie.");
      return;
    }
    if (password !== confirmPassword) {
      setError("A két jelszó nem egyezik.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("A jelszavad frissült. Átirányítunk a bejelentkezéshez…");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Jelszó visszaállítása</h1>
            <p className="mt-1 text-sm text-muted">
              Adj meg egy új jelszót a fiókodhoz.
            </p>
          </div>

          {!isCheckingSession && (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="password">
                  Új jelszó
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="Minimum 6 karakter"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="confirmPassword">
                  Jelszó megerősítése
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="Jelszó megerősítése"
                  minLength={6}
                  required
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-green-200 bg-success-light px-4 py-3 text-sm text-success">
                  {success}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Mentés…" : "Új jelszó mentése"}
              </button>
            </form>
          )}

          {isCheckingSession && (
            <p className="mt-6 text-center text-sm text-muted">Visszaállítási munkamenet ellenőrzése…</p>
          )}

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Új link kérése
            </Link>
            <Link href="/login" className="text-muted hover:text-foreground">
              Bejelentkezés
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
