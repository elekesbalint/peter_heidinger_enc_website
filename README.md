## AdriaGo

AdriaGo egy webalapu ENC ertekesitesi es utdijkezelo rendszer.

Aktualis projektallapot:

- `app/page.tsx`: kezdo landing oldal vaz
- `app/login/page.tsx`: bejelentkezes UI vaz
- `app/dashboard/page.tsx`: felhasznaloi fiok UI vaz
- `app/admin/page.tsx`: admin felulet UI vaz
- `app/api/admin/routes/import/route.ts`: utvonal CSV import endpoint (deduplikacioval)
- `app/api/admin/devices/import/route.ts`: devices CSV import endpoint (deduplikacioval)

Stack:

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + API)
- A kovetkezo lepesben: Stripe integracio

## Getting Started

Inditsd el a fejlesztoi szervert:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Supabase setup:

1. Allitsd be az `.env` valtozokat:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS` — **kotelezo** admin elereshez (pl. egyetlen cim: `encrendszer@gmail.com`). Ha ures, **senki** nem kap admin jogot.
2. Supabase SQL Editorben futtasd (sorrendben):
   - `supabase/init.sql`
   - `supabase/stripe.sql`
   - `supabase/device_orders.sql`
   - `supabase/phase2_full_spec.sql` — profil, rendszam, beallitasok, uicel a topupnal, wallet trigger utvonalakhoz
   - `supabase/referrals.sql` — ajanlo linkek, meghivo allapotok, referral kedvezmeny setting
   - `supabase/waitlist_payment_links.sql` — varolistas fizetesi link + 48 oras keszulek rezervacio
   - `supabase/company_profile_fields.sql` — cegnev + adoszam mezok a ceges profilhoz

Regisztracio es admin fiok:

- `/register` a **Supabase kliens `signUp`**-ot hasznalja → **email megerosites** kell (kapcsold be: Authentication → Providers → Email → **Confirm email**).
- Site URL / Redirect URLs: add meg a `NEXT_PUBLIC_APP_URL`-t (pl. `http://localhost:3000`), hogy a megerosito link visszairanyitson.
- A fix admin cim (`encrendszer@gmail.com`) **nem** regisztralhato a nyilvanos `/register` oldalon — lasd `docs/ADMIN.md` a rendszergazda fiok letrehozasahoz es jelszohoz.

Stripe setup:

1. `.env` valtozok:
   - `NEXT_PUBLIC_APP_URL` (pl. `http://localhost:3000`)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (lasd lent: Stripe CLI)
   - `ENC_DEVICE_PRICE_HUF` (opcionalis, alapertelmezett: 499000 — ENC keszulek Stripe `unit_amount` HUF-ban)
2. **Local webhook (nem kell publikus URL):** a Stripe Dashboard nem fogad `localhost` endpointot. Hasznald a Stripe CLI-t:
   - Telepites: `brew install stripe/stripe-cli/stripe`
   - Masik terminalban: `npm run stripe:listen`
   - A parancs kiirja: `Your webhook signing secret is whsec_...` — masold be `.env` → `STRIPE_WEBHOOK_SECRET`
   - **Fontos:** uj `stripe listen` inditasnal altalaban uj `whsec` jon — frissitsd az `.env`-et es inditsd ujra `npm run dev`-et.
   - Teszt: `stripe trigger checkout.session.completed` (kulon terminal, `STRIPE_SECRET_KEY` kell a kornyezetben vagy `stripe login`)
3. Endpointok:
   - `GET /api/topup/config` — csomagok, kedvezmeny %, sajat keszulekek, uicel lista (`destinations`)
   - `POST /api/stripe/checkout` — egyenlegfeltoltes (kotelezo: fiokhoz tartozo `device_identifier`, `baseAmountHuf`, `travelDestination`)
   - `POST /api/stripe/checkout-device` (ENC keszulek vasarlas)
   - `POST /api/stripe/webhook`
   - `POST /api/contact` — kapcsolatfelvetel (`contact_messages`, phase2)
