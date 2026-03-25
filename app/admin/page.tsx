import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/components/logout-button";
import { getCurrentSessionAal, getCurrentUser, isAdminEmail } from "@/lib/auth-server";
import { AdminWorkspace } from "./admin-workspace";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }
  const aal = await getCurrentSessionAal();
  if (aal !== "aal2") {
    redirect("/admin/login?mfa=required");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Adminisztráció</h1>
          <p className="mt-2 text-muted">
            Rendelések, készülékek, úticélok, beállítások és naplók kezelése.
          </p>
          <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <AdminWorkspace />
    </div>
  );
}
