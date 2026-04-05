"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEVICE_CATEGORY_LABELS,
  DEVICE_CATEGORY_VALUES,
  type DeviceCategoryValue,
} from "@/lib/device-categories";
import {
  createEmptyHomeBlogPost,
  parseHomeBlogPosts,
  stringifyHomeBlogPosts,
  type HomeBlogPost,
} from "@/lib/home-blog";
import { BlogRichEditor } from "@/components/blog-rich-editor";
import { compressImageToJpegBlob, compressImageToJpegDataUrl } from "@/lib/image-compress-browser";
import { AdminDataPanels } from "./admin-data-panels";
import { ImportDevicesForm } from "./import-devices-form";
import { ImportRoutesForm } from "./import-routes-form";

const TABS = [
  "Eszközrendelések",
  "Készülékre vár",
  "Elérhető eszközök",
  "Úticélok",
  "Útvonal feltöltés",
  "Tartozás",
  "Felhasználók",
  "Szövegek",
  "Blog",
  "Beállítások",
  "Audit / napló",
] as const;

type TabId = (typeof TABS)[number];
const SHOW_ORDER_SHIP_BUTTON = false;

function hufToEur(huf: number, fxEurToHuf: number): number {
  if (!Number.isFinite(huf)) return 0;
  if (!Number.isFinite(fxEurToHuf) || fxEurToHuf <= 0) return huf;
  return Math.round((huf / fxEurToHuf) * 100) / 100;
}

function eurToHuf(eur: number, fxEurToHuf: number): number {
  if (!Number.isFinite(eur)) return 0;
  if (!Number.isFinite(fxEurToHuf) || fxEurToHuf <= 0) return Math.round(eur);
  return Math.round(eur * fxEurToHuf);
}

type EncOrder = {
  id: string;
  stripe_session_id: string;
  device_identifier: string | null;
  category: string;
  amount_huf: number;
  assignment_ok: boolean;
  user_email: string | null;
  paid_at: string | null;
  created_at: string;
  archived_at: string | null;
  cancelled_at: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
};

type WaitRow = {
  id: string;
  user_email: string | null;
  category: string;
  note: string | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  identifier: string;
  category: string;
  status: string;
  auth_user_id: string | null;
  license_plate: string | null;
  created_at: string;
};

type DestRow = {
  id: string;
  name: string;
  price_ia: string | number;
  price_i: string | number;
  price_ii: string | number;
  price_iii: string | number;
  price_iv: string | number;
};

type SettingRow = { key: string; value: string; updated_at: string };

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_type: string | null;
  name: string | null;
  phone: string | null;
  company_name: string | null;
  tax_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  devices: Array<{
    identifier: string;
    category: string;
    status: string;
    balance_huf: number | null;
  }>;
};

const DEVICE_STATUSES = ["available", "assigned", "sold", "archived"] as const;

const DEVICE_STATUS_LABELS: Record<(typeof DEVICE_STATUSES)[number], string> = {
  available: "elérhető",
  assigned: "kiosztva",
  sold: "eladva",
  archived: "archív",
};

const SETTINGS_META: Record<string, { label: string; hint: string }> = {
  device_price_huf: {
    label: "Készülék alapár (Ft)",
    hint: "ENC készülék teljes ára (Stripe); az ajánló bónusz külön a walletbe kerül.",
  },
  fx_eur_to_huf: {
    label: "EUR -> HUF árfolyam",
    hint: "1 EUR hány Ft legyen a rendszerben.",
  },
  min_balance_warning_huf: {
    label: "Alacsony egyenleg küszöb (Ft)",
    hint: "Ezen összeg alatt küld figyelmeztető e-mailt.",
  },
  topup_block_smallest_for_categories: {
    label: "Legkisebb csomag tiltása kategóriákra",
    hint: "Vesszővel: ii,iii,iv - ezeknél a legkisebb topup csomag nem választható.",
  },
  topup_discount_percent: {
    label: "Topup kedvezmény (%)",
    hint: "Pl. 10 esetén a fizetendő ár 10%-kal kevesebb.",
  },
  topup_custom_destination_min_eur: {
    label: "Egyéni úticél minimum feltöltés (EUR)",
    hint: "Ha a felhasználó nem a listából választ úticélt, legalább ennyi EUR-t kell feltöltenie (0 = nincs ilyen kötelező minimum).",
  },
  topup_package_1_huf: {
    label: "1. topup csomag (EUR)",
    hint: "A legkisebb feltöltési csomag ára EUR-ban.",
  },
  topup_package_2_huf: {
    label: "2. topup csomag (EUR)",
    hint: "A középső feltöltési csomag ára EUR-ban.",
  },
  topup_package_3_huf: {
    label: "3. topup csomag (EUR)",
    hint: "A legnagyobb feltöltési csomag ára EUR-ban.",
  },
  referral_device_discount_huf: {
    label: "Ajánlói induló egyenleg (Ft)",
    hint: "A meghívott első készülékvásárlásakor ennyi Ft kerül a készülék walletjébe (teljes ár fizetve Stripe-ban).",
  },
  hero_bg_desktop: {
    label: "Főoldali banner kép (asztali)",
    hint: "Desktop nézetben használt hero háttérkép. Feltölthető fájl vagy URL/data URI.",
  },
  hero_bg_tablet: {
    label: "Főoldali banner kép (tablet)",
    hint: "Tablet nézetben használt hero háttérkép. Feltölthető fájl vagy URL/data URI.",
  },
  hero_bg_mobile: {
    label: "Főoldali banner kép (mobil)",
    hint: "Mobil nézetben használt hero háttérkép. Feltölthető fájl vagy URL/data URI.",
  },
  mpl_sender_country: {
    label: "MPL feladó ország",
    hint: "A csomagfeladás feladó címének országa.",
  },
  mpl_sender_zip: {
    label: "MPL feladó irányítószám",
    hint: "A csomagfeladás feladó címének irányítószáma.",
  },
  mpl_sender_city: {
    label: "MPL feladó város",
    hint: "A csomagfeladás feladó címének városa.",
  },
  mpl_sender_street: {
    label: "MPL feladó utca, házszám",
    hint: "A csomagfeladás feladó címének utcája és házszáma.",
  },
  mpl_sender_remark: {
    label: "MPL feladó cím megjegyzés",
    hint: "Opcionális mező (pl. telephely, emelet).",
  },
  mpl_sender_name: {
    label: "MPL feladó név",
    hint: "Feladó kapcsolattartó vagy cégnév.",
  },
  mpl_sender_email: {
    label: "MPL feladó e-mail",
    hint: "Feladó kapcsolattartó e-mail címe.",
  },
  mpl_sender_phone: {
    label: "MPL feladó telefon",
    hint: "Feladó kapcsolattartó telefon E.164 formátumban (pl. +36201234567).",
  },
  home_hero_title: {
    label: "Főoldal hero cím",
    hint: "A landing page fő címsora.",
  },
  home_hero_subtitle: {
    label: "Főoldal hero alcím",
    hint: "A landing page címsor alatti leírás.",
  },
  home_platform_label: {
    label: "Főoldal platform címke",
    hint: "A hero tetején kis nagybetűs felirat.",
  },
  home_cta_order_label: {
    label: "Főoldal elsődleges gomb",
    hint: "Hero gomb felirat (eszközrendelés).",
  },
  home_cta_topup_label: {
    label: "Főoldal másodlagos gomb",
    hint: "Hero gomb felirat (feltöltés).",
  },
  home_steps_title: {
    label: "Főoldal lépések cím",
    hint: "„Így működik...” blokk címe.",
  },
  home_steps_subtitle: {
    label: "Főoldal lépések alcím",
    hint: "„Így működik...” blokk leírása.",
  },
  home_step_1_title: { label: "Lépés 1 cím", hint: "Főoldal 1. lépés címe." },
  home_step_1_desc: { label: "Lépés 1 leírás", hint: "Főoldal 1. lépés szövege." },
  home_step_2_title: { label: "Lépés 2 cím", hint: "Főoldal 2. lépés címe." },
  home_step_2_desc: { label: "Lépés 2 leírás", hint: "Főoldal 2. lépés szövege." },
  home_step_3_title: { label: "Lépés 3 cím", hint: "Főoldal 3. lépés címe." },
  home_step_3_desc: { label: "Lépés 3 leírás", hint: "Főoldal 3. lépés szövege." },
  home_step_4_title: { label: "Lépés 4 cím", hint: "Főoldal 4. lépés címe." },
  home_step_4_desc: { label: "Lépés 4 leírás", hint: "Főoldal 4. lépés szövege." },
  home_features_title: {
    label: "Főoldal feature cím",
    hint: "„Minden, ami...” blokk címe.",
  },
  home_features_subtitle: {
    label: "Főoldal feature alcím",
    hint: "„Minden, ami...” blokk leírása.",
  },
  home_feature_1_title: { label: "Feature 1 cím", hint: "Főoldal 1. kártya címe." },
  home_feature_1_desc: { label: "Feature 1 leírás", hint: "Főoldal 1. kártya szövege." },
  home_feature_2_title: { label: "Feature 2 cím", hint: "Főoldal 2. kártya címe." },
  home_feature_2_desc: { label: "Feature 2 leírás", hint: "Főoldal 2. kártya szövege." },
  home_feature_3_title: { label: "Feature 3 cím", hint: "Főoldal 3. kártya címe." },
  home_feature_3_desc: { label: "Feature 3 leírás", hint: "Főoldal 3. kártya szövege." },
  home_feature_4_title: { label: "Feature 4 cím", hint: "Főoldal 4. kártya címe." },
  home_feature_4_desc: { label: "Feature 4 leírás", hint: "Főoldal 4. kártya szövege." },
  home_feature_5_title: { label: "Feature 5 cím", hint: "Főoldal 5. kártya címe." },
  home_feature_5_desc: { label: "Feature 5 leírás", hint: "Főoldal 5. kártya szövege." },
  home_feature_6_title: { label: "Feature 6 cím", hint: "Főoldal 6. kártya címe." },
  home_feature_6_desc: { label: "Feature 6 leírás", hint: "Főoldal 6. kártya szövege." },
  home_faq_title: {
    label: "Főoldal GYIK cím",
    hint: "GYIK blokk főcíme.",
  },
  home_faq_subtitle: {
    label: "Főoldal GYIK alcím",
    hint: "GYIK blokk rövid leírása.",
  },
  home_faq_1_question: { label: "GYIK 1 kérdés", hint: "Főoldal GYIK 1. kérdése." },
  home_faq_1_answer: { label: "GYIK 1 válasz", hint: "Főoldal GYIK 1. válasza." },
  home_faq_2_question: { label: "GYIK 2 kérdés", hint: "Főoldal GYIK 2. kérdése." },
  home_faq_2_answer: { label: "GYIK 2 válasz", hint: "Főoldal GYIK 2. válasza." },
  home_faq_3_question: { label: "GYIK 3 kérdés", hint: "Főoldal GYIK 3. kérdése." },
  home_faq_3_answer: { label: "GYIK 3 válasz", hint: "Főoldal GYIK 3. válasza." },
  home_faq_4_question: { label: "GYIK 4 kérdés", hint: "Főoldal GYIK 4. kérdése." },
  home_faq_4_answer: { label: "GYIK 4 válasz", hint: "Főoldal GYIK 4. válasza." },
  home_blog_title: { label: "Blog cím", hint: "Főoldali blog szekció főcíme." },
  home_blog_subtitle: { label: "Blog alcím", hint: "Főoldali blog szekció leírása." },
  home_blog_read_more_label: { label: "Blog link felirat", hint: "Pl.: Tovább olvasom." },
  home_blog_load_more_label: {
    label: "További blog gomb",
    hint: "Pl.: Következő blogcikkek — a főoldalon egyszerre 3 cikk látszik; a gomb további 3-3 cikket tölt be.",
  },
  home_blog_posts_json: {
    label: "Blog bejegyzések (JSON)",
    hint: "A bejegyzések listája. Ezt a Blog fül kezeli automatikusan.",
  },
  home_final_title: {
    label: "Főoldal záró cím",
    hint: "Alsó CTA blokk címe.",
  },
  home_final_subtitle: {
    label: "Főoldal záró alcím",
    hint: "Alsó CTA blokk leírása.",
  },
  home_final_register_cta: {
    label: "Főoldal regisztráció gomb",
    hint: "Alsó CTA első gomb.",
  },
  home_final_contact_cta: {
    label: "Főoldal kapcsolat gomb",
    hint: "Alsó CTA második gomb.",
  },
  dashboard_page_title: {
    label: "Dashboard főcím",
    hint: "A felhasználói oldal felső címe.",
  },
  dashboard_order_cta: {
    label: "Dashboard rendelés gomb",
    hint: "Felső gyorsgomb felirat.",
  },
  dashboard_topup_cta: {
    label: "Dashboard feltöltés gomb",
    hint: "Felső gyorsgomb felirat.",
  },
  dashboard_intro_text: {
    label: "Dashboard bevezető szöveg",
    hint: "A felhasználói dashboard tetején megjelenő rövid leírás.",
  },
  dashboard_profile_required_title: {
    label: "Dashboard profil-kötelező cím",
    hint: "Figyelmeztető blokk címe.",
  },
  dashboard_profile_required_text: {
    label: "Dashboard profil-kötelező szöveg",
    hint: "Figyelmeztető blokk tartalma.",
  },
  dashboard_profile_required_cta: {
    label: "Dashboard profil-kötelező gomb",
    hint: "Figyelmeztető blokk CTA gombja.",
  },
  dashboard_profile_section_title: {
    label: "Dashboard profil szekció cím",
    hint: "Profil és címek blokk címe.",
  },
  dashboard_profile_section_subtitle: {
    label: "Dashboard profil szekció alcím",
    hint: "Profil és címek blokk leírása.",
  },
  dashboard_devices_empty_title: {
    label: "Dashboard üres készülék cím",
    hint: "Ha nincs hozzárendelt készülék.",
  },
  dashboard_devices_empty_text: {
    label: "Dashboard üres készülék szöveg",
    hint: "Ha nincs hozzárendelt készülék.",
  },
  dashboard_devices_empty_cta: {
    label: "Dashboard üres készülék gomb",
    hint: "Üres készülék állapot CTA.",
  },
  dashboard_route_title: {
    label: "Dashboard úttörténet cím",
    hint: "Úttörténet blokk címe.",
  },
  dashboard_route_subtitle: {
    label: "Dashboard úttörténet alcím",
    hint: "Úttörténet blokk leírása.",
  },
  dashboard_route_empty: {
    label: "Dashboard úttörténet üres szöveg",
    hint: "Ha nincs úttörténet.",
  },
  dashboard_wallet_title: {
    label: "Dashboard wallet cím",
    hint: "Wallet blokk címe.",
  },
  dashboard_wallet_subtitle: {
    label: "Dashboard wallet alcím",
    hint: "Wallet blokk leírása.",
  },
  dashboard_wallet_empty: {
    label: "Dashboard wallet üres szöveg",
    hint: "Ha nincs wallet rekord.",
  },
  dashboard_topups_title: {
    label: "Dashboard topup cím",
    hint: "Feltöltési előzmények blokk címe.",
  },
  dashboard_topups_subtitle: {
    label: "Dashboard topup alcím",
    hint: "Feltöltési előzmények blokk leírása.",
  },
  dashboard_topups_empty: {
    label: "Dashboard topup üres szöveg",
    hint: "Ha nincs topup rekord.",
  },
  referral_section_title: {
    label: "Referral szekció cím",
    hint: "Ajánlói blokk főcím.",
  },
  referral_section_subtitle_prefix: {
    label: "Referral alcím eleje",
    hint: "Kedvezmény összege elé kerülő rész.",
  },
  referral_section_subtitle_suffix: {
    label: "Referral alcím vége",
    hint: "Kedvezmény összege utáni rész.",
  },
  referral_email_placeholder: {
    label: "Referral email placeholder",
    hint: "Ajánló email input mintaszöveg.",
  },
  referral_send_button: {
    label: "Referral küldés gomb",
    hint: "Ajánló küldés gomb felirata.",
  },
  referral_success_message: {
    label: "Referral sikerüzenet",
    hint: "Sikeres küldés után jelenik meg.",
  },
  referral_empty_message: {
    label: "Referral üres állapot",
    hint: "Ha még nincs kiküldött meghívó.",
  },
  referral_status_sent: {
    label: "Referral státusz: kiküldve",
    hint: "Táblázat státusz felirat.",
  },
  referral_status_registered: {
    label: "Referral státusz: regisztrált",
    hint: "Táblázat státusz felirat.",
  },
  referral_status_discount_used: {
    label: "Referral státusz: kedvezmény felhasználva",
    hint: "Táblázat státusz felirat.",
  },
  order_category_guide_title: {
    label: "Rendelés kategória-magyarázó cím",
    hint: "Kategória-magyarázó kártya főcíme az ENC rendelés oldalon.",
  },
  order_category_guide_subtitle: {
    label: "Rendelés kategória-magyarázó alcím",
    hint: "Kategória-magyarázó kártya rövid leírása.",
  },
  order_category_guide_ia_items: {
    label: "Kategória IA pontok",
    hint: "Egy sor = egy felsorolási pont.",
  },
  order_category_guide_i_items: {
    label: "Kategória I pontok",
    hint: "Egy sor = egy felsorolási pont.",
  },
  order_category_guide_ii_items: {
    label: "Kategória II pontok",
    hint: "Egy sor = egy felsorolási pont.",
  },
  order_category_guide_iii_items: {
    label: "Kategória III pontok",
    hint: "Egy sor = egy felsorolási pont.",
  },
  order_category_guide_iv_items: {
    label: "Kategória IV pontok",
    hint: "Egy sor = egy felsorolási pont.",
  },
  aszf_title: {
    label: "ÁSZF oldal cím",
    hint: "Az ÁSZF oldal főcíme.",
  },
  aszf_intro: {
    label: "ÁSZF bevezető",
    hint: "Az ÁSZF oldal rövid bevezető szövege.",
  },
  aszf_document_url: {
    label: "ÁSZF dokumentum (PDF/Word)",
    hint: "Feltölthető dokumentum link/data URI, ami az oldalon letöltésként jelenik meg.",
  },
  aszf_content: {
    label: "ÁSZF teljes tartalom",
    hint: "Többsoros mező. Üres sor = új blokk.",
  },
  adatvedelem_title: {
    label: "Adatvédelem oldal cím",
    hint: "Az Adatvédelmi oldal főcíme.",
  },
  adatvedelem_intro: {
    label: "Adatvédelem bevezető",
    hint: "Az Adatvédelmi oldal rövid bevezető szövege.",
  },
  adatvedelem_document_url: {
    label: "Adatvédelem dokumentum (PDF/Word)",
    hint: "Feltölthető dokumentum link/data URI, ami az oldalon letöltésként jelenik meg.",
  },
  adatvedelem_content: {
    label: "Adatvédelem teljes tartalom",
    hint: "Többsoros mező. Üres sor = új blokk.",
  },
};

