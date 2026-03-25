"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "Ha ez az e-mail cím létezik a rendszerben, küldtünk egy jelszó-visszaállítási linket.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Elfelejtett jelszó</h1>
            <p className="mt-1 text-sm text-muted">
              Add meg az e-mail címedet, és küldünk egy visszaállítási linket.
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
              {isLoading ? "Küldés folyamatban…" : "Visszaállítási link küldése"}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Vissza a belépéshez
            </Link>
            <Link href="/" className="text-muted hover:text-foreground">
              Főoldal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
