import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { getTopupBlockSmallestCategoriesFromString } from "@/lib/topup-calculations";
import { DEFAULT_HOME_BLOG_POSTS } from "./home-blog";

export const SETTINGS_DEFAULTS: Record<string, string> = {
  device_price_huf: "499000",
  min_balance_warning_huf: "5000",
  topup_discount_percent: "0",
  /** Egyéni (listán kívüli) úticél esetén a minimum feltöltendő összeg EUR-ban. 0 = nincs külön padló (csak az általános minimum). */
  topup_custom_destination_min_eur: "30",
  fx_eur_to_huf: "400",
  topup_package_1_huf: "40",
  topup_package_2_huf: "60",
  topup_package_3_huf: "100",
  /** Vesszovel elvalasztott kategoriak (pl. ii,iii,iv): ezekhez nem valaszthato a legkisebb topup csomag. */
  topup_block_smallest_for_categories: "ii,iii,iv",
  /** Meghívott első készülékvásárlásakor ennyi Ft (max) kerül a készülék walletjébe; a Stripe-ban a teljes készülékár fizetendő. */
  referral_device_discount_huf: "25000",
  hero_bg_desktop: "/images/enc-hero-bg.png",
  hero_bg_tablet: "/images/enc-hero-bg.png",
  hero_bg_mobile: "/images/enc-hero-bg.png",
  mpl_sender_country: "Magyarország",
  mpl_sender_zip: "1138",
  mpl_sender_city: "Budapest",
  mpl_sender_street: "Fő utca 1.",
  mpl_sender_remark: "admin beállítás",
  mpl_sender_name: "AdriaGo Feladó",
  mpl_sender_email: "teszt@pelda.hu",
  mpl_sender_phone: "+36201234567",
  home_platform_label: "AdriaGo Platform",
  home_hero_title: "ENC vásárlás és útdíjkezelés egyetlen modern rendszerben.",
  home_hero_subtitle:
    "Eszközrendelés, egyenlegfeltöltés, útvonaladatok kezelése és adminisztráció — prémium felületen, biztonságos fizetéssel.",
  home_cta_order_label: "Eszközrendelés",
  home_cta_topup_label: "Egyenlegfeltöltés",
  home_steps_title: "Így működik az AdriaGo",
  home_steps_subtitle:
    "Néhány egyszerű lépésben elindulhatsz, és minden fontos adatot egy helyen kezelhetsz.",
  home_step_1_title: "Regisztráció és profil",
  home_step_1_desc: "Hozd létre a fiókodat, majd add meg az alapadataidat és a számlázási címet.",
  home_step_2_title: "ENC készülék rendelés",
  home_step_2_desc: "Válaszd ki a járműkategóriát, add meg a rendszámot, és indítsd el a rendelést.",
  home_step_3_title: "Egyenleg feltöltése",
  home_step_3_desc: "Töltsd fel az egyenlegedet a megfelelő csomaggal, hogy indulhass az utazásra.",
  home_step_4_title: "Utazás és követés",
  home_step_4_desc: "Használd az ENC készüléket, a rendszerben pedig bármikor ellenőrizd a történetet.",
  home_features_title: "Minden, ami az ENC kezeléshez kell",
  home_features_subtitle:
    "Egy platformon kezeled az eszközeidet, az egyenlegedet és az adminisztrációt.",
  home_feature_1_title: "ENC eszközrendelés",
  home_feature_1_desc:
    "Válaszd ki a járműkategóriát, add meg a rendszámot és fizess biztonságosan Stripe-on keresztül.",
  home_feature_2_title: "Egyenlegfeltöltés",
  home_feature_2_desc:
    "Választható csomagokkal gyorsan feltöltheted az egyenlegedet az utazásaidhoz.",
  home_feature_3_title: "Útvonalkövetés",
  home_feature_3_desc: "CSV import, automatikus wallet-levonás, árfolyamkezelés és teljes úttörténet.",
  home_feature_4_title: "Gyors ügyintézés",
  home_feature_4_desc:
    "Átlátható rendelési folyamat, egyértelmű visszajelzések és gyors státuszkövetés egy helyen.",
  home_feature_5_title: "Profil és számlázás",
  home_feature_5_desc:
    "Személyes és számlázási adataidat bármikor frissítheted egy felületen.",
  home_feature_6_title: "Biztonság",
  home_feature_6_desc:
    "Biztonságos online fizetés, megbízható tranzakciókezelés és védett fiókhasználat.",
  home_faq_title: "Gyakori kérdések",
  home_faq_subtitle: "A legfontosabb tudnivalók az ENC rendelésről és használatról.",
  home_faq_1_question: "Mennyi idő alatt érkezik meg az ENC készülék?",
  home_faq_1_answer:
    "A rendelés feldolgozása után e-mailben küldünk visszaigazolást, a szállítás ideje jellemzően 1-3 munkanap.",
  home_faq_2_question: "Hogyan tudom feltölteni az egyenlegemet?",
  home_faq_2_answer:
    "A Feltöltés oldalon úticél választás után megadod az összeget, majd Stripe fizetéssel pár kattintásban feltöltheted az egyenleget.",
  home_faq_3_question: "Látom valahol a készülékem és az egyenlegem állapotát?",
  home_faq_3_answer:
    "Igen, a Fiókom oldalon eszközönként látod az aktuális egyenleget, valamint a feltöltési és útvonal előzményeket is.",
  home_faq_4_question: "Mi történik, ha alacsony az egyenlegem?",
  home_faq_4_answer:
    "A rendszer automatikus figyelmeztető e-mailt küld, amikor az egyenleged a beállított küszöb alá csökken.",
  home_blog_title: "Blog",
  home_blog_subtitle: "Hírek, tippek és hasznos tudnivalók ENC használathoz.",
  home_blog_read_more_label: "Tovább olvasom",
  home_blog_load_more_label: "Következő blogcikkek",
  home_blog_posts_json: JSON.stringify(DEFAULT_HOME_BLOG_POSTS),
  home_final_title: "Készen állsz?",
  home_final_subtitle:
    "Hozd létre a fiókodat és rendeld meg az ENC készülékedet néhány perc alatt.",
  home_final_register_cta: "Ingyenes regisztráció",
  home_final_contact_cta: "Kapcsolatfelvétel",
  dashboard_page_title: "Fiókom",
  dashboard_order_cta: "ENC megrendelés",
  dashboard_topup_cta: "Egyenlegfeltöltés",
  dashboard_intro_text: "Saját eszközök, egyenleg, úttörténet és profil. Alacsony egyenleg küszöb:",
  dashboard_profile_required_title: "Profil kitöltése szükséges",
  dashboard_profile_required_text:
    "A rendeléshez és feltöltéshez előbb töltsd ki a profil és címek adatokat.",
  dashboard_profile_required_cta: "Profil kitöltése most",
  dashboard_profile_section_title: "Profil és címek",
  dashboard_profile_section_subtitle: "Számlázás és szállítás.",
  dashboard_devices_empty_title: "Még nincs hozzárendelt készüléked",
  dashboard_devices_empty_text:
    "Töltsd ki a profilodat, majd indíts új rendelést az ENC készülékhez.",
  dashboard_devices_empty_cta: "Rendelés indítása",
  dashboard_route_title: "Úttörténet (utolsó 50)",
  dashboard_route_subtitle:
    "Importált útvonal- és kapurekordok a saját készülékazonosítók alapján.",
  dashboard_route_empty: "Még nincs rögzített út a készülékekhez.",
  dashboard_wallet_title: "Wallet-egyenlegek",
  dashboard_wallet_subtitle: "Eszközönkénti aktuális egyenleg.",
  dashboard_wallet_empty: "Még nincs wallet-rekord.",
  dashboard_topups_title: "Feltöltési előzmények",
  dashboard_topups_subtitle: "Stripe-fizetések (e-mail alapján).",
  dashboard_topups_empty: "Még nincs feltöltési rekord.",
  referral_section_title: "Ajánlás",
  referral_section_subtitle_prefix: "Meghívó küldése e-mailben. A meghívott első készülékvásárlásakor",
  referral_section_subtitle_suffix: "EUR induló egyenleg kerül a készülékhez (wallet).",
  referral_email_placeholder: "meghivott@pelda.hu",
  referral_send_button: "Meghívó küldése",
  referral_success_message: "Meghívó elküldve.",
  referral_empty_message: "Még nincs kiküldött meghívó.",
  referral_status_sent: "Kiküldve",
  referral_status_registered: "Regisztrált",
  referral_status_discount_used: "Induló egyenleg felhasználva",
  order_category_guide_title: "Kategória magyarázó",
  order_category_guide_subtitle: "Válaszd ki a kategóriát, és ellenőrizd a fő szempontokat.",
  order_category_guide_ia_items: "Motorkerékpár\n2 tengely\nAlacsonyabb járműmagasság",
  order_category_guide_i_items: "Személyautó\nKisbusz\n2 tengely, lakókocsi/pótkocsi nélkül",
  order_category_guide_ii_items: "Kisteherautó\n2 tengely, magasabb felépítmény\nNagyobb össztömeg vagy méret",
  order_category_guide_iii_items: "Busz\n3 tengely\nNagyobb járműkategória",
  order_category_guide_iv_items: "Nehézteherautó\n4 vagy több tengely\nLegmagasabb díjkategória",
  aszf_title: "Általános Szerződési Feltételek",
  aszf_intro:
    "Ez egy helyőrző oldal. Az első valódi jogi szöveget cseréld le a Google Docs / ügyvédi dokumentum alapján.",
  aszf_document_url: "",
  aszf_content:
    "1. Szolgáltatás\nENC eszköz értékesítés, egyenlegfeltöltés, útdíj levonás — részletes leírás szükséges.\n\n2. Fizetés és szállítás\nStripe fizetés; szállítási és garanciális feltételek — pótolni.\n\n3. Panaszkezelés és visszavonás\nPanaszkezelési eljárás, elállás — pótolni.",
  adatvedelem_title: "Adatvédelmi tájékoztató",
  adatvedelem_intro:
    "Helyőrző. Illeszd be a GDPR / 2011. évi CXII. törvény szerinti teljes szöveget, illetve a cookie / marketing beállításokat.",
  adatvedelem_document_url: "",
  adatvedelem_content:
    "Adatkezelő\nAdatkezelő megnevezése és elérhetősége — pótolni.\n\nKezelt adatkörök\nFiók, rendelés, fizetés, üzenetek — pótolni.\n\nTárolási idő, jogalapok\nRészletes tárolási idő és jogalapok — pótolni.",
};

