# Supabase e-mail templatek (AdriaGo)

Az alábbi sablonokat másold be a Supabase-ben:
`Authentication -> Email -> Templates`

## 1) Confirm sign up

```html
<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;">
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">AdriaGo</div>
            <div style="font-size:24px;font-weight:700;margin-top:6px;">E-mail megerősítés</div>
          </td></tr>
          <tr><td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Köszönjük a regisztrációt! A fiókod aktiválásához kattints az alábbi gombra.</p>
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">Fiók megerősítése</a>
            <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;word-break:break-all;">{{ .ConfirmationURL }}</p>
          </td></tr>
          <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">Ez egy automatikus üzenet az AdriaGo rendszertől.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 2) Reset password

```html
<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#0f766e,#0ea5e9);color:#fff;">
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">AdriaGo</div>
            <div style="font-size:24px;font-weight:700;margin-top:6px;">Jelszó visszaállítás</div>
          </td></tr>
          <tr><td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Jelszó-visszaállítási kérést kaptunk a fiókodhoz. Ha te kérted, kattints az alábbi gombra.</p>
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">Új jelszó beállítása</a>
            <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;word-break:break-all;">{{ .ConfirmationURL }}</p>
          </td></tr>
          <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt az e-mailt.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 3) Magic link

```html
<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;">
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">AdriaGo</div>
            <div style="font-size:24px;font-weight:700;margin-top:6px;">Egyszer használható belépési link</div>
          </td></tr>
          <tr><td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Kattints az alábbi gombra a gyors belépéshez jelszó megadása nélkül.</p>
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">Belépés magic linkkel</a>
            <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;word-break:break-all;">{{ .ConfirmationURL }}</p>
          </td></tr>
          <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">A link rövid ideig érvényes.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 4) Invite user

```html
<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#ea580c,#f59e0b);color:#fff;">
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">AdriaGo</div>
            <div style="font-size:24px;font-weight:700;margin-top:6px;">Meghívó a rendszerbe</div>
          </td></tr>
          <tr><td style="padding:24px;">
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Meghívót kaptál az AdriaGo rendszerbe. A fiók aktiválásához kattints az alábbi gombra.</p>
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">Meghívó elfogadása</a>
            <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;word-break:break-all;">{{ .ConfirmationURL }}</p>
          </td></tr>
          <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">Ha nem vártad ezt a meghívót, hagyd figyelmen kívül.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## Megjegyzés

- A `{{ .ConfirmationURL }}` változókat hagyd érintetlenül.
- Tárgymezőt (Subject) a Supabase UI-ban külön is állítsd át magyar szövegre.