const CONTENT_SETTING_PREFIXES = ["home_", "dashboard_", "order_", "aszf_", "adatvedelem_"] as const;
const CONTENT_SETTING_KEYS = new Set([
  "referral_section_title",
  "referral_section_subtitle_prefix",
  "referral_section_subtitle_suffix",
  "referral_email_placeholder",
  "referral_send_button",
  "referral_success_message",
  "referral_empty_message",
  "referral_status_sent",
  "referral_status_registered",
  "referral_status_discount_used",
]);

function isContentSettingKey(key: string): boolean {
  if (isBlogSettingKey(key)) return false;
  return CONTENT_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix)) || CONTENT_SETTING_KEYS.has(key);
}

function isBlogSettingKey(key: string): boolean {
  return key.startsWith("home_blog_");
}

function isTechnicalSettingKey(key: string): boolean {
  return !isContentSettingKey(key) && !isBlogSettingKey(key);
}

function isMultilineContentSettingKey(key: string): boolean {
  return (
    (key.startsWith("order_category_guide_") && key.endsWith("_items")) ||
    key === "aszf_content" ||
    key === "adatvedelem_content"
  );
}

function isHeroImageSettingKey(key: string): boolean {
  return key === "hero_bg_desktop" || key === "hero_bg_tablet" || key === "hero_bg_mobile";
}

function isLegalDocumentSettingKey(key: string): boolean {
  return key === "aszf_document_url" || key === "adatvedelem_document_url";
}

function normalizeAddressForDisplay(raw: string | null): string {
  if (!raw) return "—";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "—";

  // If the address accidentally contains the same block twice, keep only one.
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half);
    const second = parts.slice(half);
    const duplicated = first.every((p, i) => p === second[i]);
    if (duplicated) {
      return first.join(", ");
    }
  }

  const deduped: string[] = [];
  for (const p of parts) {
    if (deduped[deduped.length - 1] !== p) deduped.push(p);
  }
  return deduped.join(", ");
}

function getOrderStatuses(order: EncOrder): string[] {
  const statuses: string[] = [];
  if (order.shipped_at) statuses.push("küldve");
  if (order.archived_at) statuses.push("archív");
  if (order.cancelled_at) statuses.push("törölve");
  if (statuses.length === 0) statuses.push("aktív");
  return statuses;
}

function isOrderActive(order: EncOrder): boolean {
  return !order.archived_at && !order.cancelled_at && !order.shipped_at;
}

type AdminSidebarBadgeTone = "enc" | "wait" | "debt";

