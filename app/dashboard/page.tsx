import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/app/components/logout-button";
import { getCurrentUser } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { DEVICE_CATEGORY_LABELS, type DeviceCategoryValue } from "@/lib/device-categories";
import { isProfileComplete } from "@/lib/profile-completion";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProfileForm } from "./profile-form";
import { ReferralPanel } from "./referral-panel";

const DEVICE_STATUS_LABELS: Record<string, string> = {
  available: "elérhető",
  assigned: "kiosztva",
  sold: "aktív",
  archived: "archív",
};

function normalizeCurrencyLabel(raw: string | null | undefined): "EUR" | "HUF" {
  return (raw ?? "").trim().toUpperCase() === "EUR" ? "EUR" : "HUF";
}

function hufToEur(huf: number, fxEurToHuf: number): number {
  if (!Number.isFinite(huf)) return 0;
  if (!Number.isFinite(fxEurToHuf) || fxEurToHuf <= 0) return huf;
  return Math.round((huf / fxEurToHuf) * 100) / 100;
}

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
  const { data: pendingAssignments } = await supabase
    .from("enc_device_orders")
    .select("stripe_session_id, device_id, auth_user_id, user_email")
    .eq("status", "paid")
    .eq("user_email", user.email ?? "")
    .not("device_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if ((pendingAssignments ?? []).length > 0) {
    for (const row of pendingAssignments ?? []) {
      if (!row.device_id) continue;
      const { data: repairedRows, error: repairErr } = await supabase
        .from("devices")
        .update({
          status: "sold",
          auth_user_id: user.id,
          sold_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.device_id)
        .in("status", ["assigned", "available"])
        .select("id");
      if (repairErr) continue;
      if (repairedRows && repairedRows.length > 0) {
        await supabase
          .from("enc_device_orders")
          .update({ assignment_ok: true, auth_user_id: user.id, user_email: user.email ?? row.user_email ?? null })
          .eq("stripe_session_id", row.stripe_session_id);
      }
    }
  }
  const settings = await getSettingsMap();
  const minBal = getIntSetting(settings, "min_balance_warning_huf", 5000);
  const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
  const minBalEur = hufToEur(minBal, fxEurToHuf);
  const dashboardIntro =
    settings.dashboard_intro_text?.trim() ||
    "Saját eszközök, egyenleg, úttörténet és profil. Alacsony egyenleg küszöb:";
  const text = (key: string, fallback: string) => settings[key]?.trim() || fallback;

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

  const referralDiscountHuf = getIntSetting(settings, "referral_device_discount_huf", 25000);
  let referralInvites: Array<{
    id: string;
    invited_email: string;
    status: string;
    created_at: string;
    accepted_at: string | null;
    discount_used_at: string | null;
  }> = [];
  const { data: inviteRows, error: inviteErr } = await supabase
    .from("referral_invites")
    .select("id, invited_email, status, created_at, accepted_at, discount_used_at")
    .eq("inviter_auth_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!inviteErr && inviteRows) {
    referralInvites = inviteRows as typeof referralInvites;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {text("dashboard_page_title", "Fiókom")}
          </h1>
          <p className="mt-2 text-sm text-muted">{user.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/order"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
            >
              {text("dashboard_order_cta", "ENC megrendelés")}
            </Link>
            <Link
              href="/topup"
              className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-slate-50"
            >
              {text("dashboard_topup_cta", "Egyenlegfeltöltés")}
            </Link>
          </div>
        </div>
        <LogoutButton />
      </div>
      <p className="mt-3 text-muted">
        {dashboardIntro}{" "}
        <strong className="text-foreground">{minBalEur.toLocaleString("hu-HU")} EUR</strong>
      </p>
      {showProfileRequiredBanner && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-warning-light px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">
            {text("dashboard_profile_required_title", "Profil kitöltése szükséges")}
          </p>
          <p className="mt-1 text-sm text-amber-900/90">
            {text(
              "dashboard_profile_required_text",
              "A rendeléshez és feltöltéshez előbb töltsd ki a profil és címek adatokat.",
            )}
          </p>
          <div className="mt-3">
            <a
              href="#profile-section"
              className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              {text("dashboard_profile_required_cta", "Profil kitöltése most")}
            </a>
          </div>
        </div>
      )}

      <section id="profile-section" className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          {text("dashboard_profile_section_title", "Profil és címek")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {text("dashboard_profile_section_subtitle", "Számlázás és szállítás.")}
        </p>
        <ProfileForm forceOpen={showProfileRequiredBanner} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {(ownedDevices ?? []).map((device) => {
          const w = walletByDevice.get(device.identifier);
          const balance = w ? Number(w.balance_huf) : null;
          const balanceEur = balance === null ? null : hufToEur(balance, fxEurToHuf);
          const lowBalance = balance !== null && balance < minBal;
          const cat = device.category as DeviceCategoryValue;
          const catLabel = DEVICE_CATEGORY_LABELS[cat] ?? device.category;
          const topupStateLabel =
            balance === null
              ? "Nincs wallet adat"
              : lowBalance
                ? "Feltöltés szükséges"
                : "Rendben, tölthető";
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
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    balance === null
                      ? "bg-slate-100 text-slate-700"
                      : lowBalance
                        ? "bg-red-100 text-red-800"
                        : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {balance === null ? "○" : lowBalance ? "!" : "✓"} {topupStateLabel}
                </span>
                <Link
                  href={`/topup?device=${encodeURIComponent(device.identifier)}`}
                  className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground hover:bg-slate-50"
                >
                  Feltöltés
                </Link>
              </div>
              {balance === null ? (
                <p className="mt-4 text-sm text-muted">
                  Wallet-egyenleg még nincs rögzítve ehhez az eszközhöz.
                </p>
              ) : (
                <>
                  <p className={`mt-4 text-2xl font-bold ${lowBalance ? "text-danger" : "text-success"}`}>
                    {Number(balanceEur).toLocaleString("hu-HU")} EUR
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {lowBalance
                      ? `Alacsony egyenleg (küszöb ${minBalEur.toLocaleString("hu-HU")} EUR), töltsd fel.`
                      : "Egyenleg megfelelő."}
                  </p>
                </>
              )}
            </article>
          );
        })}
        {(ownedDevices ?? []).length === 0 && (
          <article className="md:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold">
              {text("dashboard_devices_empty_title", "Még nincs hozzárendelt készüléked")}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {text(
                "dashboard_devices_empty_text",
                "Töltsd ki a profilodat, majd indíts új rendelést az ENC készülékhez.",
              )}
            </p>
            <div className="mt-4">
              <Link
                href="/order"
                className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong"
              >
                {text("dashboard_devices_empty_cta", "Rendelés indítása")}
              </Link>
            </div>
          </article>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          {text("dashboard_route_title", "Úttörténet (utolsó 50)")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {text(
            "dashboard_route_subtitle",
            "Importált útvonal- és kapurekordok a saját készülékazonosítók alapján.",
          )}
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
                    {Number(r.amount).toLocaleString("hu-HU")} {normalizeCurrencyLabel(r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(routeHistory ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">
              {text("dashboard_route_empty", "Még nincs rögzített út a készülékekhez.")}
            </p>
          )}
        </div>
      </section>

      <ReferralPanel
        discountHuf={referralDiscountHuf}
        invites={referralInvites}
        text={{
          title: text("referral_section_title", "Ajánlás"),
          subtitlePrefix: text(
            "referral_section_subtitle_prefix",
            "Meghívó küldése e-mailben. A meghívott első készülékvásárlása",
          ),
          subtitleSuffix: text("referral_section_subtitle_suffix", "Ft induló egyenleg kerül a készülékhez (wallet)."),
          emailPlaceholder: text("referral_email_placeholder", "meghivott@pelda.hu"),
          sendButton: text("referral_send_button", "Meghívó küldése"),
          successMessage: text("referral_success_message", "Meghívó elküldve."),
          emptyMessage: text("referral_empty_message", "Még nincs kiküldött meghívó."),
          statusSent: text("referral_status_sent", "Kiküldve"),
          statusRegistered: text("referral_status_registered", "Regisztrált"),
          statusDiscountUsed: text("referral_status_discount_used", "Kedvezmény felhasználva"),
        }}
      />

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          {text("dashboard_wallet_title", "Wallet-egyenlegek")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {text("dashboard_wallet_subtitle", "Eszközönkénti aktuális egyenleg.")}
        </p>
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
                    {hufToEur(Number(item.balance_huf), fxEurToHuf).toLocaleString("hu-HU")} EUR
                  </td>
                  <td className="px-2 py-2.5">
                    {new Date(item.updated_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(wallets ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">
              {text("dashboard_wallet_empty", "Még nincs wallet-rekord.")}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          {text("dashboard_topups_title", "Feltöltési előzmények")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {text("dashboard_topups_subtitle", "Stripe-fizetések (e-mail alapján).")}
        </p>
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
              {(topups ?? []).map((item) => {
                const currency = normalizeCurrencyLabel(item.currency);
                const amountDisplay =
                  currency === "EUR"
                    ? hufToEur(Number(item.amount_huf), fxEurToHuf)
                    : Number(item.amount_huf);
                return (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2.5">
                    {new Date(item.paid_at ?? item.created_at).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-2 py-2.5 font-medium">
                    {amountDisplay.toLocaleString("hu-HU")} {currency}
                  </td>
                  <td className="px-2 py-2.5">{item.status}</td>
                  <td className="px-2 py-2.5">{item.device_identifier || "—"}</td>
                  <td className="px-2 py-2.5">{item.travel_destination ?? "—"}</td>
                </tr>
              )})}
            </tbody>
          </table>
          {(topups ?? []).length === 0 && (
            <p className="mt-3 text-sm text-muted">
              {text("dashboard_topups_empty", "Még nincs feltöltési rekord.")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