export async function getSettingsMap(): Promise<Record<string, string>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("settings").select("key, value");
  const map: Record<string, string> = { ...SETTINGS_DEFAULTS };
  for (const row of data ?? []) {
    if (row.key && row.value != null) {
      map[row.key] = String(row.value);
    }
  }
  return map;
}

export function getIntSetting(map: Record<string, string>, key: string, fallback: number): number {
  const v = map[key];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function getFloatSetting(map: Record<string, string>, key: string, fallback: number): number {
  const raw = map[key];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number.parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function getTopupPackagesFromSettings(map: Record<string, string>): number[] {
  const a = getIntSetting(map, "topup_package_1_huf", 40);
  const b = getIntSetting(map, "topup_package_2_huf", 60);
  const c = getIntSetting(map, "topup_package_3_huf", 100);
  return Array.from(new Set([a, b, c])).sort((x, y) => x - y);
}

export {
  applyTopupDiscount,
  isSmallestTopupPackage,
  isTopupPackageBlockedForCategory,
} from "@/lib/topup-calculations";

/** Kategoriak, amelyeknel a legkisebb (1.) csomag nem valaszthato. */
export function getTopupBlockSmallestCategories(map: Record<string, string>): Set<string> {
  return getTopupBlockSmallestCategoriesFromString(
    map.topup_block_smallest_for_categories ?? SETTINGS_DEFAULTS.topup_block_smallest_for_categories,
  );
}
