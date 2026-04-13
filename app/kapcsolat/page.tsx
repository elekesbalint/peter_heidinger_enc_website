"use client";

import Link from "next/link";
import { useState } from "react";

export default function KapcsolatPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [emailSetupWarning, setEmailSetupWarning] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setEmailSetupWarning(false);
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        emailNotifySkipped?: boolean;
        emailNotifyFailed?: boolean;
      };
      if (!data.ok) {
        setErr(data.error ?? "Hiba történt.");
        setStatus("err");
        return;
      }
      setEmailSetupWarning(Boolean(data.emailNotifySkipped || data.emailNotifyFailed));
      setStatus("ok");
      setMessage("");
    } catch {
      setErr("Hálózati hiba.");
      setStatus("err");
    }
  }

  return (
    <div className="relative mx-auto max-w-2xl px-6 py-16">
      <span className="adria-page-glow adria-page-glow-a" aria-hidden />
      <span className="adria-page-glow adria-page-glow-b" aria-hidden />
      <div className="relative z-10">
      <Link href="/" className="adria-animate-in text-sm font-medium text-primary transition hover:underline">
        ← Főoldal
      </Link>
      <h1 className="adria-animate-in adria-delay-1 mt-6 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
        Kapcsolat
      </h1>
      <p className="adria-animate-in adria-delay-2 mt-4 text-base leading-relaxed text-muted">
        Kérdésed, reklamációd vagy ötleted van? Írj nekünk — az üzenetet a rendszer eltárolja.
      </p>

      {status === "ok" ? (
        <div className="adria-animate-in adria-delay-3 mt-8 rounded-2xl border border-green-200/90 bg-success-light/95 px-6 py-5 text-center shadow-md backdrop-blur-sm">
          <p className="text-lg font-semibold text-success">Köszönjük az üzeneted!</p>
          <p className="mt-1 text-sm text-muted">Hamarosan felvesszük veled a kapcsolatot.</p>
          {emailSetupWarning ? (
            <p className="mt-3 border-t border-amber-200/80 pt-3 text-left text-xs leading-relaxed text-amber-900/90">
              Az üzenet elmentve. Az automatikus értesítő e-mail nem indult el: a szerveren szükséges a{" "}
              <strong className="font-semibold">RESEND_API_KEY</strong> (és javasolt a{" "}
              <strong className="font-semibold">RESEND_FROM_EMAIL</strong>) Vercel környezeti változó. A{" "}
              <strong className="font-semibold">CONTACT_NOTIFY_EMAIL</strong> csak a címzettet adja meg.
            </p>
          ) : null}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="adria-animate-in adria-delay-3 adria-glass mt-8 space-y-5 rounded-2xl p-6 transition-shadow duration-300 md:p-8"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="cname">
              Név *
            </label>
            <input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="cemail">
              E-mail cím *
            </label>
            <input
              id="cemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="cmsg">
              Üzenet *
            </label>
            <textarea
              id="cmsg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm transition"
              required
              minLength={10}
            />
          </div>
          {err && (
            <div className="rounded-xl border border-red-200/80 bg-danger-light px-4 py-3 text-sm text-danger shadow-sm">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="adria-btn-primary w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60 disabled:hover:transform-none"
          >
            {status === "sending" ? "Küldés…" : "Üzenet küldése"}
          </button>
        </form>
      )}
      </div>
    </div>
  );
}
