import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/app/components/logout-button";
import { getCurrentUser } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { DEVICE_CATEGORY_LABELS, type DeviceCategoryValue } from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProfileForm } from "./profile-form";

const DEVICE_STATUS_LABELS: Record<string, string> = {
  available: "elérhető",
  assigned: "kiosztva",
  sold: "eladva",
  archived: "archív",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ profile?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const params = searchParams ? await searchParams : undefined;
  const profileRequired = params?.profile === "required";
  const profileComplete = await isProfileComplete(user.id);
  const showProfileRequiredBanner = profileRequired && !profileComplete;

  const supabase = createSupabaseAdminClient();
  const settings = await getSettingsMap();
  const minBal = getIntSetting(settings, "min_balance_warning_huf", 5000);

  const { data: ownedDevices } = await supabase
    .from("devices")
    .select("id, identifier, category, status, sold_at, license_plate")
    .eq("auth_user_id", user.id)
    .order("sold_at", { ascending: false });

  const ownedIdentifiers = (ownedDevices ?? []).map((d) => d.identifier);

  const { data: topups } = await supabase
    .from("stripe_topups")
    .select("id, amount_huf, currency, status, paid_at, created_at, device_identifier, travel_destination")
    .eq("user_email", user.email ?? "")
    .order("created_at", { ascending: false })
    .limit(20);

  const topupDeviceIdentifiers = (topups ?? [])
    .map((item) => item.device_identifier)
    .filter((value): value is string => Boolean(value));

  const walletLookupIds = Array.from(new Set([...ownedIdentifiers, ...topupDeviceIdentifiers]));

  const { data: wallets } = await supabase
    .from("device_wallets")
    .select("device_identifier, balance_huf, updated_at")
    .in("device_identifier", walletLookupIds)
    .order("updated_at", { ascending: false });

  const walletByDevice = new Map(
    (wallets ?? []).map((w) => [w.device_identifier, w] as const),
  );

  const { data: routeHistory } = await supabase
    .from("route_records")
    .select("id, device_number_raw, relation_label, executed_at, amount, currency, dedupe_key")
    .in("device_number_raw", ownedIdentifiers)
    .order("executed_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fiókom</h1>
          <p className="mt-2 text-sm text-muted">{user.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/order"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
            >
              ENC megrendelés
            </Link>
            <Link
              href="/topup"
              className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
            >
              Egyenlegfeltöltés
            </Link>
          </div>
        </div>
        <LogoutButton />
      </div>
      <p className="mt-3 text-muted">
        Saját eszközök, egyenleg, úttörténet és profil. Alacsony egyenleg küszöb:{" "}
        <strong className="text-foreground">{minBal.toLocaleString("hu-HU")} Ft</strong>
      </p>
      {showProfileRequiredBanner && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-warning-light px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Profil kitöltése szükséges</p>
          <p className="mt-1 text-sm text-amber-900/90">
            A rendeléshez és feltöltéshez előbb töltsd ki a profil és címek adatokat.
          </p>
          <div className="mt-3">
            <a
              href="#profile-section"
              className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Profil kitöltése most
            </a>
          </div>
        </div>
      )}

      <section id="profile-section" className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Profil és címek</h2>
        <p className="mt-1 text-sm text-muted">Számlázás és szállítás.</p>
        <ProfileForm forceOpen={showProfileRequiredBanner} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {(ownedDevices ?? []).map((device) => {
          const w = walletByDevice.get(device.identifier);
          const balance = w ? Number(w.balance_huf) : null;
          const lowBalance = balance !== null && balance < minBal;
          const cat = device.category as DeviceCategoryValue;
          const catLabel = DEVICE_CATEGORY_LABELS[cat] ?? device.category;
          return (
            <article
              key={device.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">{catLabel}</p>
                  <h2 className="mt-1 text-xl font-semibold">{device.identifier}</h2>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  device.status === "sold" ? "bg-success-light text-success" : "bg-slate-100 text-muted"
                }`}>
                  {DEVICE_STATUS_LABELS[device.status] ?? device.status}
                </span>
              </div>
              {device.license_plate && (
                <p className="mt-2 text-sm text-muted">Rendszám: <span className="font-medium text-foreground">{device.license_plate}</span></p>
              )}
              {balance === null ? (
                <p className="mt-4 text-sm text-muted">
                  Wallet-egyenleg még nincs rögzítve ehhez az eszközhöz.
                </p>
              ) : (
                <>
                  <p className={`mt-4 text-2xl font-bold ${lowBalance ? "text-danger" : "text-success"}`}>
                    {balance.toLocaleString("hu-HU")} Ft
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {lowBalance
                      ? `Alacsony egyenleg (küszöb ${minBal.toLocaleString("hu-HU")} Ft), töltsd fel.`
                      : "Egyenleg megfelelő."}
                  </p>
                </>
              )}
            </article>
          );
        })}
        {(ownedDevices ?? []).length === 0 && (
          <article className="md:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Még nincs hozzárendelt készüléked</h3>
            <p className="mt-2 text-sm text-muted">
              Töltsd ki a profilodat, majd indíts új rendelést az ENC készülékhez.
            </p>
            <div className="mt-4">
              <Link
                href="/order"
                className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
              >
                Rendelés indítása
              </Link>
            </div>
          </article>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Úttörténet (utolsó 50)</h2>
        <p className="mt-2 text-sm text-muted">
          Importált útvonal- és kapurekordok a saját készülékazonosítók alapján.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Időpont</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Készülék</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Reláció</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Összeg</th>
              </tr>
            </thead>
            <tbody>
              {(routeHistory ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap px-2 py-2.5">
                    {new Date(r.executed_at).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">{r.device_number_raw}</td>
                  <td className="px-2 py-2.5">{r.relation_label}</td>
                  <td className="px-2 py-2.5">
                    {Number(r.amount).toLocaleString("hu-HU")} {r.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(routeHistory ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">Még nincs rögzített út a készülékekhez.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Wallet-egyenlegek</h2>
        <p className="mt-2 text-sm text-muted">Eszközönkénti aktuális egyenleg.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Eszközazonosító</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Aktuális egyenleg</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Frissítve</th>
              </tr>
            </thead>
            <tbody>
              {(wallets ?? []).map((item) => (
                <tr key={item.device_identifier} className="border-b border-border/60">
                  <td className="px-2 py-2.5 font-medium">{item.device_identifier}</td>
                  <td className="px-2 py-2.5">
                    {Number(item.balance_huf).toLocaleString("hu-HU")} Ft
                  </td>
                  <td className="px-2 py-2.5">
                    {new Date(item.updated_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(wallets ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">Még nincs wallet-rekord.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Feltöltési előzmények</h2>
        <p className="mt-2 text-sm text-muted">Stripe-fizetések (e-mail alapján).</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Időpont</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Összeg</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Státusz</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Eszköz</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">Úticél</th>
              </tr>
            </thead>
            <tbody>
              {(topups ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2.5">
                    {new Date(item.paid_at ?? item.created_at).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-2 py-2.5 font-medium">
                    {Number(item.amount_huf).toLocaleString("hu-HU")}{" "}
                    {item.currency?.toUpperCase() ?? "HUF"}
                  </td>
                  <td className="px-2 py-2.5">{item.status}</td>
                  <td className="px-2 py-2.5">{item.device_identifier || "—"}</td>
                  <td className="px-2 py-2.5">{item.travel_destination ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(topups ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">Még nincs feltöltési rekord.</p>
          )}
        </div>
      </section>
    </div>
  );
}
