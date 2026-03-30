"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEVICE_CATEGORY_LABELS,
  DEVICE_CATEGORY_VALUES,
  type DeviceCategoryValue,
} from "@/lib/device-categories";
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
  "Beállítások",
  "Audit / napló",
] as const;

type TabId = (typeof TABS)[number];

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
  name: string | null;
  phone: string | null;
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
    label: "Ajánlói kedvezmény készülékvásárlásra (Ft)",
    hint: "A meghívott user első sikeres készülékvásárlásakor ennyivel csökken az ár.",
  },
};

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

export function AdminWorkspace() {
  const [tab, setTab] = useState<TabId>("Eszközrendelések");

  const [encOrders, setEncOrders] = useState<EncOrder[]>([]);
  const [encLoading, setEncLoading] = useState(false);
  const [encErr, setEncErr] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [encFilter, setEncFilter] = useState<"all" | "active" | "shipped" | "archived" | "cancelled">("all");
  const [encQuery, setEncQuery] = useState("");
  const [shipForId, setShipForId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [mplAgreementCode, setMplAgreementCode] = useState(
    process.env.NEXT_PUBLIC_MPL_SENDER_AGREEMENT ?? "",
  );
  const [mplJson, setMplJson] = useState("{}");
  const [labelLoadingForId, setLabelLoadingForId] = useState<string | null>(null);
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
  const [setErr, setSetErr] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<Record<string, string>>({});

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usrLoading, setUsrLoading] = useState(false);
  const [usrErr, setUsrErr] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [selectedDebtDevices, setSelectedDebtDevices] = useState<Set<string>>(new Set());

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
  const [walletAdjustDeviceId, setWalletAdjustDeviceId] = useState("");
  const [walletAdjustNewBalance, setWalletAdjustNewBalance] = useState("");
  const [walletAdjustReason, setWalletAdjustReason] = useState("");
  const [walletAdjustLoading, setWalletAdjustLoading] = useState(false);
  const [walletAdjustErr, setWalletAdjustErr] = useState<string | null>(null);
  const [walletAdjustMsg, setWalletAdjustMsg] = useState<string | null>(null);

  const loadEnc = useCallback(async () => {
    setEncLoading(true);
    setEncErr(null);
    try {
      const res = await fetch("/api/admin/enc-device-orders/list");
      const data = (await res.json()) as { ok: boolean; items?: EncOrder[]; error?: string };
      if (!data.ok) {
        setEncErr(data.error ?? "Hiba");
        return;
      }
      setEncOrders(data.items ?? []);
    } catch {
      setEncErr("Hálózati hiba");
    } finally {
      setEncLoading(false);
    }
  }, []);

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
      setWaitlist(data.items ?? []);
    } catch {
      setWaitErr("Hálózati hiba");
    } finally {
      setWaitLoading(false);
    }
  }, []);

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
          name: editUser.name,
          phone: editUser.phone,
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

  async function sendDebtWarnings(identifiers: string[]) {
    if (identifiers.length === 0) return;
    setUsrErr(null);
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
      setUsrErr(`Figyelmeztető e-mail kiküldve (${data.sent_users ?? 0} felhasználó).`);
      setSelectedDebtDevices(new Set());
    } catch {
      setUsrErr("Hálózati hiba");
    }
  }

  useEffect(() => {
    if (tab === "Eszközrendelések") loadEnc();
    if (tab === "Készülékre vár") loadWait();
    if (tab === "Elérhető eszközök") loadDevices("");
    if (tab === "Úticélok") loadDest();
    if (tab === "Beállítások") loadSettings();
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
    const new_balance_huf = walletAdjustNewBalance.trim();
    if (!new_balance_huf) {
      setWalletAdjustErr("Add meg az új egyenleget (Ft, egész szám).");
      return;
    }
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
        `Egyenleg beállítva. Régi: ${Number(data.old_balance_huf).toLocaleString("hu-HU")} Ft, Új: ${Number(
          data.new_balance_huf,
        ).toLocaleString("hu-HU")} Ft (Δ ${Number(data.delta_huf).toLocaleString("hu-HU")} Ft).`,
      );
      setWalletAdjustReason("");
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
        items?: WalletRow[];
      };
      if (!data.ok) {
        setWalletErr(data.error ?? "Hiba");
        return;
      }
      setMinBalanceWarningHuf(data.minBalanceWarningHuf ?? 5000);
      setWalletRows(data.items ?? []);
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

  async function submitShip() {
    if (!shipForId) return;
    let mpl: Record<string, unknown> | null = null;
    const raw = mplJson.trim();
    if (raw && raw !== "{}") {
      try {
        mpl = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        setEncErr("Érvénytelen MPL JSON");
        return;
      }
    }
    try {
      await postOrderUpdate(shipForId, "ship", {
        tracking_number: trackingInput.trim(),
        mpl_payload: mpl,
        mpl_sender_agreement: mplAgreementCode.trim() || null,
      });
      setShipForId(null);
      setTrackingInput("");
      setMplAgreementCode("");
      setMplJson("{}");
      await loadEnc();
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Hiba");
    }
  }

  async function downloadOrderLabel(orderId: string, trackingNumber: string | null) {
    setEncErr(null);
    setLabelLoadingForId(orderId);
    try {
      const res = await fetch(`/api/admin/enc-device-orders/label?id=${encodeURIComponent(orderId)}`);
      if (!res.ok) {
        const maybe = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(maybe?.error ?? "Nem sikerült letölteni a címkét.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mpl-label-${trackingNumber ?? orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setEncErr(e instanceof Error ? e.message : "Hiba");
    } finally {
      setLabelLoadingForId(null);
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
          `Kiosztva: ${data.item.device_identifier ?? "?"} → ${data.item.user_email ?? "?"} (${data.item.category ?? "?"})`,
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
        `Kiosztva: ${data.item?.device_identifier ?? "?"} → ${data.item?.user_email ?? "?"} (${data.item?.category ?? "?"})`,
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
    const entries = Object.entries(setDraft).map(([key, value]) => ({ key, value }));
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setSetErr(data.error ?? "Hiba");
      return;
    }
    await loadSettings();
  }

  function toggleOrderSel(id: string) {
    setSelectedOrders((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

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
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                tab === t ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t}
            </button>
          ))}
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
            {selectedOrders.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2">
                <span className="text-sm font-medium text-indigo-900">{selectedOrders.size} kijelölt rendelés</span>
                <button
                  type="button"
                  onClick={() => bulkOrders("archive")}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-50"
                >
                  Archíválás
                </button>
                <button
                  type="button"
                  onClick={() => bulkOrders("restore")}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-50"
                >
                  Visszaállítás
                </button>
                <button
                  type="button"
                  onClick={() => bulkOrders("cancel")}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  Törlés
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrders(new Set())}
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
            {shipForId && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-medium">MPL címkegenerálás</p>
                <input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Csomagkövető szám"
                  className="mt-2 w-full rounded-lg border px-2 py-1"
                />
                <input
                  value={mplAgreementCode}
                  onChange={(e) => setMplAgreementCode(e.target.value)}
                  placeholder="MPL megállapodás kód (sender.agreement), pl. 12345678"
                  className="mt-2 w-full rounded-lg border px-2 py-1"
                />
                <textarea
                  value={mplJson}
                  onChange={(e) => setMplJson(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border px-2 py-1 font-mono text-xs"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={submitShip}
                    className="rounded-lg bg-primary px-3 py-1.5 text-white"
                  >
                    Mentés
                  </button>
                  <button type="button" onClick={() => setShipForId(null)} className="rounded-lg border px-3 py-1.5">
                    Mégse
                  </button>
                </div>
              </div>
            )}
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
                            <p className="line-clamp-3">{normalizeAddressForDisplay(o.shipping_address)}</p>
                          )}
                        </td>
                        <td className="max-w-[220px] px-2 py-2 text-xs text-slate-700">
                          <p className="line-clamp-3">{normalizeAddressForDisplay(o.billing_address)}</p>
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
                            <button
                              type="button"
                              className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                              onClick={() => {
                                setShipForId(o.id);
                                setTrackingInput(o.tracking_number ?? "");
                                setMplJson("{}");
                              }}
                            >
                              Küldés
                            </button>
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
                <input
                  value={newDest.name}
                  onChange={(e) => setNewDest({ ...newDest, name: e.target.value })}
                  placeholder="Név"
                  className="rounded border px-2 py-1 text-sm"
                />
                {(["price_ia", "price_i", "price_ii", "price_iii", "price_iv"] as const).map((k) => (
                  <input
                    key={k}
                    value={newDest[k]}
                    onChange={(e) => setNewDest({ ...newDest, [k]: e.target.value })}
                    placeholder={k}
                    className="rounded border px-2 py-1 text-sm"
                  />
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
                    Itt csak a 0 Ft alatti egyenlegű készülékek látszanak.
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
                      const ok = bal >= minBalanceWarningHuf;
                      return (
                        <tr key={w.identifier} className="border-b border-border/60">
                          <td className="px-2 py-2 font-medium">{w.identifier}</td>
                          <td className="px-2 py-2">{DEVICE_STATUS_LABELS[w.status as keyof typeof DEVICE_STATUS_LABELS] ?? w.status}</td>
                          <td className="px-2 py-2">
                            <span className={`font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>
                              {bal.toLocaleString("hu-HU")} Ft
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
                                setWalletAdjustNewBalance(String(bal));
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
                  Új egyenleg (Ft)
                  <input
                    value={walletAdjustNewBalance}
                    onChange={(e) =>
                      setWalletAdjustNewBalance(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                    }
                    placeholder="pl. 4999"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    inputMode="numeric"
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
              <button type="button" onClick={() => loadUsers()} className="rounded border px-2 py-1 text-sm">
                Frissítés
              </button>
            </div>
            {usrErr && <p className="mt-2 text-sm text-red-600">{usrErr}</p>}
            <table className="mt-4 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="px-2 py-2">E-mail</th>
                  <th className="px-2 py-2">Név (profil)</th>
                  <th className="px-2 py-2">Telefon</th>
                  <th className="px-2 py-2">Készülékek / egyenleg</th>
                  <th className="px-2 py-2">Regisztráció</th>
                  <th className="px-2 py-2">Utolsó belépés</th>
                  <th className="px-2 py-2">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{u.email ?? "—"}</td>
                    <td className="px-2 py-2">{u.name ?? "—"}</td>
                    <td className="px-2 py-2">{u.phone ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="space-y-1">
                        {u.devices.length === 0 && <div className="text-xs text-muted">Nincs eszköz</div>}
                        {u.devices.map((d) => {
                          const bal = Number(d.balance_huf ?? 0);
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
                                {Number.isFinite(bal) ? `${bal.toLocaleString("hu-HU")} Ft` : "—"}
                              </span>
                              {debt && (
                                <button
                                  type="button"
                                  className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900"
                                  onClick={() => sendDebtWarnings([d.identifier])}
                                >
                                  Figyelmeztetés
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2">{new Date(u.created_at).toLocaleString("hu-HU")}</td>
                    <td className="px-2 py-2">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("hu-HU") : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={() => setEditUser({ ...u })}
                      >
                        Szerkesztés
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usrLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
            {editUser && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
                <h3 className="font-semibold">Felhasználó szerkesztése: {editUser.email ?? editUser.id}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              <button type="button" onClick={saveSettings} className="rounded bg-primary px-2 py-1 text-sm text-white">
                Összes mentése
              </button>
            </div>
            {setErr && <p className="mt-2 text-sm text-red-600">{setErr}</p>}
            <div className="mt-4 space-y-2">
              {settings.map((s) => (
                <div key={s.key} className="flex flex-wrap items-start gap-2 text-sm">
                  <div className="w-56 shrink-0">
                    <p className="font-medium text-foreground">{SETTINGS_META[s.key]?.label ?? s.key}</p>
                    <p className="text-xs text-muted">{SETTINGS_META[s.key]?.hint ?? "Technikai beállítás."}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{s.key}</p>
                  </div>
                  <input
                    value={setDraft[s.key] ?? ""}
                    onChange={(e) => setSetDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                    className="min-w-[200px] flex-1 rounded border px-2 py-1"
                  />
                </div>
              ))}
            </div>
            {setLoading && <p className="mt-2 text-sm text-muted">Betöltés…</p>}
          </div>
        )}

        {tab === "Audit / napló" && <AdminDataPanels auditOnly />}
      </article>
    </section>
  );
}
