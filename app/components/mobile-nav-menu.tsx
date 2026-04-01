"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Props = {
  user: boolean;
  displayName: string;
};

export function MobileNavMenu({ user, displayName }: Props) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const root = detailsRef.current;
      if (!root?.open) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) {
        root.open = false;
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative md:hidden">
      <summary
        aria-label="Navigációs menü"
        className="inline-flex h-10 w-10 list-none items-center justify-center rounded-xl border border-slate-300/85 bg-white/80 text-sm font-semibold leading-none text-slate-800 shadow-sm transition hover:bg-white"
      >
        <span aria-hidden className="inline-flex h-5 w-5 flex-col items-center justify-center gap-1">
          <span className="block h-0.5 w-4 rounded bg-slate-700" />
          <span className="block h-0.5 w-4 rounded bg-slate-700" />
          <span className="block h-0.5 w-4 rounded bg-slate-700" />
        </span>
      </summary>
      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
        <Link href="/dashboard" onClick={closeMenu} className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Fiókom
        </Link>
        <Link href="/order" onClick={closeMenu} className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Rendelés
        </Link>
        <Link href="/topup" onClick={closeMenu} className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Feltöltés
        </Link>
        <Link href="/kapcsolat" onClick={closeMenu} className="mt-1 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Kapcsolat
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            onClick={closeMenu}
            className="mt-2 block rounded-xl border border-slate-300/80 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Üdvözlünk, <span className="font-semibold text-slate-900">{displayName}</span>
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              onClick={closeMenu}
              className="mt-2 block rounded-xl border border-slate-300/85 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Regisztráció
            </Link>
            <Link
              href="/login"
              onClick={closeMenu}
              className="mt-1 block rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Belépés
            </Link>
          </>
        )}
      </div>
    </details>
  );
}