4. Oldalak:
   - `/order` — kategoria, rendszam, szerzodes, Stripe Checkout vagy varolista
   - `/order/success`, `/order/cancel`
   - `/topup` — csomag + uicel + csak sajat keszulek; legkisebb csomag tiltasa II/III/IV kategoriaknal (beallithato)
   - `/topup/success`
   - `/topup/cancel`
   - `/aszf`, `/adatvedelem`, `/kapcsolat`

Wallet konyveles es ENC vasarlas:

- A webhook `checkout.session.completed` esemenynel mindig: mentes `stripe_topups` tablaba.
- **Egyenlegfeltoltes** (`order_type` = `topup`): ha van `device_identifier`, `apply_topup(...)` hivas.
- **ENC keszulek** (`order_type` = `device_purchase`): eszkoz `status` → `sold`, `auth_user_id` beallitasa, `enc_device_orders` rekord (nincs wallet jovairas).

CSV import endpoint:

Teszthez minta fajlok: `examples/sample-devices.csv`, `examples/sample-routes.csv` (elvalaszto: `;`, fejlec a parser altal vart magyar oszlopnevekkel).

```txt
POST /api/admin/routes/import
multipart/form-data: file=<csv>
```

```txt
POST /api/admin/devices/import
multipart/form-data: file=<csv>
```

```txt
GET /api/admin/devices/list?q=<azonosito_reszlet>
POST /api/admin/devices/create
POST /api/admin/devices/update
GET /api/admin/routes/list?q=<keszulek_szam_reszlet>
GET /api/admin/enc-device-orders/list
POST /api/admin/enc-device-orders/update   (archive|restore|cancel|uncancel|ship + tracking, mpl_payload)
POST /api/admin/enc-device-orders/bulk     (archive|restore|cancel)
GET /api/admin/device-waitlist/list
POST /api/admin/device-waitlist/remove     { id }
GET /api/admin/destinations/list
POST /api/admin/destinations/create
POST /api/admin/destinations/update
POST /api/admin/destinations/delete
GET /api/admin/settings
PATCH /api/admin/settings                  { entries: [{ key, value }] }
GET /api/admin/users/list
GET /api/admin/device-assignments/list
GET /api/admin/contract-acceptances/list
GET /api/me/profile   (sajat profil)
PATCH /api/me/profile
```

Megjegyzes:

- A route import deduplikaciohoz `dedupe_key` egyedi kulcsot hasznal.
- Az import endpoint server oldalon service role kulccsal fut.
- Az admin oldalak es admin API endpointok csak **ADMIN_EMAILS**-ben levo cimmel mukodnek.
- `/admin` — lapozo menu: rendelesek (bulk + MPL stub), varolista, eszkozok (CSV + uj + szerkesztes), uticelok, utvonal import/lista, felhasznalok, beallitasok, audit.
- `/dashboard` — ha nincs hozza rendelt ENC, atiranyitas `/order`-re; profil, uttortenet, wallet, topup elozmenyek.
- `supabase/device_orders.sql` tartalmazza a szerzodes-elfogadas audit (`contract_acceptances`) es admin kiosztasi naplo (`admin_device_assignments`) tablat is.

Nyisd meg: [http://localhost:3000](http://localhost:3000)

RLS (Row Level Security):
- A futó alkalmazásban a szerver oldali endpointok jellemzoen `SUPABASE_SERVICE_ROLE_KEY`-t hasznalnak, ami megkeruli az RLS-t.
- Ha szeretned szigorítani a direkt DB/anon hozzaferest, futtasd le a meglévő Supabase SQL-ek utan ezt a fajlt:
  - `supabase/rls_enable_policies.sql`

e-racuni (teszt vs éles):
- A számlázó hívás külön teszt env-eket is támogat:
  - `E_RACUNI_TEST_API_URL`
  - `E_RACUNI_TEST_API_KEY` vagy `E_RACUNI_TEST_API_TOKEN`
- Ha TEST értékek be vannak állítva, a rendszer ezeket preferálja.
- Éleshez:
  - `E_RACUNI_API_URL`
  - `E_RACUNI_API_KEY` vagy `E_RACUNI_API_TOKEN`

Fontos route-ok:

- `/`
- `/login`
- `/dashboard`
- `/admin`

## Learn More

- [Next.js docs](https://nextjs.org/docs)
- [Supabase docs](https://supabase.com/docs)
- [Stripe docs](https://docs.stripe.com/)
