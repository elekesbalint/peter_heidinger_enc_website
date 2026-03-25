# Rendszergazda fiok (egyetlen admin)

Az alkalmazasban az admin jog **csak** az `.env` `ADMIN_EMAILS` listajan szereplo emaileknek van (javasolt: egyetlen cim).

## Fix admin email

- `encrendszer@gmail.com` — ezt a cimet a kod **nem engedi** nyilvanosan a `/register` oldalon regisztralni (squatting ellen).

## Jelszo beallitasa (nem a kodban)

A jelszot **nem** taroljuk a repoban. Allitsd be a Supabase-ben:

1. Nyisd meg a [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication** → **Users**.
2. **Add user** → **Create new user**
   - Email: `encrendszer@gmail.com`
   - Jelszo: **valassz eros jelszot** (ezt csak te ismered)
   - Pipald be: **Auto Confirm User** (vagy hagyd ki, es akkor megerosito link kell — adminnak gyakran egyszerubb az auto-confirm)
3. `.env`:
   ```env
   ADMIN_EMAILS="encrendszer@gmail.com"
   ```
4. Inditsd ujra a Next szervert (`npm run dev`).

Belepes: `/login` → ugyanezzel az emaillel es a Supabase-ben beallitott jelszoval → `/admin`.

## Elfelejtett jelszo

A `/forgot-password` oldal ugyanugy mukodik az adminnal is, ha a Supabase email sablonok / SMTP rendben vannak.
