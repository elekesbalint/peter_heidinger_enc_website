"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          setError(
            "Hibás e-mail vagy jelszó. Ellenőrizd, hogy ugyanazzal az e-mail címmel próbálsz belépni, és az e-mail megerősítés is megtörtént.",
          );
        } else {
          setError(signInError.message);
        }
        return;
      }

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
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsLoading(false);
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
              disabled={isLoading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Belépés folyamatban…" : "Belépés"}
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
