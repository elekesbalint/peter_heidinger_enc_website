"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type LoginStage = "credentials" | "setup-mfa" | "verify-mfa";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [stage, setStage] = useState<LoginStage>("credentials");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mfaRequired = searchParams.get("mfa") === "required";

  async function continueToAdminIfAal2(): Promise<boolean> {
    const supabase = createSupabaseBrowserClient();
    const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setError(aalError.message);
      return false;
    }
    if (data.currentLevel === "aal2") {
      router.push("/admin");
      router.refresh();
      return true;
    }
    return false;
  }

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
          setError("Hibás e-mail vagy jelszó.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      const validate = await fetch("/api/auth/validate-login-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "admin" }),
        credentials: "include",
      });
      const data = (await validate.json()) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };

      if (!data.ok) {
        await supabase.auth.signOut();
        setError(data.message ?? "Nem sikerült ellenőrizni a jogosultságot.");
        return;
      }

      const done = await continueToAdminIfAal2();
      if (done) return;

      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const verifiedTotp = factorsData.totp.find((f) => f.status === "verified");
      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setStage("verify-mfa");
        return;
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "AdriaGo admin",
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      setFactorId(enrollData.id);
      setQrCodeSvg(enrollData.totp.qr_code ?? null);
      setManualSecret(enrollData.totp.secret ?? null);
      setStage("setup-mfa");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyMfaCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!factorId) {
      setError("Hiányzó 2FA azonosító. Jelentkezz be újra.");
      return;
    }
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("A hitelesítő kódnak 6 számjegyűnek kell lennie.");
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) {
        setError("Hibás hitelesítő kód.");
        return;
      }

      const done = await continueToAdminIfAal2();
      if (!done) {
        setError("A 2FA ellenőrzés nem emelte a munkamenetet AAL2 szintre.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function restartLogin() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setStage("credentials");
    setFactorId(null);
    setQrCodeSvg(null);
    setManualSecret(null);
    setOtpCode("");
    setPassword("");
    setError(null);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-lg font-bold text-white">
              AG
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin bejelentkezés</h1>
            <p className="mt-1 text-sm text-muted">
              Csak a rendszerben adminnak beállított fiókok léphetnek be ide.
            </p>
          </div>
          {mfaRequired && stage === "credentials" && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Az admin felülethez kötelező a kétlépcsős hitelesítés (2FA).
            </p>
          )}
          {stage === "credentials" && (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="admin-email">
                  E-mail cím
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="admin@pelda.hu"
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="admin-password">
                  Jelszó
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Belépés…" : "Belépés az admin felületre"}
              </button>
            </form>
          )}
          {stage === "setup-mfa" && (
            <form className="space-y-4" onSubmit={verifyMfaCode}>
              <p className="text-sm text-slate-700">
                Első belépés előtt add hozzá a fiókot a Google Authenticator alkalmazásban.
              </p>
              {qrCodeSvg && (
                <div className="flex justify-center rounded-xl border border-border bg-white p-3">
                  <img
                    alt="TOTP QR kód"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCodeSvg)}`}
                    className="h-48 w-48"
                  />
                </div>
              )}
              {manualSecret && (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  Manuális kulcs: <span className="font-mono font-semibold">{manualSecret}</span>
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="admin-otp-setup">
                  Google Authenticator kód (6 számjegy)
                </label>
                <input
                  id="admin-otp-setup"
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="123456"
                  required
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Ellenőrzés…" : "2FA aktiválása"}
                </button>
                <button
                  type="button"
                  onClick={restartLogin}
                  className="rounded-xl border border-border px-4 py-3 text-sm"
                >
                  Újrakezdés
                </button>
              </div>
            </form>
          )}
          {stage === "verify-mfa" && (
            <form className="space-y-4" onSubmit={verifyMfaCode}>
              <p className="text-sm text-slate-700">
                Add meg a Google Authenticator aktuális kódját az admin belépéshez.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="admin-otp-verify">
                  2FA kód
                </label>
                <input
                  id="admin-otp-verify"
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm transition"
                  placeholder="123456"
                  required
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Ellenőrzés…" : "Belépés 2FA-val"}
                </button>
                <button
                  type="button"
                  onClick={restartLogin}
                  className="rounded-xl border border-border px-4 py-3 text-sm"
                >
                  Újrakezdés
                </button>
              </div>
            </form>
          )}
          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Felhasználói bejelentkezés
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
