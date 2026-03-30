import Link from "next/link";

const features = [
  {
    title: "ENC eszközrendelés",
    desc: "Válaszd ki a járműkategóriát, add meg a rendszámot és fizess biztonságosan Stripe-on keresztül.",
    icon: "📦",
  },
  {
    title: "Egyenlegfeltöltés",
    desc: "Választható csomagokkal gyorsan feltöltheted az egyenlegedet az utazásaidhoz.",
    icon: "💳",
  },
  {
    title: "Útvonalkövetés",
    desc: "CSV import, automatikus wallet-levonás, árfolyamkezelés és teljes úttörténet.",
    icon: "🛣️",
  },
  {
    title: "Gyors ügyintézés",
    desc: "Átlátható rendelési folyamat, egyértelmű visszajelzések és gyors státuszkövetés egy helyen.",
    icon: "⚡",
  },
  {
    title: "Profil és számlázás",
    desc: "Személyes és számlázási adataidat bármikor frissítheted egy felületen.",
    icon: "👤",
  },
  {
    title: "Biztonság",
    desc: "Biztonságos online fizetés, megbízható tranzakciókezelés és védett fiókhasználat.",
    icon: "🔒",
  },
];

const steps = [
  {
    title: "Regisztráció és profil",
    desc: "Hozd létre a fiókodat, majd add meg az alapadataidat és a számlázási címet.",
  },
  {
    title: "ENC készülék rendelés",
    desc: "Válaszd ki a járműkategóriát, add meg a rendszámot, és indítsd el a rendelést.",
  },
  {
    title: "Egyenleg feltöltése",
    desc: "Töltsd fel az egyenlegedet a megfelelő csomaggal, hogy indulhass az utazásra.",
  },
  {
    title: "Utazás és követés",
    desc: "Használd az ENC készüléket, a rendszerben pedig bármikor ellenőrizd a történetet.",
  },
];

export default async function Home() {
  return (
    <>
      {/* Hero: lekerekített „lebegő” panel a meleg háttéren — nem teljes szélességű kék sáv */}
      <section className="relative px-4 pt-6 pb-14 sm:px-6 md:pt-8 md:pb-20">
        <div className="relative mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/65 shadow-2xl shadow-slate-900/8 ring-1 ring-slate-900/[0.03] md:rounded-[2.25rem]">
            {/* Világos prémium hero panel: nincs erős „kék csík” érzet */}
            <div
              className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/92 via-[#f5f7fb]/88 to-[#eef2f8]/86 backdrop-blur-xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_85%_55%_at_50%_0%,rgba(59,130,246,0.12),transparent_66%)]"
              aria-hidden
            />
            <div className="pointer-events-none absolute -left-24 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -top-8 h-64 w-64 rounded-full bg-indigo-400/9 blur-3xl" />
            <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-white/70 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
              🇭🇷 ENC vásárlás
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/70 bg-white/75 px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              🌊 🐚 🐟 ☀️
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"
              aria-hidden
            />

            <div className="relative px-6 py-14 text-center sm:py-16 md:px-12 md:py-20">
              <p className="adria-animate-in text-sm font-semibold uppercase tracking-[0.2em] text-blue-700/80">
                AdriaGo Platform
              </p>
              <h1 className="adria-animate-in adria-delay-1 mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                ENC vásárlás és útdíjkezelés
                <br className="hidden md:inline" />
                <span className="text-slate-700"> egyetlen modern rendszerben.</span>
              </h1>
              <p className="adria-animate-in adria-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Eszközrendelés, egyenlegfeltöltés, útvonaladatok kezelése és adminisztráció —
                prémium felületen, biztonságos fizetéssel.
              </p>
              <div className="adria-animate-in adria-delay-3 mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/order"
                  className="adria-btn-primary rounded-2xl px-8 py-3.5 text-sm font-bold text-white"
                >
                  Eszközrendelés
                </Link>
                <Link
                  href="/topup"
                  className="rounded-2xl border border-slate-300/85 bg-white/85 px-8 py-3.5 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-400/80 hover:bg-white hover:scale-[1.03]"
                >
                  Egyenlegfeltöltés
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pt-6 pb-10">
        <div className="adria-animate-in text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Így működik az AdriaGo
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Néhány egyszerű lépésben elindulhatsz, és minden fontos adatot egy helyen kezelhetsz.
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
            Minden, ami az ENC kezeléshez kell
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Egy platformon kezeled az eszközeidet, az egyenlegedet és az adminisztrációt.
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

      <section className="relative border-t border-white/30 py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Készen állsz?</h2>
          <p className="mt-3 text-muted">
            Hozd létre a fiókodat és rendeld meg az ENC készülékedet néhány perc alatt.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/40"
            >
              Ingyenes regisztráció
            </Link>
            <Link
              href="/kapcsolat"
              className="adria-glass rounded-2xl px-8 py-3.5 text-sm font-bold text-foreground transition-all duration-300 hover:scale-[1.03]"
            >
              Kapcsolatfelvétel
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
