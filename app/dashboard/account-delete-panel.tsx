"use client";

import { useState } from "react";

export function AccountDeletePanel() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDeleteAccount() {
    if (deleting) return;
    setError(null);

    const confirmed = window.confirm(
      "Biztosan törölni szeretnéd a fiókodat? Ez minden adatot töröl (profil, rendelések, feltöltések, készülék-egyenlegek), és nem visszavonható.",
    );
    if (!confirmed) return;

    const typed = window.prompt("A megerősítéshez írd be pontosan ezt: TORLES") ?? "";
    if (typed.trim().toUpperCase() !== "TORLES") {
      setError("A fióktörlés megszakítva: a megerősítő szöveg nem egyezik.");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/me/delete-account", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "A fiók törlése sikertelen.");
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("Hálózati hiba a fiók törlése közben.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-danger/40 bg-danger-soft p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-danger">Fiók végleges törlése</h2>
      <p className="mt-1 text-sm text-danger/90">
        A törlés végleges és nem visszavonható. A rendszer eltávolítja a profilodat, rendeléseidet, feltöltéseidet és
        kapcsolódó készülék-egyenleg adataidat is.
      </p>
      <button
        type="button"
        onClick={onDeleteAccount}
        disabled={deleting}
        className="mt-3 rounded-xl border border-danger bg-white px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-60"
      >
        {deleting ? "Fiók törlése…" : "Fiók végleges törlése"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
