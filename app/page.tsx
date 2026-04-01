import Link from "next/link";
import { getSettingsMap } from "@/lib/app-settings";

export default async function Home() {
  const settings = await getSettingsMap();
  const text = (key: string, fallback: string) => settings[key]?.trim() || fallback;
  const steps = [
    {
      title: text("home_step_1_title", "Regisztráció és profil"),
      desc: text(
        "home_step_1_desc",
        "Hozd létre a fiókodat, majd add meg az alapadataidat és a számlázási címet.",
      ),
    },
    {
      title: text("home_step_2_title", "ENC készülék rendelés"),
      desc: text(
        "home_step_2_desc",
        "Válaszd ki a járműkategóriát, add meg a rendszámot, és indítsd el a rendelést.",
      ),
    },
    {
      title: text("home_step_3_title", "Egyenleg feltöltése"),
      desc: text(
        "home_step_3_desc",
        "Töltsd fel az egyenlegedet a megfelelő csomaggal, hogy indulhass az utazásra.",
      ),
    },
    {
      title: text("home_step_4_title", "Utazás és követés"),
      desc: text(
        "home_step_4_desc",
        "Használd az ENC készüléket, a rendszerben pedig bármikor ellenőrizd a történetet.",
      ),
    },
  ];
  const features = [
    {
      title: text("home_feature_1_title", "ENC eszközrendelés"),
      desc: text(
        "home_feature_1_desc",
        "Válaszd ki a járműkategóriát, add meg a rendszámot és fizess biztonságosan Stripe-on keresztül.",
      ),
      icon: "📦",
    },
    {
      title: text("home_feature_2_title", "Egyenlegfeltöltés"),
      desc: text(
        "home_feature_2_desc",
        "Választható csomagokkal gyorsan feltöltheted az egyenlegedet az utazásaidhoz.",
      ),
      icon: "💳",
    },
    {
      title: text("home_feature_3_title", "Útvonalkövetés"),
      desc: text(
        "home_feature_3_desc",
        "CSV import, automatikus wallet-levonás, árfolyamkezelés és teljes úttörténet.",
      ),
      icon: "🛣️",
    },
    {
      title: text("home_feature_4_title", "Gyors ügyintézés"),
      desc: text(
        "home_feature_4_desc",
        "Átlátható rendelési folyamat, egyértelmű visszajelzések és gyors státuszkövetés egy helyen.",
      ),
      icon: "⚡",
    },
    {
      title: text("home_feature_5_title", "Profil és számlázás"),
      desc: text(
        "home_feature_5_desc",
        "Személyes és számlázási adataidat bármikor frissítheted egy felületen.",
      ),
      icon: "👤",
    },
    {
      title: text("home_feature_6_title", "Biztonság"),
      desc: text(
        "home_feature_6_desc",
        "Biztonságos online fizetés, megbízható tranzakciókezelés és védett fiókhasználat.",
      ),
      icon: "🔒",
    },
  ];
  const faqs = [
    {
      question: text("home_faq_1_question", "Mennyi idő alatt érkezik meg az ENC készülék?"),
      answer: text(
        "home_faq_1_answer",
        "A rendelés feldolgozása után e-mailben küldünk visszaigazolást, a szállítás ideje jellemzően 1-3 munkanap.",
      ),
    },
    {
      question: text("home_faq_2_question", "Hogyan tudom feltölteni az egyenlegemet?"),
      answer: text(
        "home_faq_2_answer",
        "A Feltöltés oldalon úticél választás után megadod az összeget, majd Stripe fizetéssel pár kattintásban feltöltheted az egyenleget.",
      ),
    },
    {
      question: text("home_faq_3_question", "Látom valahol a készülékem és az egyenlegem állapotát?"),
      answer: text(
        "home_faq_3_answer",
        "Igen, a Fiókom oldalon eszközönként látod az aktuális egyenleget, valamint a feltöltési és útvonal előzményeket is.",
      ),
    },
    {
      question: text("home_faq_4_question", "Mi történik, ha alacsony az egyenlegem?"),
      answer: text(
        "home_faq_4_answer",
        "A rendszer automatikus figyelmeztető e-mailt küld, amikor az egyenleged a beállított küszöb alá csökken.",
      ),
    },
  ];
  const blogReadMoreLabel = text("home_blog_read_more_label", "Tovább olvasom");
  const blogPosts = [1, 2, 3]
    .map((idx) => ({
      title: text(`home_blog_${idx}_title`, ""),
      excerpt: text(`home_blog_${idx}_excerpt`, ""),
      date: text(`home_blog_${idx}_date`, ""),
      url: text(`home_blog_${idx}_url`, ""),
    }))
    .filter((post) => post.title || post.excerpt);
  const heroTitle =
    settings.home_hero_title?.trim() || "ENC vásárlás és útdíjkezelés egyetlen modern rendszerben.";
  const heroSubtitle =
    settings.home_hero_subtitle?.trim() ||
    "Eszközrendelés, egyenlegfeltöltés, útvonaladatok kezelése és adminisztráció — prémium felületen, biztonságos fizetéssel.";
  const heroBgDesktop = settings.hero_bg_desktop?.trim() || "/images/enc-hero-bg.png";
  const heroBgTablet = settings.hero_bg_tablet?.trim() || heroBgDesktop;
  const heroBgMobile = settings.hero_bg_mobile?.trim() || heroBgTablet;

  return (
    <>
      {/* Hero: lekerekített „lebegő” panel a meleg háttéren — nem teljes szélességű kék sáv */}
      <section className="relative px-4 pt-6 pb-14 sm:px-6 md:pt-8 md:pb-20">
        <div className="relative mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/65 shadow-2xl shadow-slate-900/8 ring-1 ring-slate-900/[0.03] md:rounded-[2.25rem]">
            <picture className="absolute inset-0 block overflow-hidden rounded-[inherit]" aria-hidden>
              <source media="(max-width: 767px)" srcSet={heroBgMobile} />
              <source media="(max-width: 1279px)" srcSet={heroBgTablet} />
              <img
                src={heroBgDesktop}
                alt=""
                className="h-full w-full object-cover object-center"
              />
            </picture>
            {/* Olvashatósági rétegek a háttérkép fölé */}
            <div
              className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/86 via-white/80 to-white/74"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_85%_55%_at_50%_0%,rgba(59,130,246,0.18),transparent_66%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"
              aria-hidden
            />

            <div className="relative px-6 py-14 text-center sm:py-16 md:px-12 md:py-20">
              <p className="adria-animate-in text-sm font-semibold uppercase tracking-[0.2em] text-blue-700/80">
                {text("home_platform_label", "AdriaGo Platform")}
              </p>
              <h1 className="adria-animate-in adria-delay-1 mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                {heroTitle}
              </h1>
              <p className="adria-animate-in adria-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                {heroSubtitle}
              </p>
              <div className="adria-animate-in adria-delay-3 mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/order"
                  className="adria-btn-primary rounded-2xl px-8 py-3.5 text-sm font-bold text-white"
                >
                  {text("home_cta_order_label", "Eszközrendelés")}
                </Link>
                <Link
                  href="/topup"
                  className="rounded-2xl border border-slate-300/85 bg-white/85 px-8 py-3.5 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-400/80 hover:bg-white hover:scale-[1.03]"
                >
                  {text("home_cta_topup_label", "Egyenlegfeltöltés")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pt-6 pb-10">
        <div className="adria-animate-in text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {text("home_steps_title", "Így működik az AdriaGo")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            {text(
              "home_steps_subtitle",
              "Néhány egyszerű lépésben elindulhatsz, és minden fontos adatot egy helyen kezelhetsz.",
            )}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <article
              key={step.title}
              className={`adria-glass adria-animate-in rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 ${
                i === 0
                  ? "adria-delay-1"
                  : i === 1
                    ? "adria-delay-2"
                    : i === 2
                      ? "adria-delay-3"
                      : "adria-delay-4"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-sm font-bold text-white shadow-sm">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="adria-animate-in text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {text("home_features_title", "Minden, ami az ENC kezeléshez kell")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            {text(
              "home_features_subtitle",
              "Egy platformon kezeled az eszközeidet, az egyenlegedet és az adminisztrációt.",
            )}
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={`adria-glass adria-animate-in group rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 ${
                i === 0
                  ? "adria-delay-1"
                  : i === 1
                    ? "adria-delay-2"
                    : i === 2
                      ? "adria-delay-3"
                      : i === 3
                        ? "adria-delay-4"
                        : i === 4
                          ? "adria-delay-5"
                          : "adria-delay-6"
              }`}
            >
              <span className="inline-flex text-3xl transition-transform duration-300 group-hover:scale-110">
                {f.icon}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-8">
        <div className="adria-animate-in text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {text("home_faq_title", "Gyakori kérdések")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            {text(
              "home_faq_subtitle",
              "A legfontosabb tudnivalók az ENC rendelésről és használatról.",
            )}
          </p>
        </div>
        <div className="mt-10 space-y-4">
          {faqs.map((faq, i) => (
            <article
              key={faq.question}
              className={`adria-glass adria-animate-in rounded-2xl p-5 md:p-6 ${
                i === 0 ? "adria-delay-1" : i === 1 ? "adria-delay-2" : i === 2 ? "adria-delay-3" : "adria-delay-4"
              }`}
            >
              <h3 className="text-base font-semibold text-foreground md:text-lg">{faq.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted md:text-base">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      {blogPosts.length > 0 && (
        <section className="relative mx-auto max-w-6xl px-6 pb-8">
          <div className="adria-animate-in text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {text("home_blog_title", "Blog")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              {text("home_blog_subtitle", "Hírek, tippek és hasznos tudnivalók ENC használathoz.")}
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {blogPosts.map((post, i) => (
              <article
                key={`${post.title}-${i}`}
                className={`adria-glass adria-animate-in rounded-2xl p-5 ${
                  i === 0 ? "adria-delay-1" : i === 1 ? "adria-delay-2" : "adria-delay-3"
                }`}
              >
                {post.date && (
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700/70">{post.date}</p>
                )}
                <h3 className="mt-2 text-lg font-semibold text-foreground">{post.title || "Blog bejegyzés"}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{post.excerpt || "Rövid leírás hamarosan."}</p>
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    {blogReadMoreLabel}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="relative border-t border-white/30 py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {text("home_final_title", "Készen állsz?")}
          </h2>
          <p className="mt-3 text-muted">
            {text(
              "home_final_subtitle",
              "Hozd létre a fiókodat és rendeld meg az ENC készülékedet néhány perc alatt.",
            )}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-8 py-3.5 text-sm font-bold !text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/40"
            >
              {text("home_final_register_cta", "Ingyenes regisztráció")}
            </Link>
            <Link
              href="/kapcsolat"
              className="adria-glass rounded-2xl px-8 py-3.5 text-sm font-bold text-foreground transition-all duration-300 hover:scale-[1.03]"
            >
              {text("home_final_contact_cta", "Kapcsolatfelvétel")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
