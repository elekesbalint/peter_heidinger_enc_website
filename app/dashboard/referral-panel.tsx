"use client";

import { useState } from "react";

type ReferralInvite = {
  id: string;
  invited_email: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  discount_used_at: string | null;
};

type ReferralPanelText = {
  title: string;
  subtitlePrefix: string;
  subtitleSuffix: string;
  emailPlaceholder: string;
  sendButton: string;
  successMessage: string;
  emptyMessage: string;
  statusSent: string;
  statusRegistered: string;
  statusDiscountUsed: string;
};

export function ReferralPanel({
  walletBonusCapEur,
  invites,
  text,
}: {
  walletBonusCapEur: number;
  invites: ReferralInvite[];
  text: ReferralPanelText;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendInvite() {
    setErr(null);
    setMsg(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setErr("Adj meg érvényes e-mail címet.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/referrals/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setErr(data.error ?? "Hiba");
        return;
      }
      setMsg(text.successMessage);
      setEmail("");
    } catch {
      setErr("Hálózati hiba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{text.title}</h2>
      <p className="mt-1 text-sm text-muted">
        {text.subtitlePrefix} {walletBonusCapEur.toLocaleString("hu-HU")} {text.subtitleSuffix}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={text.emailPlaceholder}
          className="min-w-[260px] flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={sendInvite}
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Küldés…" : text.sendButton}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">E-mail</th>
              <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Állapot</th>
              <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Küldve</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((item) => (
              <tr key={item.id} className="border-b border-border/60">
                <td className="px-2 py-2.5">{item.invited_email}</td>
                <td className="px-2 py-2.5">
                  {item.discount_used_at
                    ? text.statusDiscountUsed
                    : item.accepted_at
                      ? text.statusRegistered
                      : text.statusSent}
                </td>
                <td className="px-2 py-2.5">{new Date(item.created_at).toLocaleString("hu-HU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invites.length === 0 && <p className="mt-3 text-sm text-muted">{text.emptyMessage}</p>}
      </div>
    </section>
  );
}

