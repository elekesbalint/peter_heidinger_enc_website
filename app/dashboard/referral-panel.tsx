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

export function ReferralPanel({
  discountHuf,
  invites,
}: {
  discountHuf: number;
  invites: ReferralInvite[];
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
      setMsg("Meghívó elküldve.");
      setEmail("");
    } catch {
      setErr("Hálózati hiba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Ajánlás</h2>
      <p className="mt-1 text-sm text-muted">
        Meghívó küldése e-mailben. A meghívott első készülékvásárlása {discountHuf.toLocaleString("hu-HU")} Ft kedvezményt kap.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="meghivott@pelda.hu"
          className="min-w-[260px] flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={sendInvite}
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Küldés…" : "Meghívó küldése"}
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
                    ? "Kedvezmény felhasználva"
                    : item.accepted_at
                      ? "Regisztrált"
                      : "Kiküldve"}
                </td>
                <td className="px-2 py-2.5">{new Date(item.created_at).toLocaleString("hu-HU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invites.length === 0 && <p className="mt-3 text-sm text-muted">Még nincs kiküldött meghívó.</p>}
      </div>
    </section>
  );
}

