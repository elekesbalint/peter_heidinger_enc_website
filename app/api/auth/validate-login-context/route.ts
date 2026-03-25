import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";

/**
 * Bejelentkezés után: normál oldalon admin e-mail tiltva, admin oldalon csak admin e-mail engedett.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { context?: string };
  const context = body.context === "admin" ? "admin" : "user";

  const user = await getCurrentUser();
  if (!user?.email) {
    return Response.json({ ok: false, code: "NO_SESSION" }, { status: 401 });
  }

  const admin = isAdminEmail(user.email);

  if (context === "user" && admin) {
    return Response.json({
      ok: false,
      code: "ADMIN_USE_ADMIN_LOGIN",
      message:
        "Admin fiókkal csak az admin bejelentkezés oldalon lehet belépni. Használd az „Admin bejelentkezés” linket.",
    });
  }

  if (context === "admin" && !admin) {
    return Response.json({
      ok: false,
      code: "NOT_ADMIN",
      message: "Ez a fiók nem rendelkezik admin jogosultsággal.",
    });
  }

  return Response.json({ ok: true });
}