function AdminSidebarTabBadge({
  count,
  selected,
  tone,
}: {
  count: number;
  selected: boolean;
  tone: AdminSidebarBadgeTone;
}) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  const inactive =
    tone === "enc"
      ? "bg-amber-500 text-white"
      : tone === "wait"
        ? "bg-sky-600 text-white"
        : "bg-rose-600 text-white";
  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
        selected ? "bg-white/95 text-primary shadow-sm" : inactive
      }`}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function AdminWorkspace() {
  const [tab, setTab] = useState<TabId>("Eszközrendelések");

  const [encOrders, setEncOrders] = useState<EncOrder[]>([]);
  const [encLoading, setEncLoading] = useState(false);
  const [encErr, setEncErr] = useState<string | null>(null);
  const [encPage, setEncPage] = useState(1);
  const [encPerPage, setEncPerPage] = useState<10 | 100 | 200>(10);
  const [encTotal, setEncTotal] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [encFilter, setEncFilter] = useState<"all" | "active" | "shipped" | "archived" | "cancelled">("all");
  const [encQuery, setEncQuery] = useState("");
  const [mplAgreementCode] = useState(process.env.NEXT_PUBLIC_MPL_SENDER_AGREEMENT ?? "");
  const [labelLoadingForId, setLabelLoadingForId] = useState<string | null>(null);
  const [bulkLabelsLoading, setBulkLabelsLoading] = useState(false);
  const [editShippingOrderId, setEditShippingOrderId] = useState<string | null>(null);
  const [editShippingAddress, setEditShippingAddress] = useState("");

  const [waitlist, setWaitlist] = useState<WaitRow[]>([]);
  const [waitQ, setWaitQ] = useState("");
  const [waitLoading, setWaitLoading] = useState(false);
  const [waitErr, setWaitErr] = useState<string | null>(null);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [devicesQ, setDevicesQ] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [devErr, setDevErr] = useState<string | null>(null);
  const [newIdf, setNewIdf] = useState("");
  const [newCat, setNewCat] = useState<DeviceCategoryValue>("ii");
  const [editDevice, setEditDevice] = useState<DeviceRow | null>(null);

  const [dest, setDest] = useState<DestRow[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [destErr, setDestErr] = useState<string | null>(null);
  const [newDest, setNewDest] = useState({
    name: "",
    price_ia: "0",
    price_i: "0",
    price_ii: "0",
    price_iii: "0",
    price_iv: "0",
  });
  const [editDest, setEditDest] = useState<DestRow | null>(null);

  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [setLoading, setSetLoading] = useState(false);
  const [setSaving, setSetSaving] = useState(false);
  const [setErr, setSetErr] = useState<string | null>(null);
  const [setMsg, setSetMsg] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<Record<string, string>>({});
  const [blogEditId, setBlogEditId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usrLoading, setUsrLoading] = useState(false);
  const [usrErr, setUsrErr] = useState<string | null>(null);
  const [usrMsg, setUsrMsg] = useState<string | null>(null);
  const [usrQuery, setUsrQuery] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [selectedDebtDevices, setSelectedDebtDevices] = useState<Set<string>>(new Set());
  const [unlinkingUserDevice, setUnlinkingUserDevice] = useState<string | null>(null);

  const [routesQ, setRoutesQ] = useState("");

  type WalletRow = {
    identifier: string;
    status: string;
    category: string;
    balance_huf: number | null;
    updated_at: string | null;
  };

  const [walletRows, setWalletRows] = useState<WalletRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [minBalanceWarningHuf, setMinBalanceWarningHuf] = useState(5000);
  const [fxEurToHuf, setFxEurToHuf] = useState(400);
  const [walletAdjustDeviceId, setWalletAdjustDeviceId] = useState("");
  const [walletAdjustNewBalance, setWalletAdjustNewBalance] = useState("");
  const [walletAdjustReason, setWalletAdjustReason] = useState("");
  const [walletAdjustLoading, setWalletAdjustLoading] = useState(false);
  const [walletAdjustErr, setWalletAdjustErr] = useState<string | null>(null);
  const [walletAdjustMsg, setWalletAdjustMsg] = useState<string | null>(null);

  const [adminBadgeEnc, setAdminBadgeEnc] = useState(0);
  const [adminBadgeWait, setAdminBadgeWait] = useState(0);
  const [adminBadgeDebt, setAdminBadgeDebt] = useState(0);

  async function fileToDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Nem sikerült beolvasni a fájlt."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadHeroImageToSetting(settingKey: string, file: File | null) {
    if (!file) return;
    setSetErr(null);
    setSetMsg(null);
    if (!file.type.startsWith("image/")) {
      setSetErr("Csak képfájl tölthető fel.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSetErr("A kép mérete legfeljebb 5 MB lehet.");
      return;
    }
    try {
      const dataUrl = await compressImageToJpegDataUrl(file, {
        maxEdge: 1920,
        quality: 0.82,
        maxChars: 900_000,
      });
      setSetDraft((d) => ({ ...d, [settingKey]: dataUrl }));
      setSetMsg(`Kép betöltve (tömörítve): ${file.name}. Mentsd el az „Összes mentése” gombbal.`);
    } catch (e) {
      setSetErr(e instanceof Error ? e.message : "Kép feltöltési hiba.");
    }
  }

  async function uploadLegalDocumentToSetting(settingKey: string, file: File | null) {
    if (!file) return;
    setSetErr(null);
    setSetMsg(null);
    const allowedExt = [".pdf", ".doc", ".docx"];
    const lowerName = file.name.toLowerCase();
    const extOk = allowedExt.some((ext) => lowerName.endsWith(ext));
    const typeOk =
      file.type === "application/pdf" ||
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!extOk && !typeOk) {
      setSetErr("Csak PDF vagy Word (.doc/.docx) dokumentum tölthető fel.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setSetErr("A dokumentum mérete legfeljebb 12 MB lehet.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSetDraft((d) => ({ ...d, [settingKey]: dataUrl }));
      setSetMsg(`Dokumentum betöltve: ${file.name}. Mentsd el az „Összes mentése” gombbal.`);
    } catch (e) {
      setSetErr(e instanceof Error ? e.message : "Dokumentum feltöltési hiba.");
    }
  }

  const blogPosts = parseHomeBlogPosts(setDraft.home_blog_posts_json, { keepEmptyDrafts: true });
  const editingPost = blogEditId ? (blogPosts.find((p) => p.id === blogEditId) ?? null) : null;

  function setBlogPosts(nextPosts: HomeBlogPost[]) {
    setSetDraft((d) => ({ ...d, home_blog_posts_json: stringifyHomeBlogPosts(nextPosts) }));
  }

  function updateBlogPost(id: string, patch: Partial<HomeBlogPost>) {
    setBlogPosts(
      blogPosts.map((post) => {
        if (post.id !== id) return post;
        return { ...post, ...patch };
      }),
    );
  }

  function addBlogPost() {
    const newPost = createEmptyHomeBlogPost();
    setBlogPosts([...blogPosts, newPost]);
    setBlogEditId(newPost.id);
  }

  function deleteBlogPost(id: string) {
    setBlogPosts(blogPosts.filter((post) => post.id !== id));
    setBlogEditId((cur) => (cur === id ? null : cur));
  }

  async function uploadBlogImage(postId: string, file: File | null) {
    if (!file) return;
    setSetErr(null);
    setSetMsg(null);
    if (!file.type.startsWith("image/")) {
      setSetErr("Csak képfájl tölthető fel.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSetErr("A kép mérete legfeljebb 5 MB lehet.");
      return;
    }
    try {
      const blob = await compressImageToJpegBlob(file, { maxBytes: 420_000 });
      const fd = new FormData();
      fd.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      fd.append("kind", "cover");
      const res = await fetch("/api/admin/upload/blog-image", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; error?: string; url?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error ?? `Feltöltés sikertelen (${res.status}).`);
      }
      updateBlogPost(postId, { image_url: data.url });
      setSetMsg(
        `Borítókép feltöltve (tárhely URL): ${file.name}. Mentsd el az „Összes mentése” gombbal.`,
      );
    } catch (e) {
      setSetErr(e instanceof Error ? e.message : "Blog kép feltöltési hiba.");
    }
  }

  const loadEnc = useCallback(async () => {
    setEncLoading(true);
    setEncErr(null);
    try {
      const res = await fetch(
        `/api/admin/enc-device-orders/list?page=${encPage}&perPage=${encPerPage}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        items?: EncOrder[];
        total?: number;
        error?: string;
      };
      if (!data.ok) {
        setEncErr(data.error ?? "Hiba");
        return;
      }
      const total = data.total ?? 0;
      setEncTotal(total);
      const maxPage = Math.max(1, Math.ceil(total / encPerPage));
      if (encPage > maxPage) {
        setEncPage(maxPage);
        return;
      }
      setEncOrders(data.items ?? []);
    } catch {
      setEncErr("Hálózati hiba");
    } finally {
      setEncLoading(false);
    }
  }, [encPage, encPerPage]);

  const loadWait = useCallback(async () => {
    setWaitLoading(true);
    setWaitErr(null);
    try {
      const res = await fetch("/api/admin/device-waitlist/list");
      const data = (await res.json()) as { ok: boolean; items?: WaitRow[]; error?: string };
      if (!data.ok) {
        setWaitErr(data.error ?? "Hiba");
        return;
      }
      const items = data.items ?? [];
      setWaitlist(items);
      setAdminBadgeWait(items.length);
    } catch {
      setWaitErr("Hálózati hiba");
    } finally {
      setWaitLoading(false);
    }
  }, []);

  const refreshAdminBadges = useCallback(async () => {
    try {
      const [encRes, waitRes, walletRes] = await Promise.all([
        fetch("/api/admin/enc-device-orders/list?activeTotal=1"),
        fetch("/api/admin/device-waitlist/list"),
        fetch("/api/admin/device-wallets/list"),
      ]);
      const encData = (await encRes.json()) as { ok?: boolean; activeTotal?: number };
      const waitData = (await waitRes.json()) as { ok?: boolean; items?: WaitRow[] };
      const walletData = (await walletRes.json()) as { ok?: boolean; items?: WalletRow[] };
      if (encData.ok && typeof encData.activeTotal === "number") {
        setAdminBadgeEnc(encData.activeTotal);
      }
      if (waitData.ok && Array.isArray(waitData.items)) {
        setAdminBadgeWait(waitData.items.length);
      }
      if (walletData.ok && Array.isArray(walletData.items)) {
        setAdminBadgeDebt(walletData.items.filter((w) => (w.balance_huf ?? 0) < 0).length);
      }
    } catch {
      /* badge refresh best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshAdminBadges();
  }, [refreshAdminBadges]);

  useEffect(() => {
    const id = setInterval(() => void refreshAdminBadges(), 90_000);
    return () => clearInterval(id);
  }, [refreshAdminBadges]);

  const loadDevices = useCallback(async (q = devicesQ) => {
    setDevLoading(true);
    setDevErr(null);
    try {
      const res = await fetch(`/api/admin/devices/list?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { ok: boolean; items?: DeviceRow[]; error?: string };
      if (!data.ok) {
        setDevErr(data.error ?? "Hiba");
        return;
      }
      setDevices(data.items ?? []);
    } catch {
      setDevErr("Hálózati hiba");
    } finally {
      setDevLoading(false);
    }
  }, [devicesQ]);

  const loadDest = useCallback(async () => {
    setDestLoading(true);
    setDestErr(null);
    try {
      const res = await fetch("/api/admin/destinations/list");
      const data = (await res.json()) as { ok: boolean; items?: DestRow[]; error?: string };
      if (!data.ok) {
        setDestErr(data.error ?? "Hiba");
        return;
      }
      setDest(data.items ?? []);
    } catch {
      setDestErr("Hálózati hiba");
    } finally {
      setDestLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSetLoading(true);
    setSetErr(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = (await res.json()) as { ok: boolean; items?: SettingRow[]; error?: string };
      if (res.status === 413) {
        setSetErr(
          "A beállítások válasza túl nagy (nagy képek a tárolt adatban). Töröld vagy cseréld le a nagy data URI képeket az adatbázisban, vagy írj a fejlesztőnek (tárhelyes képfeltöltés).",
        );
        return;
      }
      if (!data.ok) {
        setSetErr(data.error ?? "Hiba");
        return;
      }
      const items = data.items ?? [];
      setSettings(items);
      const d: Record<string, string> = {};
      for (const r of items) d[r.key] = r.value;
      setSetDraft(d);
    } catch {
      setSetErr("Hálózati hiba");
    } finally {
      setSetLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsrLoading(true);
    setUsrErr(null);
    try {
      const res = await fetch("/api/admin/users/list?perPage=100");
      const data = (await res.json()) as { ok: boolean; items?: UserRow[]; error?: string };
      if (!data.ok) {
        setUsrErr(data.error ?? "Hiba");
        return;
      }
      setUsers(data.items ?? []);
    } catch {
      setUsrErr("Hálózati hiba");
    } finally {
      setUsrLoading(false);
    }
  }, []);

  async function saveUserProfile() {
    if (!editUser) return;
    setUsrErr(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUser.id,
          user_type: editUser.user_type,
          email: editUser.email,
          name: editUser.name,
          phone: editUser.phone,
          company_name: editUser.company_name,
          tax_number: editUser.tax_number,
          billing_address: editUser.billing_address,
          shipping_address: editUser.shipping_address,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setUsrErr(data.error ?? "Hiba");
        return;
      }
      setEditUser(null);
      await loadUsers();
    } catch {
      setUsrErr("Hálózati hiba");
    }
  }

  function toggleDebtDevice(identifier: string) {
    setSelectedDebtDevices((prev) => {
      const next = new Set(prev);
      if (next.has(identifier)) next.delete(identifier);
      else next.add(identifier);
      return next;
    });
  }

  async function unlinkUserDevice(userId: string, deviceIdentifier: string) {
    const ok = window.confirm(
      `Leválasztod a(z) ${deviceIdentifier} készüléket erről a fiókról?\n\n` +
        "A felhasználó nem fogja látni az eszközt, és nem tud rá feltölteni. " +
        "A készülék egyenlege változatlan marad az azonosítóhoz kötve. " +
        "Az eszköz státusza „elérhető” lesz (kivéve archív), így újra kiosztható.",
    );
    if (!ok) return;
    const key = `${userId}:${deviceIdentifier}`;
    setUnlinkingUserDevice(key);
    setUsrErr(null);
    try {
      const res = await fetch("/api/admin/users/unlink-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_user_id: userId, device_identifier: deviceIdentifier }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setUsrErr(data.error ?? "Hiba");
        return;
      }
      setSelectedDebtDevices((prev) => {
        const next = new Set(prev);
        next.delete(deviceIdentifier);
        return next;
      });
      setEditUser((e) =>
        e && e.id === userId
          ? { ...e, devices: e.devices.filter((d) => d.identifier !== deviceIdentifier) }
          : e,
      );
      await loadUsers();
    } catch {
      setUsrErr("Hálózati hiba");
    } finally {
      setUnlinkingUserDevice(null);
    }
  }

  async function sendDebtWarnings(identifiers: string[]) {
    if (identifiers.length === 0) return;
    setUsrErr(null);
    setUsrMsg(null);
    try {
      const res = await fetch("/api/admin/device-wallets/send-warning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_identifiers: identifiers }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; sent_users?: number };
      if (!data.ok) {
        setUsrErr(data.error ?? "Hiba");
        return;
      }
      setUsrMsg(`Figyelmeztető e-mail kiküldve (${data.sent_users ?? 0} felhasználó).`);
      setSelectedDebtDevices(new Set());
    } catch {
      setUsrErr("Hálózati hiba");
    }
  }

  async function quickAdjustUserDeviceBalance(identifier: string, currentBalanceHuf: number | null) {
    const currentEur = hufToEur(Number(currentBalanceHuf ?? 0), fxEurToHuf);
    const rawAmount = window.prompt(
      `Új egyenleg EUR-ban a(z) ${identifier} eszközhöz:`,
      currentEur.toFixed(2).replace(".", ","),
    );
    if (rawAmount == null) return;
    const parsed = Number.parseFloat(rawAmount.trim().replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setUsrErr("Érvénytelen EUR összeg.");
      return;
    }
    const reason = window.prompt("Megjegyzés (opcionális):", "Admin módosítás (Felhasználók fül)") ?? "";

    setUsrErr(null);
    setUsrMsg(null);
    try {
      const res = await fetch("/api/admin/device-wallets/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_identifier: identifier,
          new_balance_huf: String(eurToHuf(parsed, fxEurToHuf)),
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setUsrErr(data.error ?? "Hiba");
        return;
      }
      setUsrMsg(
        `Egyenleg módosítva: ${identifier} -> ${parsed.toLocaleString("hu-HU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR.`,
      );
      await Promise.all([loadUsers(), loadWallets()]);
    } catch {
      setUsrErr("Hálózati hiba");
    }
  }

  useEffect(() => {
    if (tab === "Eszközrendelések") loadEnc();
    if (tab === "Készülékre vár") loadWait();
    if (tab === "Elérhető eszközök") loadDevices("");
    if (tab === "Úticélok") loadDest();
    if (tab === "Beállítások" || tab === "Szövegek" || tab === "Blog") loadSettings();
    if (tab === "Felhasználók") loadUsers();
    if (tab === "Tartozás") loadWallets();
  }, [tab, loadEnc, loadWait, loadDevices, loadDest, loadSettings, loadUsers]);

  async function postOrderUpdate(
    id: string,
    action: "archive" | "restore" | "cancel" | "uncancel" | "ship" | "update_shipping",
    extra?: {
      tracking_number?: string;
      mpl_payload?: Record<string, unknown> | null;
      mpl_sender_agreement?: string | null;
      shipping_address?: string | null;
    },
  ) {
    const res = await fetch("/api/admin/enc-device-orders/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, ...extra }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Hiba");
  }

  async function bulkOrders(action: "archive" | "restore" | "cancel") {
    const ids = [...selectedOrders];
    if (ids.length === 0) return;
    const res = await fetch("/api/admin/enc-device-orders/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setEncErr(data.error ?? "Hiba");
      return;
    }
    setSelectedOrders(new Set());
    await loadEnc();
  }

  async function submitWalletAdjust() {
    setWalletAdjustErr(null);
    setWalletAdjustMsg(null);
    const device_identifier = walletAdjustDeviceId.trim();
    if (!device_identifier) {
      setWalletAdjustErr("Add meg az eszközazonosítót (device_identifier).");
      return;
    }
    const newBalanceEurText = walletAdjustNewBalance.trim().replace(",", ".");
    if (!newBalanceEurText) {
      setWalletAdjustErr("Add meg az új egyenleget (EUR).");
      return;
    }
    const newBalanceEur = Number.parseFloat(newBalanceEurText);
    if (!Number.isFinite(newBalanceEur)) {
      setWalletAdjustErr("Érvénytelen EUR összeg.");
      return;
    }
    const new_balance_huf = String(eurToHuf(newBalanceEur, fxEurToHuf));
    setWalletAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/device-wallets/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_identifier,
          new_balance_huf,
          reason: walletAdjustReason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; old_balance_huf?: number; new_balance_huf?: number; delta_huf?: number };
      if (!data.ok) {
        setWalletAdjustErr(data.error ?? "Hiba");
        return;
      }
      setWalletAdjustMsg(
        `Egyenleg beállítva. Régi: ${hufToEur(Number(data.old_balance_huf), fxEurToHuf).toLocaleString("hu-HU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR, Új: ${hufToEur(Number(data.new_balance_huf), fxEurToHuf).toLocaleString("hu-HU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR (Δ ${hufToEur(Number(data.delta_huf), fxEurToHuf).toLocaleString("hu-HU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR).`,
      );
      setWalletAdjustReason("");
      void refreshAdminBadges();
    } catch (e) {
      setWalletAdjustErr(e instanceof Error ? e.message : "Hálózati hiba");
    } finally {
      setWalletAdjustLoading(false);
    }
  }

  async function loadWallets() {
    setWalletLoading(true);
    setWalletErr(null);
    try {
      const res = await fetch("/api/admin/device-wallets/list");
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        minBalanceWarningHuf?: number;
        fxEurToHuf?: number;
        items?: WalletRow[];
      };
      if (!data.ok) {
        setWalletErr(data.error ?? "Hiba");
        return;
      }
      setMinBalanceWarningHuf(data.minBalanceWarningHuf ?? 5000);
      setFxEurToHuf(data.fxEurToHuf ?? 400);
      const items = data.items ?? [];
      setWalletRows(items);
      setAdminBadgeDebt(items.filter((w) => (w.balance_huf ?? 0) < 0).length);
    } catch {
      setWalletErr("Hálózati hiba");
    } finally {
      setWalletLoading(false);
    }
  }

  async function deleteOrderPermanently(id: string) {
    const ok = window.confirm(
      "Biztosan végleg törlöd ezt a rendelést? Ez a művelet nem visszavonható.",
    );
    if (!ok) return;
    setEncErr(null);
    const res = await fetch("/api/admin/enc-device-orders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setEncErr(data.error ?? "Hiba");
      return;
    }
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await loadEnc();
  }

  async function submitShip(
    orderId: string,
    trackingNumber?: string | null,
    options?: { skipReload?: boolean },
  ): Promise<boolean> {
    try {
      await postOrderUpdate(orderId, "ship", {
        tracking_number: (trackingNumber ?? "").trim(),
        mpl_payload: null,
        mpl_sender_agreement: mplAgreementCode.trim() || null,
      });
      if (!options?.skipReload) {
        await loadEnc();
      }
      return true;
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Hiba");
      return false;
    }
  }

  function parseFilenameFromContentDisposition(headerValue: string | null): string | null {
    if (!headerValue) return null;
    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]).trim();
      } catch {
        return utf8Match[1].trim();
      }
    }
    const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) return plainMatch[1].trim();
    return null;
  }

  async function downloadOrderLabel(orderId: string, trackingNumber: string | null) {
    setEncErr(null);
    setLabelLoadingForId(orderId);
    try {
      // One-click UX: if tracking is missing, trigger "Küldés" first.
      if (!trackingNumber) {
        const shipped = await submitShip(orderId, null);
        if (!shipped) return;
      }
      const res = await fetch(`/api/admin/enc-device-orders/label?id=${encodeURIComponent(orderId)}`);
      if (!res.ok) {
        const maybe = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(maybe?.error ?? "Nem sikerült letölteni a címkét.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const serverFilename = parseFilenameFromContentDisposition(res.headers.get("content-disposition"));
      a.download = serverFilename || `mpl-label-${trackingNumber ?? orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await loadEnc();
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Hiba");
    } finally {
      setLabelLoadingForId(null);
    }
  }

  function triggerFileDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function generateBulkOrderLabels() {
    const ids = [...selectedOrders];
    if (ids.length === 0 || bulkLabelsLoading) return;
    setEncErr(null);
    setBulkLabelsLoading(true);
    try {
      const res = await fetch("/api/admin/enc-device-orders/bulk-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          mpl_sender_agreement: mplAgreementCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const maybe = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(maybe?.error ?? "Nem sikerült legenerálni a közös címke PDF-et.");
      }
      const blob = await res.blob();
      const serverFilename = parseFilenameFromContentDisposition(res.headers.get("content-disposition"));
      triggerFileDownload(blob, serverFilename || "mpl-labels.pdf");
      await loadEnc();
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Tömeges címkegenerálási hiba.");
    } finally {
      setBulkLabelsLoading(false);
    }
  }

  async function removeWaitlist(id: string) {
    const res = await fetch("/api/admin/device-waitlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setWaitErr(data.error ?? "Hiba");
      return;
    }
    await loadWait();
  }

  async function assignNext() {
    setAssignMsg(null);
    setAssignErr(null);
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/device-waitlist/assign-next", { method: "POST" });
      const data = (await res.json()) as {
        ok: boolean;
        assigned?: boolean;
        message?: string;
        error?: string;
        item?: { device_identifier?: string; user_email?: string | null; category?: string };
      };
      if (!data.ok) {
        setAssignErr(data.error ?? "Hiba");
        return;
      }
      if (data.assigned && data.item) {
        setAssignMsg(
          `Fizetési link kiküldve: ${data.item.device_identifier ?? "?"} → ${data.item.user_email ?? "?"} (${data.item.category ?? "?"})`,
        );
      } else {
        setAssignMsg(data.message ?? "Nem történt kiosztás.");
      }
      await loadWait();
      await loadDevices("");
    } catch {
      setAssignErr("Hálózati hiba");
    } finally {
      setAssigning(false);
    }
  }

  async function assignOneWaitlist(id: string) {
    setAssignMsg(null);
    setAssignErr(null);
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/device-waitlist/assign-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        item?: { device_identifier?: string; user_email?: string | null; category?: string };
      };
      if (!data.ok) {
        setAssignErr(data.error ?? "Hiba");
        return;
      }
      setAssignMsg(
        `Fizetési link kiküldve: ${data.item?.device_identifier ?? "?"} → ${data.item?.user_email ?? "?"} (${data.item?.category ?? "?"})`,
      );
      await loadWait();
      await loadDevices("");
    } catch {
      setAssignErr("Hálózati hiba");
    } finally {
      setAssigning(false);
    }
  }

  async function createDevice() {
    setDevErr(null);
    const res = await fetch("/api/admin/devices/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: newIdf, category: newCat, status: "available" }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setDevErr(data.error ?? "Hiba");
      return;
    }
    setNewIdf("");
    await loadDevices("");
  }

  async function saveDevice() {
    if (!editDevice) return;
    setDevErr(null);
    const res = await fetch("/api/admin/devices/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editDevice.id,
        identifier: editDevice.identifier,
        category: editDevice.category,
        status: editDevice.status,
        license_plate: editDevice.license_plate,
        auth_user_id: editDevice.auth_user_id,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setDevErr(data.error ?? "Hiba");
      return;
    }
    setEditDevice(null);
    await loadDevices("");
  }

  async function createDestination() {
    setDestErr(null);
    const res = await fetch("/api/admin/destinations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDest.name,
        price_ia: Number.parseFloat(newDest.price_ia),
        price_i: Number.parseFloat(newDest.price_i),
        price_ii: Number.parseFloat(newDest.price_ii),
        price_iii: Number.parseFloat(newDest.price_iii),
        price_iv: Number.parseFloat(newDest.price_iv),
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setDestErr(data.error ?? "Hiba");
      return;
    }
    setNewDest({ name: "", price_ia: "0", price_i: "0", price_ii: "0", price_iii: "0", price_iv: "0" });
    await loadDest();
  }

  async function saveDestination() {
    if (!editDest) return;
    setDestErr(null);
    const res = await fetch("/api/admin/destinations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editDest.id,
        name: editDest.name,
        price_ia: Number(editDest.price_ia),
        price_i: Number(editDest.price_i),
        price_ii: Number(editDest.price_ii),
        price_iii: Number(editDest.price_iii),
        price_iv: Number(editDest.price_iv),
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setDestErr(data.error ?? "Hiba");
      return;
    }
    setEditDest(null);
    await loadDest();
  }

  async function deleteDestination(id: string) {
    if (!confirm("Törlöd ezt az úticélt?")) return;
    const res = await fetch("/api/admin/destinations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setDestErr(data.error ?? "Hiba");
      return;
    }
    await loadDest();
  }

  async function saveSettings() {
    setSetErr(null);
    setSetMsg(null);
    setSetSaving(true);
    const entries = Object.entries(setDraft).map(([key, value]) => ({ key, value }));
    const maxJsonChars = 3_000_000;
    const chunks: { key: string; value: string }[][] = [];
    let cur: { key: string; value: string }[] = [];
    for (const e of entries) {
      const next = [...cur, e];
      if (JSON.stringify({ entries: next }).length <= maxJsonChars) {
        cur = next;
        continue;
      }
      if (cur.length > 0) {
        chunks.push(cur);
        cur = [e];
      } else {
        cur = [e];
      }
      if (JSON.stringify({ entries: cur }).length > maxJsonChars) {
        setSetErr(
          `A(z) „${e.key}” értéke túl nagy egy kéréshez (pl. nagy kép). Használj kisebb képet, tömörített feltöltést, vagy külső kép URL-t.`,
        );
        setSetSaving(false);
        return;
      }
    }
    if (cur.length) chunks.push(cur);

    try {
      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: chunks[i] }),
        });
        let data: { ok: boolean; error?: string } = { ok: false };
        try {
          data = (await res.json()) as { ok: boolean; error?: string };
        } catch {
          /* üres / nem JSON válasz */
        }
        if (res.status === 413) {
          setSetErr(
            "A mentés mérete túl nagy a szerver számára. Csökkentsd a feltöltött képek méretét, vagy használj kép URL-t a data URI helyett.",
          );
          return;
        }
        if (!res.ok || !data.ok) {
          setSetErr(data.error ?? `Mentési hiba (${res.status}).`);
          return;
        }
      }
      await loadSettings();
      const part = chunks.length > 1 ? ` (${chunks.length} részletben)` : "";
      setSetMsg(`Mentés kész${part} (${new Date().toLocaleTimeString("hu-HU")}).`);
    } catch {
      setSetErr("Hálózati hiba");
    } finally {
      setSetSaving(false);
    }
  }

  function toggleOrderSel(id: string) {
    setSelectedOrders((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const encTotalPages = Math.max(1, Math.ceil(encTotal / encPerPage));

  const filteredEncOrders = encOrders.filter((o) => {
    const q = encQuery.trim().toLowerCase();
    const byText =
      !q ||
      o.device_identifier?.toLowerCase().includes(q) ||
      o.user_email?.toLowerCase().includes(q) ||
      normalizeAddressForDisplay(o.shipping_address).toLowerCase().includes(q);

    if (!byText) return false;
    if (encFilter === "active") return isOrderActive(o);
    if (encFilter === "shipped") return Boolean(o.shipped_at);
    if (encFilter === "archived") return Boolean(o.archived_at);
    if (encFilter === "cancelled") return Boolean(o.cancelled_at);
    return true;
  });

  const normalizedUsrQuery = usrQuery.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (!normalizedUsrQuery) return true;
    const email = (u.email ?? "").toLowerCase();
    const name = (u.name ?? "").toLowerCase();
    const deviceIdentifiers = u.devices.map((d) => d.identifier.toLowerCase());
    return (
      email.includes(normalizedUsrQuery) ||
      name.includes(normalizedUsrQuery) ||
      deviceIdentifiers.some((idf) => idf.includes(normalizedUsrQuery))
    );
  });
  const filteredDebtDeviceIds = Array.from(
    new Set(
      filteredUsers.flatMap((u) =>
        u.devices
          .filter((d) => Number(d.balance_huf ?? 0) < 0)
          .map((d) => d.identifier),
      ),
    ),
  );

  function selectAllActiveOrders() {
    const ids = filteredEncOrders.filter(isOrderActive).map((o) => o.id);
    setSelectedOrders(new Set(ids));
  }

  async function saveShippingAddress(orderId: string) {
    const shipping_address = editShippingAddress.trim();
    if (!shipping_address) {
      setEncErr("A szállítási cím nem lehet üres.");
      return;
    }
    try {
      await postOrderUpdate(orderId, "update_shipping", { shipping_address });
      setEditShippingOrderId(null);
      setEditShippingAddress("");
      await loadEnc();
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Hálózati hiba");
    }
  }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <nav className="space-y-1">
          {TABS.map((t) => {
            const selected = tab === t;
            const encCount = t === "Eszközrendelések" ? adminBadgeEnc : 0;
            const waitCount = t === "Készülékre vár" ? adminBadgeWait : 0;
            const debtCount = t === "Tartozás" ? adminBadgeDebt : 0;
            const bubbleCount = encCount + waitCount + debtCount;
            const tone: AdminSidebarBadgeTone | null =
              t === "Eszközrendelések" ? "enc" : t === "Készülékre vár" ? "wait" : t === "Tartozás" ? "debt" : null;
            const aria =
              bubbleCount > 0 && tone
                ? `${t}, ${bubbleCount} tétel figyelmet igényel`
                : undefined;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-label={aria}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  selected ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{t}</span>
                {tone ? <AdminSidebarTabBadge count={bubbleCount} selected={selected} tone={tone} /> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0 space-y-6">
        {tab === "Eszközrendelések" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">ENC rendelések</h2>
                <p className="text-xs text-slate-500">Átlátható státuszok és gyors műveletek soronként.</p>
              </div>
              <button
                type="button"
                onClick={() => loadEnc()}
                className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
              >
                Frissítés
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={encQuery}
                onChange={(e) => setEncQuery(e.target.value)}
                placeholder="Keresés: eszköz, e-mail, szállítási cím"
                className="min-w-[280px] flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
              />
              <select
                value={encFilter}
                onChange={(e) => setEncFilter(e.target.value as typeof encFilter)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="all">Összes</option>
                <option value="active">Aktív</option>
                <option value="shipped">Küldve</option>
                <option value="archived">Archív</option>
                <option value="cancelled">Törölt</option>
              </select>
              <button
                type="button"
                onClick={selectAllActiveOrders}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
              >
                Összes aktív kijelölése
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <span className="text-muted">Sor / oldal</span>
                <select
                  value={encPerPage}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v === 10 || v === 100 || v === 200) {
                      setEncPerPage(v);
                      setEncPage(1);
                    }
                  }}
                  className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
              <span className="text-muted">
                Összesen <strong className="text-foreground">{encTotal}</strong> rendelés
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={encPage <= 1 || encLoading}
                  onClick={() => setEncPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border bg-white px-2.5 py-1 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Előző
                </button>
                <span className="px-2 tabular-nums">
                  {encPage} / {encTotalPages}
                </span>
                <button
                  type="button"
                  disabled={encPage >= encTotalPages || encLoading}
                  onClick={() => setEncPage((p) => p + 1)}
                  className="rounded-lg border border-border bg-white px-2.5 py-1 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Következő
                </button>
              </div>
            </div>
            {selectedOrders.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2">
                <span className="text-sm font-medium text-indigo-900">{selectedOrders.size} kijelölt rendelés</span>
                <button
                  type="button"
                  onClick={() => bulkOrders("archive")}
                  disabled={bulkLabelsLoading}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-50"
                >
                  Archíválás
                </button>
                <button
                  type="button"
                  onClick={() => bulkOrders("restore")}
                  disabled={bulkLabelsLoading}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-50"
                >
                  Visszaállítás
                </button>
                <button
                  type="button"
                  onClick={() => bulkOrders("cancel")}
                  disabled={bulkLabelsLoading}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  Törlés
                </button>
                <button
                  type="button"
                  onClick={generateBulkOrderLabels}
                  disabled={bulkLabelsLoading}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkLabelsLoading ? "Címkék készítése..." : "Címkék tömeges generálása"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrders(new Set())}
                  disabled={bulkLabelsLoading}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-white"
                >
                  Kijelölés törlése
                </button>
              </div>
            )}
            {selectedOrders.size === 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Jelölj ki több rendelést a tömeges műveletekhez.
              </p>
            )}
            {encErr && <p className="mt-2 text-sm text-red-600">{encErr}</p>}
            <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="px-2 py-2"> </th>
                    <th className="px-2 py-2">Eszköz</th>
                    <th className="px-2 py-2">Állapot</th>
                    <th className="px-2 py-2">Összeg</th>
                    <th className="px-2 py-2">E-mail</th>
                    <th className="px-2 py-2">Szállítási cím</th>
                    <th className="px-2 py-2">Számlázási cím</th>
                    <th className="px-2 py-2">Tracking</th>
                    <th className="px-2 py-2">Műveletek</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEncOrders.map((o) => {
                    const statuses = getOrderStatuses(o);
                    return (
                      <tr key={o.id} className="border-b border-border/60 align-top hover:bg-slate-50/60">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            disabled={Boolean(o.shipped_at)}
                            checked={selectedOrders.has(o.id)}
                            onChange={() => toggleOrderSel(o.id)}
                          />
                        </td>
                        <td className="px-2 py-2 font-medium">{o.device_identifier ?? "—"}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            {statuses.map((status) => (
                              <span
                                key={`${o.id}-${status}`}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  status === "küldve"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : status === "törölve"
                                      ? "bg-red-100 text-red-800"
                                      : status === "archív"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {status}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2">{Number(o.amount_huf).toLocaleString("hu-HU")} Ft</td>
                        <td className="px-2 py-2">{o.user_email ?? "—"}</td>
                        <td className="max-w-[220px] px-2 py-2 text-xs text-slate-700">
                          {editShippingOrderId === o.id ? (
                            <div className="space-y-1">
                              <textarea
                                rows={3}
                                value={editShippingAddress}
                                onChange={(e) => setEditShippingAddress(e.target.value)}
                                className="w-full rounded border px-2 py-1 text-xs"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800"
                                  onClick={() => saveShippingAddress(o.id)}
                                >
                                  Mentés
                                </button>
                                <button
                                  type="button"
                                  className="rounded border px-2 py-1 text-[11px]"
                                  onClick={() => {
                                    setEditShippingOrderId(null);
                                    setEditShippingAddress("");
                                  }}
                                >
                                  Mégse
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{normalizeAddressForDisplay(o.shipping_address)}</p>
                          )}
                        </td>
                        <td className="max-w-[220px] px-2 py-2 text-xs text-slate-700">
                          <p className="whitespace-pre-wrap break-words">{normalizeAddressForDisplay(o.billing_address)}</p>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{o.tracking_number ?? "—"}</span>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-60"
                              disabled={labelLoadingForId === o.id}
                              onClick={() => downloadOrderLabel(o.id, o.tracking_number)}
                            >
                              {labelLoadingForId === o.id ? "…" : "PDF"}
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {SHOW_ORDER_SHIP_BUTTON && (
                              <button
                                type="button"
                                className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                                onClick={() => submitShip(o.id, o.tracking_number)}
                              >
                                Küldés
                              </button>
                            )}
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                              onClick={() => postOrderUpdate(o.id, "archive").then(loadEnc).catch((e) => setEncErr(String(e)))}
                            >
                              Archív
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                              onClick={() => postOrderUpdate(o.id, "restore").then(loadEnc).catch((e) => setEncErr(String(e)))}
                            >
                              Vissza
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                              onClick={() => {
                                setEditShippingOrderId(o.id);
                                setEditShippingAddress(o.shipping_address ?? "");
                              }}
                            >
                              Szállítási cím
                            </button>
                            <details className="relative">
                              <summary className="cursor-pointer list-none rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100">
                                Veszélyes ▾
                              </summary>
                              <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border bg-white p-1 shadow-lg">
                                <button
                                  type="button"
                                  className="w-full rounded-md px-2 py-1 text-left text-xs text-red-700 hover:bg-red-50"
                                  onClick={() => postOrderUpdate(o.id, "cancel").then(loadEnc).catch((e) => setEncErr(String(e)))}
                                >
                                  Törlés
                                </button>
                                <button
                                  type="button"
                                  className="w-full rounded-md px-2 py-1 text-left text-xs font-semibold text-red-800 hover:bg-red-50"
                                  onClick={() => deleteOrderPermanently(o.id)}
                                >
                                  Végleges törlés
                                </button>
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {encLoading && <p className="mt-2 px-2 py-2 text-sm text-muted">Betöltés…</p>}
              {!encLoading && filteredEncOrders.length === 0 && (
                <p className="mt-2 px-2 py-2 text-sm text-muted">Nincs rendelés.</p>
              )}
            </div>
          </div>
        )}

        {tab === "Készülékre vár" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <h2 className="text-xl font-semibold">Várólista</h2>
              <input
                value={waitQ}
                onChange={(e) => setWaitQ(e.target.value)}
                placeholder="Szűrés e-mailre"
                className="rounded-lg border px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => loadWait()} className="rounded-xl border px-3 py-1.5 text-sm">
                Frissítés
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={assignNext}
                className="rounded-xl bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"
              >
                {assigning ? "…" : "Kiosztás készletből"}
              </button>
            </div>
            {waitErr && <p className="mt-2 text-sm text-red-600">{waitErr}</p>}
            {assignErr && <p className="mt-2 text-sm text-red-600">{assignErr}</p>}
            {assignMsg && <p className="mt-2 text-sm text-emerald-700">{assignMsg}</p>}
            <table className="mt-4 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="px-2 py-2">E-mail</th>
                  <th className="px-2 py-2">Kat.</th>
                  <th className="px-2 py-2">Megjegyzés</th>
                  <th className="px-2 py-2">Idő</th>
                  <th className="px-2 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {waitlist
                  .filter((w) => (waitQ.trim() ? (w.user_email ?? "").toLowerCase().includes(waitQ.trim().toLowerCase()) : true))
                  .map((w) => (
                  <tr key={w.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{w.user_email ?? "—"}</td>
                    <td className="px-2 py-2">{w.category}</td>
                    <td className="px-2 py-2">{w.note ?? "—"}</td>
                    <td className="px-2 py-2">{new Date(w.created_at).toLocaleString("hu-HU")}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="mr-2 text-xs text-emerald-700 underline"
                        onClick={() => assignOneWaitlist(w.id)}
                      >
                        Kiosztás
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-700 underline"
                        onClick={() => removeWaitlist(w.id)}
                      >
                        Törlés
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {waitLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
          </div>
        )}

        {tab === "Elérhető eszközök" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Új eszköz</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={newIdf}
                  onChange={(e) => setNewIdf(e.target.value)}
                  placeholder="Azonosító"
                  className="rounded-lg border px-2 py-1 text-sm"
                />
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as DeviceCategoryValue)}
                  className="rounded-lg border px-2 py-1 text-sm"
                >
                  {DEVICE_CATEGORY_VALUES.map((c) => (
                    <option key={c} value={c}>
                      {DEVICE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={createDevice} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">
                  Létrehozás
                </button>
              </div>
            </div>
            <ImportDevicesForm />
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <h2 className="text-xl font-semibold">Eszközök</h2>
                <input
                  value={devicesQ}
                  onChange={(e) => setDevicesQ(e.target.value)}
                  placeholder="Keresés"
                  className="rounded-lg border px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => loadDevices()} className="rounded-lg border px-3 py-1.5 text-sm">
                  Keresés
                </button>
              </div>
              {devErr && <p className="mt-2 text-sm text-red-600">{devErr}</p>}
              <table className="mt-4 min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-2 py-2">Azonosító</th>
                    <th className="px-2 py-2">Kat.</th>
                    <th className="px-2 py-2">Státusz</th>
                    <th className="px-2 py-2">Rendszám</th>
                    <th className="px-2 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{d.identifier}</td>
                      <td className="px-2 py-2">{d.category}</td>
                      <td className="px-2 py-2">
                        {DEVICE_STATUS_LABELS[(d.status as (typeof DEVICE_STATUSES)[number]) ?? "available"] ??
                          d.status}
                      </td>
                      <td className="px-2 py-2">{d.license_plate ?? "—"}</td>
                      <td className="px-2 py-2">
                        <button type="button" className="text-xs text-primary underline" onClick={() => setEditDevice({ ...d })}>
                          Szerkesztés
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {devLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
            </div>
            {editDevice && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
                <h3 className="font-semibold">Eszköz szerkesztése</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-sm">
                    Azonosító
                    <input
                      value={editDevice.identifier}
                      onChange={(e) => setEditDevice({ ...editDevice, identifier: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  <label className="text-sm">
                    Kategória
                    <select
                      value={editDevice.category}
                      onChange={(e) => setEditDevice({ ...editDevice, category: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    >
                      {DEVICE_CATEGORY_VALUES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Státusz
                    <select
                      value={editDevice.status}
                      onChange={(e) => setEditDevice({ ...editDevice, status: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    >
                      {DEVICE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {DEVICE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Rendszám
                    <input
                      value={editDevice.license_plate ?? ""}
                      onChange={(e) => setEditDevice({ ...editDevice, license_plate: e.target.value || null })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  <label className="col-span-full text-sm">
                    Auth user id (üres = nincs)
                    <input
                      value={editDevice.auth_user_id ?? ""}
                      onChange={(e) => setEditDevice({ ...editDevice, auth_user_id: e.target.value || null })}
                      className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={saveDevice} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">
                    Mentés
                  </button>
                  <button type="button" onClick={() => setEditDevice(null)} className="rounded-lg border px-3 py-1.5 text-sm">
                    Mégse
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Úticélok" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Új úticél</h2>
              <p className="mt-1 text-xs text-slate-500">A kategóriaárak EUR-ban értendők.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-slate-600">
                  Úticél neve
                  <input
                    value={newDest.name}
                    onChange={(e) => setNewDest({ ...newDest, name: e.target.value })}
                    placeholder="Név"
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  />
                </label>
                {(
                  [
                    ["price_ia", "IA kategória (EUR)"],
                    ["price_i", "I kategória (EUR)"],
                    ["price_ii", "II kategória (EUR)"],
                    ["price_iii", "III kategória (EUR)"],
                    ["price_iv", "IV kategória (EUR)"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="text-xs text-slate-600">
                    {label}
                    <input
                      value={newDest[k]}
                      onChange={(e) => setNewDest({ ...newDest, [k]: e.target.value })}
                      placeholder="0"
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={createDestination}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white"
                >
                  Hozzáadás
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex gap-2">
                <h2 className="text-xl font-semibold">Úticél lista</h2>
                <button type="button" onClick={() => loadDest()} className="rounded border px-2 py-1 text-sm">
                  Frissítés
                </button>
              </div>
              {destErr && <p className="mt-2 text-sm text-red-600">{destErr}</p>}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="px-2 py-2">Név</th>
                      <th className="px-2 py-2">IA (EUR)</th>
                      <th className="px-2 py-2">I (EUR)</th>
                      <th className="px-2 py-2">II (EUR)</th>
                      <th className="px-2 py-2">III (EUR)</th>
                      <th className="px-2 py-2">IV (EUR)</th>
                      <th className="px-2 py-2"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dest.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="px-2 py-2 font-medium">{r.name}</td>
                        <td className="px-2 py-2">{r.price_ia}</td>
                        <td className="px-2 py-2">{r.price_i}</td>
                        <td className="px-2 py-2">{r.price_ii}</td>
                        <td className="px-2 py-2">{r.price_iii}</td>
                        <td className="px-2 py-2">{r.price_iv}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="text-xs text-primary underline"
                            onClick={() => setEditDest({ ...r })}
                          >
                            Szerkesztés
                          </button>
                          <button
                            type="button"
                            className="ml-2 text-xs text-red-700 underline"
                            onClick={() => deleteDestination(r.id)}
                          >
                            Törlés
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {destLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
              </div>
            </div>
            {editDest && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
                <h3 className="font-semibold">Szerkesztés: {editDest.name}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={editDest.name}
                    onChange={(e) => setEditDest({ ...editDest, name: e.target.value })}
                    className="rounded border px-2 py-1"
                  />
                  {(["price_ia", "price_i", "price_ii", "price_iii", "price_iv"] as const).map((k) => (
                    <input
                      key={k}
                      type="number"
                      step="0.01"
                      value={editDest[k]}
                      onChange={(e) => setEditDest({ ...editDest, [k]: e.target.value })}
                      className="rounded border px-2 py-1"
                    />
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={saveDestination} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">
                    Mentés
                  </button>
                  <button type="button" onClick={() => setEditDest(null)} className="rounded-lg border px-3 py-1.5 text-sm">
                    Mégse
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Útvonal feltöltés" && (
          <div className="space-y-6">
            <ImportRoutesForm />
            <AdminDataPanels
              routesOnly
              routesQueryExternal={routesQ}
              onRoutesQueryChange={setRoutesQ}
            />
          </div>
        )}

        {tab === "Tartozás" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Tartozás (negatív egyenlegek)</h2>
                  <p className="mt-1 text-sm text-muted">
                    Itt csak a 0 EUR alatti egyenlegű készülékek látszanak.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadWallets}
                  className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                  disabled={walletLoading}
                >
                  {walletLoading ? "Betöltés…" : "Frissítés"}
                </button>
              </div>
              {walletErr && <p className="mt-3 text-sm text-red-700">{walletErr}</p>}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="px-2 py-2">Eszköz</th>
                      <th className="px-2 py-2">Státusz</th>
                      <th className="px-2 py-2">Egyenleg</th>
                      <th className="px-2 py-2">Frissítve</th>
                      <th className="px-2 py-2">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletRows.filter((w) => (w.balance_huf ?? 0) < 0).map((w) => {
                      const bal = w.balance_huf ?? 0;
                      const balEur = hufToEur(bal, fxEurToHuf);
                      const ok = bal >= minBalanceWarningHuf;
                      return (
                        <tr key={w.identifier} className="border-b border-border/60">
                          <td className="px-2 py-2 font-medium">{w.identifier}</td>
                          <td className="px-2 py-2">{DEVICE_STATUS_LABELS[w.status as keyof typeof DEVICE_STATUS_LABELS] ?? w.status}</td>
                          <td className="px-2 py-2">
                            <span className={`font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>
                              {balEur.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-600">
                            {w.updated_at ? new Date(w.updated_at).toLocaleString("hu-HU") : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="text-xs text-primary underline"
                              onClick={() => {
                                setWalletAdjustDeviceId(w.identifier);
                                setWalletAdjustNewBalance(
                                  balEur.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                );
                                setWalletAdjustReason("");
                                setWalletAdjustErr(null);
                                setWalletAdjustMsg(null);
                              }}
                            >
                              Szerkesztés
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {walletRows.filter((w) => (w.balance_huf ?? 0) < 0).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-4 text-sm text-muted">
                          Nincs negatív egyenlegű eszköz.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Kézi wallet állítás</h2>
                <p className="text-sm text-slate-600">Egyenleg módosítás (admin).</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Eszközazonosító (`device_identifier`)
                  <input
                    value={walletAdjustDeviceId}
                    onChange={(e) => setWalletAdjustDeviceId(e.target.value)}
                    placeholder="pl. 024354542"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  Új egyenleg (EUR)
                  <input
                    value={walletAdjustNewBalance}
                    onChange={(e) =>
                      setWalletAdjustNewBalance(e.target.value.replace(/[^\d,.\-]/g, "").slice(0, 12))
                    }
                    placeholder="pl. 12,50"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    inputMode="decimal"
                  />
                </label>
                <label className="sm:col-span-2 text-sm">
                  Megjegyzés (opcionális)
                  <input
                    value={walletAdjustReason}
                    onChange={(e) => setWalletAdjustReason(e.target.value)}
                    placeholder="Miért módosítunk?"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {walletAdjustErr && <p className="mt-3 text-sm text-red-700">{walletAdjustErr}</p>}
              {walletAdjustMsg && <p className="mt-3 text-sm text-emerald-700">{walletAdjustMsg}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={walletAdjustLoading}
                  onClick={async () => {
                    await submitWalletAdjust();
                    await loadWallets();
                  }}
                  className="rounded-lg bg-indigo-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:opacity-60"
                >
                  {walletAdjustLoading ? "Állítás…" : "Egyenleg beállítása"}
                </button>
                <button
                  type="button"
                  disabled={walletAdjustLoading}
                  onClick={() => {
                    setWalletAdjustDeviceId("");
                    setWalletAdjustNewBalance("");
                    setWalletAdjustReason("");
                    setWalletAdjustErr(null);
                    setWalletAdjustMsg(null);
                  }}
                  className="rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                >
                  Törlés
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "Felhasználók" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex gap-2">
              <h2 className="text-xl font-semibold">Felhasználók (Auth)</h2>
              <button
                type="button"
                onClick={() => sendDebtWarnings([...selectedDebtDevices])}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-sm text-amber-900"
              >
                Tartozás figyelmeztető e-mail (kijelöltek)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDebtDevices(new Set(filteredDebtDeviceIds))}
                className="rounded border px-2 py-1 text-sm"
              >
                Összes tartozás kijelölése
              </button>
              <button
                type="button"
                onClick={() => setSelectedDebtDevices(new Set())}
                className="rounded border px-2 py-1 text-sm"
              >
                Kijelölés törlése
              </button>
              <button type="button" onClick={() => loadUsers()} className="rounded border px-2 py-1 text-sm">
                Frissítés
              </button>
            </div>
            {usrErr && <p className="mt-2 text-sm text-red-600">{usrErr}</p>}
            {usrMsg && <p className="mt-2 text-sm text-emerald-700">{usrMsg}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={usrQuery}
                onChange={(e) => setUsrQuery(e.target.value)}
                placeholder="Keresés: név, e-mail vagy eszközazonosító"
                className="min-w-[280px] flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
              />
              {usrQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setUsrQuery("")}
                  className="rounded border px-2 py-1 text-sm"
                >
                  Törlés
                </button>
              )}
            </div>
            <table className="mt-4 w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="w-[24%] px-1.5 py-1.5">E-mail</th>
                  <th className="w-[10%] px-1.5 py-1.5">Típus</th>
                  <th className="w-[19%] px-1.5 py-1.5">Profil adatok</th>
                  <th className="w-[39%] px-1.5 py-1.5">Készülékek / egyenleg</th>
                  <th className="w-[8%] px-1.5 py-1.5">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-1.5 py-1.5">
                      <div className="font-medium">{u.email ?? "—"}</div>
                      <div className="text-[11px] text-slate-500">
                        Reg: {new Date(u.created_at).toLocaleString("hu-HU")}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Belépés: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("hu-HU") : "—"}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5">{u.user_type === "company" ? "Cég" : "Magánszemély"}</td>
                    <td className="px-1.5 py-1.5 text-xs">
                      <div>{u.name ?? "—"}</div>
                      <div className="text-slate-500">{u.phone ?? "—"}</div>
                      {u.user_type === "company" && (
                        <>
                          <div className="mt-1">{u.company_name ?? "—"}</div>
                          <div className="text-slate-500">{u.tax_number ?? "—"}</div>
                        </>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div className="space-y-1">
                        {u.devices.length === 0 && <div className="text-xs text-muted">Nincs eszköz</div>}
                        {u.devices.map((d) => {
                          const bal = Number(d.balance_huf ?? 0);
                          const balEur = hufToEur(bal, fxEurToHuf);
                          const debt = bal < 0;
                          return (
                            <div key={d.identifier} className="flex items-center gap-2 text-xs">
                              {debt && (
                                <input
                                  type="checkbox"
                                  checked={selectedDebtDevices.has(d.identifier)}
                                  onChange={() => toggleDebtDevice(d.identifier)}
                                />
                              )}
                              <span className="font-mono">{d.identifier}</span>
                              <span className={debt ? "font-semibold text-red-700" : "text-slate-700"}>
                                {Number.isFinite(balEur)
                                  ? `${balEur.toLocaleString("hu-HU", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} EUR`
                                  : "—"}
                              </span>
                              {debt && (
                                <button
                                  type="button"
                                  className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] text-amber-900"
                                  onClick={() => sendDebtWarnings([d.identifier])}
                                >
                                  Figyelmeztetés
                                </button>
                              )}
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                onClick={() => quickAdjustUserDeviceBalance(d.identifier, d.balance_huf)}
                                title="Egyenleg állítás"
                                aria-label="Egyenleg állítás"
                              >
                                $
                              </button>
                              <button
                                type="button"
                                disabled={unlinkingUserDevice === `${u.id}:${d.identifier}`}
                                className="rounded border border-red-200 bg-red-50 px-1 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                                title="Készülék leválasztása a fiókról (nem tud majd tölteni)"
                                onClick={() => unlinkUserDevice(u.id, d.identifier)}
                              >
                                {unlinkingUserDevice === `${u.id}:${d.identifier}` ? "…" : "Leválaszt"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <button
                        type="button"
                        className="text-[11px] text-primary underline"
                        onClick={() => setEditUser({ ...u })}
                      >
                        Szerkesztés
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!usrLoading && filteredUsers.length === 0 && (
              <p className="mt-2 text-sm text-muted">Nincs találat a megadott szűrésre.</p>
            )}
            {usrLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
            {editUser && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
                <h3 className="font-semibold">Felhasználó szerkesztése: {editUser.email ?? editUser.id}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-sm">
                    Fiók típusa
                    <select
                      value={editUser.user_type ?? "private"}
                      onChange={(e) => setEditUser({ ...editUser, user_type: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    >
                      <option value="private">Magánszemély</option>
                      <option value="company">Cég</option>
                    </select>
                  </label>
                  <label className="text-sm sm:col-span-2">
                    E-mail cím
                    <input
                      type="email"
                      value={editUser.email ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, email: e.target.value || null })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  <label className="text-sm">
                    Név
                    <input
                      value={editUser.name ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  <label className="text-sm">
                    Telefon
                    <input
                      value={editUser.phone ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  {editUser.user_type === "company" && (
                    <>
                      <label className="text-sm">
                        Cégnév
                        <input
                          value={editUser.company_name ?? ""}
                          onChange={(e) => setEditUser({ ...editUser, company_name: e.target.value })}
                          className="mt-1 w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="text-sm">
                        Adószám
                        <input
                          value={editUser.tax_number ?? ""}
                          onChange={(e) => setEditUser({ ...editUser, tax_number: e.target.value })}
                          className="mt-1 w-full rounded border px-2 py-1"
                        />
                      </label>
                    </>
                  )}
                  <label className="text-sm sm:col-span-2">
                    Számlázási cím
                    <textarea
                      rows={2}
                      value={editUser.billing_address ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, billing_address: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Szállítási cím
                    <textarea
                      rows={2}
                      value={editUser.shipping_address ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, shipping_address: e.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1"
                    />
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={saveUserProfile} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">
                    Mentés
                  </button>
                  <button type="button" onClick={() => setEditUser(null)} className="rounded-lg border px-3 py-1.5 text-sm">
                    Mégse
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Beállítások" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex gap-2">
              <h2 className="text-xl font-semibold">Rendszerbeállítások</h2>
              <button type="button" onClick={() => loadSettings()} className="rounded border px-2 py-1 text-sm">
                Frissítés
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={setSaving || setLoading}
                className="rounded bg-primary px-2 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setSaving ? "Mentés folyamatban..." : "Összes mentése"}
              </button>
            </div>
            {setErr && <p className="mt-2 text-sm text-red-600">{setErr}</p>}
            {!setErr && setMsg && <p className="mt-2 text-sm text-emerald-700">{setMsg}</p>}
            <div className="mt-4 space-y-2">
              {settings.filter((s) => isTechnicalSettingKey(s.key)).map((s) => (
                <div key={s.key} className="flex flex-wrap items-start gap-2 text-sm">
                  <div className="w-56 shrink-0">
                    <p className="font-medium text-foreground">{SETTINGS_META[s.key]?.label ?? s.key}</p>
                    <p className="text-xs text-muted">{SETTINGS_META[s.key]?.hint ?? "Technikai beállítás."}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{s.key}</p>
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <input
                      value={setDraft[s.key] ?? ""}
                      onChange={(e) => setSetDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                      className="w-full rounded border px-2 py-1"
                    />
                    {isHeroImageSettingKey(s.key) && (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900 hover:bg-blue-100">
                        Kép feltöltése
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            void uploadHeroImageToSetting(s.key, e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {!setLoading && settings.filter((s) => isTechnicalSettingKey(s.key)).length === 0 && (
                <p className="text-sm text-muted">Nincs technikai beállítás.</p>
              )}
            </div>
            {setLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
          </div>
        )}

        {tab === "Szövegek" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex gap-2">
              <h2 className="text-xl font-semibold">Szövegek</h2>
              <button type="button" onClick={() => loadSettings()} className="rounded border px-2 py-1 text-sm">
                Frissítés
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={setSaving || setLoading}
                className="rounded bg-primary px-2 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setSaving ? "Mentés folyamatban..." : "Összes mentése"}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Itt szerkeszthetők a főoldal, dashboard, rendelés és ajánlói panel felhasználói szövegei.
            </p>
            {setErr && <p className="mt-2 text-sm text-red-600">{setErr}</p>}
            {!setErr && setMsg && <p className="mt-2 text-sm text-emerald-700">{setMsg}</p>}
            <div className="mt-4 space-y-2">
              {settings.filter((s) => isContentSettingKey(s.key) && !isBlogSettingKey(s.key)).map((s) => (
                <div key={s.key} className="flex flex-wrap items-start gap-2 text-sm">
                  <div className="w-56 shrink-0">
                    <p className="font-medium text-foreground">{SETTINGS_META[s.key]?.label ?? s.key}</p>
                    <p className="text-xs text-muted">{SETTINGS_META[s.key]?.hint ?? "Szöveg beállítás."}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{s.key}</p>
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-2">
                    {isMultilineContentSettingKey(s.key) ? (
                      <textarea
                        value={setDraft[s.key] ?? ""}
                        onChange={(e) => setSetDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                        className="min-h-[96px] w-full rounded border px-2 py-1"
                      />
                    ) : (
                      <input
                        value={setDraft[s.key] ?? ""}
                        onChange={(e) => setSetDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                        className="w-full rounded border px-2 py-1"
                      />
                    )}
                    {isLegalDocumentSettingKey(s.key) && (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-900 hover:bg-indigo-100">
                        Dokumentum feltöltése
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={(e) => {
                            void uploadLegalDocumentToSetting(s.key, e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {!setLoading && settings.filter((s) => isContentSettingKey(s.key) && !isBlogSettingKey(s.key)).length === 0 && (
                <p className="text-sm text-muted">Nincs szerkeszthető szöveg.</p>
              )}
            </div>
            {setLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
          </div>
        )}

        {tab === "Blog" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <h2 className="text-xl font-semibold">Blog</h2>
              <button type="button" onClick={() => loadSettings()} className="rounded border px-2 py-1 text-sm">
                Frissítés
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={setSaving || setLoading}
                className="rounded bg-primary px-2 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setSaving ? "Mentés folyamatban..." : "Összes mentése"}
              </button>
              <button
                type="button"
                onClick={addBlogPost}
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
              >
                + Új blog hozzáadása
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Itt szerkesztheted a főoldali blog szekciót, a bejegyzéseket, képeket, és innen tudsz új bejegyzést hozzáadni vagy törölni.
            </p>
            {setErr && <p className="mt-2 text-sm text-red-600">{setErr}</p>}
            {!setErr && setMsg && <p className="mt-2 text-sm text-emerald-700">{setMsg}</p>}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <div className="w-56 shrink-0">
                  <p className="font-medium text-foreground">{SETTINGS_META.home_blog_title?.label ?? "Blog cím"}</p>
                  <p className="text-xs text-muted">{SETTINGS_META.home_blog_title?.hint ?? "Szekció cím."}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">home_blog_title</p>
                </div>
                <div className="min-w-[200px] flex-1">
                  <input
                    value={setDraft.home_blog_title ?? ""}
                    onChange={(e) => setSetDraft((d) => ({ ...d, home_blog_title: e.target.value }))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <div className="w-56 shrink-0">
                  <p className="font-medium text-foreground">
                    {SETTINGS_META.home_blog_subtitle?.label ?? "Blog alcím"}
                  </p>
                  <p className="text-xs text-muted">{SETTINGS_META.home_blog_subtitle?.hint ?? "Szekció leírás."}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">home_blog_subtitle</p>
                </div>
                <div className="min-w-[200px] flex-1">
                  <input
                    value={setDraft.home_blog_subtitle ?? ""}
                    onChange={(e) => setSetDraft((d) => ({ ...d, home_blog_subtitle: e.target.value }))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <div className="w-56 shrink-0">
                  <p className="font-medium text-foreground">
                    {SETTINGS_META.home_blog_read_more_label?.label ?? "Tovább gomb felirat"}
                  </p>
                  <p className="text-xs text-muted">
                    {SETTINGS_META.home_blog_read_more_label?.hint ?? "Kártya alján lévő link felirata."}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">home_blog_read_more_label</p>
                </div>
                <div className="min-w-[200px] flex-1">
                  <input
                    value={setDraft.home_blog_read_more_label ?? ""}
                    onChange={(e) => setSetDraft((d) => ({ ...d, home_blog_read_more_label: e.target.value }))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 text-sm">
                <div className="w-56 shrink-0">
                  <p className="font-medium text-foreground">
                    {SETTINGS_META.home_blog_load_more_label?.label ?? "További blog gomb"}
                  </p>
                  <p className="text-xs text-muted">
                    {SETTINGS_META.home_blog_load_more_label?.hint ??
                      "Egyszerre 3 cikk a főoldalon; a gomb további 3-at tölt be."}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">home_blog_load_more_label</p>
                </div>
                <div className="min-w-[200px] flex-1">
                  <input
                    value={setDraft.home_blog_load_more_label ?? ""}
                    onChange={(e) => setSetDraft((d) => ({ ...d, home_blog_load_more_label: e.target.value }))}
                    className="w-full rounded border px-2 py-1"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-3 text-xs text-muted">
                A bejegyzések táblázatban láthatók. Kattints a <strong>Szerkesztés</strong> gombra — ott érhető el a
                formázott szerkesztő (címsor, félkövér, kép, link). A régi, sima szöveges cikkek változatlanul
                megjelennek; új tartalom HTML-ként mentődik.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border bg-white/80">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Dátum</th>
                      <th className="px-3 py-2">Cím</th>
                      <th className="px-3 py-2">Kivonat</th>
                      <th className="px-3 py-2">URL (slug)</th>
                      <th className="px-3 py-2 text-right">Művelet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blogPosts.map((post, index) => (
                      <tr
                        key={post.id}
                        className={`border-b border-border last:border-b-0 ${blogEditId === post.id ? "bg-primary/8" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="px-3 py-2 align-top text-muted">{index + 1}</td>
                        <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">{post.date || "—"}</td>
                        <td className="px-3 py-2 align-top font-medium text-foreground">
                          {post.title || <span className="text-muted italic">(névtelen)</span>}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 align-top text-slate-600">
                          {(post.excerpt || "").length > 72 ? `${(post.excerpt || "").slice(0, 72)}…` : post.excerpt || "—"}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 align-top font-mono text-xs text-slate-500">
                          {post.slug || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setBlogEditId(post.id)}
                            className="mr-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                          >
                            Szerkesztés
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBlogPost(post.id)}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Törlés
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {blogPosts.length === 0 && <p className="mt-3 text-sm text-muted">Még nincs blog bejegyzés.</p>}

              {editingPost && (
                <div className="mt-6 rounded-xl border-2 border-primary/30 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      Bejegyzés szerkesztése
                      {editingPost.title ? ` — ${editingPost.title}` : ""}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setBlogEditId(null)}
                      className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Bezárás
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Cím
                      <input
                        value={editingPost.title}
                        onChange={(e) => updateBlogPost(editingPost.id, { title: e.target.value })}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Dátum
                      <input
                        value={editingPost.date}
                        onChange={(e) => updateBlogPost(editingPost.id, { date: e.target.value })}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        placeholder="2026-03-30"
                      />
                    </label>
                    <label className="text-xs text-slate-600 md:col-span-2">
                      URL cím (slug) — SEO; üresen a címből generálódik mentéskor
                      <input
                        value={editingPost.slug}
                        onChange={(e) => updateBlogPost(editingPost.id, { slug: e.target.value })}
                        className="mt-1 w-full rounded border px-2 py-1 font-mono text-sm"
                        placeholder="pl. uj-hir-cikk"
                      />
                    </label>
                    <label className="text-xs text-slate-600 md:col-span-2">
                      Rövid kivonat (kártyán látszik)
                      <textarea
                        rows={3}
                        value={editingPost.excerpt}
                        onChange={(e) => updateBlogPost(editingPost.id, { excerpt: e.target.value })}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-600">Teljes tartalom (részletes oldal)</p>
                      <div className="mt-1">
                        <BlogRichEditor
                          value={editingPost.content}
                          onChange={(html) => updateBlogPost(editingPost.id, { content: html })}
                        />
                      </div>
                    </div>
                    <label className="text-xs text-slate-600 md:col-span-2">
                      Borítókép URL (feltöltés → Supabase Storage; vagy ide írhatsz külső linket)
                      <input
                        value={editingPost.image_url}
                        onChange={(e) => updateBlogPost(editingPost.id, { image_url: e.target.value })}
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        placeholder="https://... vagy feltöltött data URI"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900 hover:bg-blue-100">
                        Borítókép feltöltése
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            void uploadBlogImage(editingPost.id, e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {editingPost.image_url && (
                      <div className="md:col-span-2">
                        <img
                          src={editingPost.image_url}
                          alt={editingPost.title || "Blog kép előnézet"}
                          className="h-36 w-full max-w-md rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {setLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
          </div>
        )}

        {tab === "Audit / napló" && <AdminDataPanels auditOnly />}
      </article>
    </section>
  );
}
