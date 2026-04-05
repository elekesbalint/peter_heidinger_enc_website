"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isReservedAdminEmail } from "@/lib/admin-email";

function formatAuthErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("email rate limit")
  ) {
    return (
      "Az e-mail megerősítő küldését a Supabase Auth ideiglenesen korlátozta (túl sok kérés). " +
      "Próbáld újra később (általában néhány perc–óra), vagy a Supabase irányítópulton: Authentication → Rate Limits; " +
      "éles használathoz érdemes saját SMTP-t beállítani (Authentication → Providers → Email), mert a beépített küldőnek szigorú óránkénti plafonja van."
    );
  }
  return raw;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userType, setUserType] = useState<"private" | "company">("private");
  const [companyName, setCompanyName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (isReservedAdminEmail(normalizedEmail)) {
        setError(
          "Ez az e-mail cím a rendszergazda fiókhoz tartozik, itt nem regisztrálható. Használj másik címet.",
        );
        return;
      }
      const normalizedCompanyName = companyName.trim();
      const normalizedTaxNumber = taxNumber.trim();
      if (userType === "company" && !normalizedCompanyName) {
        setError("Céges regisztrációnál a cégnév kötelező.");
        return;
      }
      if (userType === "company" && !normalizedTaxNumber) {
        setError("Céges regisztrációnál az adószám kötelező.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            user_type: userType,
            ...(userType === "company" ? { company_name: normalizedCompanyName } : {}),
            ...(userType === "company" ? { tax_number: normalizedTaxNumber } : {}),
          },
        },
      });

      if (signUpError) {
        setError(formatAuthErrorMessage(signUpError.message));
        return;
      }

      const referralToken = (searchParams.get("ref") ?? "").trim();
      if (referralToken && data.user?.id) {
        await fetch("/api/referrals/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: referralToken,
            user_id: data.user.id,
            email: normalizedEmail,
          }),
        }).catch(() => {
          // Non-blocking: registration should still continue.
        });
      }

      if (!data.session) {
        setSuccess(
          "Küldtünk egy megerősítő linket az e-mail címedre. Kattints rá, majd jelentkezz be.",
        );
        window.setTimeout(() => {
          router.push("/login");
          router.refresh();
        }, 2200);
        return;
      }

      await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: userType,
          company_name: userType === "company" ? normalizedCompanyName : null,
          tax_number: userType === "company" ? normalizedTaxNumber : null,
        }),
      }).catch(() => {
        // Non-blocking: profile can still be completed later.
      });

      setSuccess("Sikeres regisztráció, átirányítás…");
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
            <h1 className="text-2xl font-bold tracking-tight">Regisztráció</h1>
            <p className="mt-1 text-sm text-muted">
              Hozd létre a fiókodat e-mail címmel és jelszóval.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="userType">
                Fiók típusa
              </label>
              <select
                id="userType"
                value={userType}
                onChange={(e) => setUserType(e.target.value === "company" ? "company" : "private")}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
              >
                <option value="private">Magánszemély</option>
                <option value="company">Cég</option>
              </select>
            </div>
            {userType === "company" && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="companyName">
                    Cégnév
                  </label>
                  <input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                    placeholder="Példa Kft."
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="taxNumber">
                    Adószám
                  </label>
                  <input
                    id="taxNumber"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                    placeholder="12345678-1-42"
                    required
                  />
                </div>
              </>
            )}
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
                placeholder="Minimum 6 karakter"
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
              {isLoading ? "Regisztráció folyamatban…" : "Fiók létrehozása"}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Már van fiókom
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
