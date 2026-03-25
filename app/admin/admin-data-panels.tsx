"use client";

import { useEffect, useState } from "react";

type DeviceItem = {
  id: string;
  identifier: string;
  category: string;
  status: string;
  auth_user_id: string | null;
  created_at: string;
};

type EncOrderItem = {
  id: string;
  stripe_session_id: string;
  auth_user_id: string;
  user_email: string | null;
  device_identifier: string | null;
  category: string;
  amount_huf: number;
  status: string;
  assignment_ok: boolean;
  paid_at: string | null;
  created_at: string;
};

type WaitlistItem = {
  id: string;
  auth_user_id: string;
  user_email: string | null;
  category: string;
  note: string | null;
  created_at: string;
};

type AssignmentLogItem = {
  id: string;
  admin_email: string | null;
  target_user_email: string | null;
  device_identifier: string | null;
  category: string;
  source_waitlist_id: string | null;
  assigned_at: string;
};

type ContractAcceptanceItem = {
  id: string;
  user_email: string | null;
  category: string;
  contract_version: string;
  context: string;
  accepted_at: string;
};

type RouteItem = {
  id: string;
  device_number_raw: string;
  relation_label: string;
  executed_at: string;
  amount: string | number;
  currency: string;
  source_file_name: string | null;
};

type ApiResult<T> = {
  ok: boolean;
  error?: string;
  items?: T[];
};

export type AdminDataPanelsProps = {
  routesOnly?: boolean;
  auditOnly?: boolean;
  routesQueryExternal?: string;
  onRoutesQueryChange?: (value: string) => void;
};

export function AdminDataPanels(props: AdminDataPanelsProps = {}) {
  const [devicesQ, setDevicesQ] = useState("");
  const [internalRoutesQ, setInternalRoutesQ] = useState("");
  const routesQ =
    props.routesQueryExternal !== undefined ? props.routesQueryExternal : internalRoutesQ;
  const setRoutesQ = (v: string) => {
    if (props.onRoutesQueryChange) props.onRoutesQueryChange(v);
    else setInternalRoutesQ(v);
  };

  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [encOrders, setEncOrders] = useState<EncOrderItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [assignmentLogs, setAssignmentLogs] = useState<AssignmentLogItem[]>([]);
  const [contractAcceptances, setContractAcceptances] = useState<ContractAcceptanceItem[]>([]);

  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isLoadingEncOrders, setIsLoadingEncOrders] = useState(false);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [encOrdersError, setEncOrdersError] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  async function loadDevices(query = devicesQ) {
    setIsLoadingDevices(true);
    setDevicesError(null);
    try {
      const response = await fetch(
        `/api/admin/devices/list?q=${encodeURIComponent(query)}`,
      );
      const data = (await response.json()) as ApiResult<DeviceItem>;
      if (!data.ok) {
        setDevicesError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setDevices(data.items ?? []);
    } catch {
      setDevicesError("Halozati hiba tortent.");
    } finally {
      setIsLoadingDevices(false);
    }
  }

  async function loadEncOrders() {
    setIsLoadingEncOrders(true);
    setEncOrdersError(null);
    try {
      const response = await fetch("/api/admin/enc-device-orders/list");
      const data = (await response.json()) as ApiResult<EncOrderItem>;
      if (!data.ok) {
        setEncOrdersError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setEncOrders(data.items ?? []);
    } catch {
      setEncOrdersError("Halozati hiba tortent.");
    } finally {
      setIsLoadingEncOrders(false);
    }
  }

  async function loadWaitlist() {
    setIsLoadingWaitlist(true);
    setWaitlistError(null);
    try {
      const response = await fetch("/api/admin/device-waitlist/list");
      const data = (await response.json()) as ApiResult<WaitlistItem>;
      if (!data.ok) {
        setWaitlistError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setWaitlist(data.items ?? []);
    } catch {
      setWaitlistError("Halozati hiba tortent.");
    } finally {
      setIsLoadingWaitlist(false);
    }
  }

  async function loadRoutes(query = routesQ) {
    setIsLoadingRoutes(true);
    setRoutesError(null);
    try {
      const response = await fetch(
        `/api/admin/routes/list?q=${encodeURIComponent(query)}`,
      );
      const data = (await response.json()) as ApiResult<RouteItem>;
      if (!data.ok) {
        setRoutesError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setRoutes(data.items ?? []);
    } catch {
      setRoutesError("Halozati hiba tortent.");
    } finally {
      setIsLoadingRoutes(false);
    }
  }

  async function loadAssignmentLogs() {
    setIsLoadingAssignments(true);
    setAssignmentError(null);
    try {
      const response = await fetch("/api/admin/device-assignments/list");
      const data = (await response.json()) as ApiResult<AssignmentLogItem>;
      if (!data.ok) {
        setAssignmentError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setAssignmentLogs(data.items ?? []);
    } catch {
      setAssignmentError("Halozati hiba tortent.");
    } finally {
      setIsLoadingAssignments(false);
    }
  }

  async function loadContractAcceptances() {
    setIsLoadingContracts(true);
    setContractError(null);
    try {
      const response = await fetch("/api/admin/contract-acceptances/list");
      const data = (await response.json()) as ApiResult<ContractAcceptanceItem>;
      if (!data.ok) {
        setContractError(data.error ?? "Ismeretlen hiba.");
        return;
      }
      setContractAcceptances(data.items ?? []);
    } catch {
      setContractError("Halozati hiba tortent.");
    } finally {
      setIsLoadingContracts(false);
    }
  }

  async function assignNextWaitlist() {
    setAssignMessage(null);
    setAssignError(null);
    setIsAssigning(true);
    try {
      const response = await fetch("/api/admin/device-waitlist/assign-next", {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok: boolean;
        assigned?: boolean;
        error?: string;
        message?: string;
        item?: {
          user_email?: string | null;
          category?: string;
          device_identifier?: string;
        };
      };

      if (!data.ok) {
        setAssignError(data.error ?? "Kiosztasi hiba tortent.");
        return;
      }

      if (data.assigned && data.item) {
        setAssignMessage(
          `Kiosztva: ${data.item.device_identifier ?? "ismeretlen"} → ${
            data.item.user_email ?? "ismeretlen email"
          } (${data.item.category ?? "ismeretlen kategoria"})`,
        );
      } else {
        setAssignMessage(data.message ?? "Nem tortent kiosztas.");
      }

      await Promise.all([loadWaitlist(), loadDevices(""), loadAssignmentLogs()]);
    } catch {
      setAssignError("Halozati hiba tortent.");
    } finally {
      setIsAssigning(false);
    }
  }

  useEffect(() => {
    if (props.auditOnly) {
      loadAssignmentLogs();
      loadContractAcceptances();
      return;
    }
    if (props.routesOnly) {
      return;
    }
    loadDevices("");
    loadRoutes("");
    loadEncOrders();
    loadWaitlist();
    loadAssignmentLogs();
    loadContractAcceptances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!props.routesOnly) return;
    loadRoutes(routesQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.routesOnly, routesQ]);

  if (props.auditOnly) {
    return (
      <section className="mt-6 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">Admin kiosztasi naplo</h3>
            <button
              type="button"
              onClick={() => loadAssignmentLogs()}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Frissites
            </button>
          </div>
          {assignmentError && <p className="mt-3 text-sm text-danger">{assignmentError}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="px-2 py-2">Eszkoz</th>
                  <th className="px-2 py-2">Kat.</th>
                  <th className="px-2 py-2">Cel user</th>
                  <th className="px-2 py-2">Admin</th>
                  <th className="px-2 py-2">Idopont</th>
                </tr>
              </thead>
              <tbody>
                {assignmentLogs.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-2 py-2 font-medium">{item.device_identifier ?? "—"}</td>
                    <td className="px-2 py-2">{item.category}</td>
                    <td className="px-2 py-2">{item.target_user_email ?? "—"}</td>
                    <td className="px-2 py-2">{item.admin_email ?? "—"}</td>
                    <td className="px-2 py-2">
                      {new Date(item.assigned_at).toLocaleString("hu-HU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoadingAssignments && assignmentLogs.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">Meg nincs admin kiosztasi naplo.</p>
            )}
            {isLoadingAssignments && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">Szerzodes elfogadas audit</h3>
            <button
              type="button"
              onClick={() => loadContractAcceptances()}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Frissites
            </button>
          </div>
          {contractError && <p className="mt-3 text-sm text-danger">{contractError}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Kat.</th>
                  <th className="px-2 py-2">Verzio</th>
                  <th className="px-2 py-2">Kontextus</th>
                  <th className="px-2 py-2">Elfogadva</th>
                </tr>
              </thead>
              <tbody>
                {contractAcceptances.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{item.user_email ?? "—"}</td>
                    <td className="px-2 py-2">{item.category}</td>
                    <td className="px-2 py-2">{item.contract_version}</td>
                    <td className="px-2 py-2">{item.context}</td>
                    <td className="px-2 py-2">
                      {new Date(item.accepted_at).toLocaleString("hu-HU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoadingContracts && contractAcceptances.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">Meg nincs szerzodes elfogadas.</p>
            )}
            {isLoadingContracts && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
          </div>
        </div>
      </section>
    );
  }

  if (props.routesOnly) {
    return (
      <section className="mt-6 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">Utvonal rekordok</h3>
            <input
              value={routesQ}
              onChange={(e) => setRoutesQ(e.target.value)}
              placeholder="Keszulek szama alapjan"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => loadRoutes()}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kereses
            </button>
          </div>
          {routesError && <p className="mt-3 text-sm text-danger">{routesError}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="px-2 py-2">Keszulek szam</th>
                  <th className="px-2 py-2">Relacio</th>
                  <th className="px-2 py-2">Idopont</th>
                  <th className="px-2 py-2">Osszeg</th>
                  <th className="px-2 py-2">Forras fajl</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-2 py-2 font-medium">{item.device_number_raw}</td>
                    <td className="px-2 py-2">{item.relation_label}</td>
                    <td className="px-2 py-2">
                      {new Date(item.executed_at).toLocaleString("hu-HU")}
                    </td>
                    <td className="px-2 py-2">
                      {Number(item.amount).toLocaleString("hu-HU")} {item.currency}
                    </td>
                    <td className="px-2 py-2">{item.source_file_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoadingRoutes && routes.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">Nincs talalat.</p>
            )}
            {isLoadingRoutes && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Devices lista</h3>
          <input
            value={devicesQ}
            onChange={(e) => setDevicesQ(e.target.value)}
            placeholder="Kereses azonositora"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => loadDevices()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kereses
          </button>
        </div>
        {devicesError && <p className="mt-3 text-sm text-danger">{devicesError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Azonosito</th>
                <th className="px-2 py-2">Kategoria</th>
                <th className="px-2 py-2">Statusz</th>
                <th className="px-2 py-2">Auth user</th>
                <th className="px-2 py-2">Letrehozva</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{item.identifier}</td>
                  <td className="px-2 py-2">{item.category}</td>
                  <td className="px-2 py-2">{item.status}</td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {item.auth_user_id ? `${item.auth_user_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {new Date(item.created_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingDevices && devices.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Nincs talalat.</p>
          )}
          {isLoadingDevices && (
            <p className="mt-3 text-sm text-slate-500">Betoltes...</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Admin kiosztasi naplo</h3>
          <button
            type="button"
            onClick={() => loadAssignmentLogs()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Frissites
          </button>
        </div>
        {assignmentError && <p className="mt-3 text-sm text-danger">{assignmentError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Eszkoz</th>
                <th className="px-2 py-2">Kat.</th>
                <th className="px-2 py-2">Cel user</th>
                <th className="px-2 py-2">Admin</th>
                <th className="px-2 py-2">Idopont</th>
              </tr>
            </thead>
            <tbody>
              {assignmentLogs.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{item.device_identifier ?? "—"}</td>
                  <td className="px-2 py-2">{item.category}</td>
                  <td className="px-2 py-2">{item.target_user_email ?? "—"}</td>
                  <td className="px-2 py-2">{item.admin_email ?? "—"}</td>
                  <td className="px-2 py-2">
                    {new Date(item.assigned_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingAssignments && assignmentLogs.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Meg nincs admin kiosztasi naplo.</p>
          )}
          {isLoadingAssignments && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Szerzodes elfogadas audit</h3>
          <button
            type="button"
            onClick={() => loadContractAcceptances()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Frissites
          </button>
        </div>
        {contractError && <p className="mt-3 text-sm text-danger">{contractError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Kat.</th>
                <th className="px-2 py-2">Verzio</th>
                <th className="px-2 py-2">Kontextus</th>
                <th className="px-2 py-2">Elfogadva</th>
              </tr>
            </thead>
            <tbody>
              {contractAcceptances.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{item.user_email ?? "—"}</td>
                  <td className="px-2 py-2">{item.category}</td>
                  <td className="px-2 py-2">{item.contract_version}</td>
                  <td className="px-2 py-2">{item.context}</td>
                  <td className="px-2 py-2">
                    {new Date(item.accepted_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingContracts && contractAcceptances.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Meg nincs szerzodes elfogadas.</p>
          )}
          {isLoadingContracts && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Utvonal rekordok</h3>
          <input
            value={routesQ}
            onChange={(e) => setRoutesQ(e.target.value)}
            placeholder="Keszulek szama alapjan"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => loadRoutes()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kereses
          </button>
        </div>
        {routesError && <p className="mt-3 text-sm text-danger">{routesError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Keszulek szam</th>
                <th className="px-2 py-2">Relacio</th>
                <th className="px-2 py-2">Idopont</th>
                <th className="px-2 py-2">Osszeg</th>
                <th className="px-2 py-2">Forras fajl</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{item.device_number_raw}</td>
                  <td className="px-2 py-2">{item.relation_label}</td>
                  <td className="px-2 py-2">
                    {new Date(item.executed_at).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-2 py-2">
                    {Number(item.amount).toLocaleString("hu-HU")} {item.currency}
                  </td>
                  <td className="px-2 py-2">{item.source_file_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingRoutes && routes.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Nincs talalat.</p>
          )}
          {isLoadingRoutes && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">ENC keszulek rendelesek</h3>
          <button
            type="button"
            onClick={() => loadEncOrders()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Frissites
          </button>
        </div>
        {encOrdersError && <p className="mt-3 text-sm text-danger">{encOrdersError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Eszkoz</th>
                <th className="px-2 py-2">Kat.</th>
                <th className="px-2 py-2">Osszeg</th>
                <th className="px-2 py-2">Hozzarendeles</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Idopont</th>
              </tr>
            </thead>
            <tbody>
              {encOrders.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{item.device_identifier ?? "—"}</td>
                  <td className="px-2 py-2">{item.category}</td>
                  <td className="px-2 py-2">
                    {Number(item.amount_huf).toLocaleString("hu-HU")} Ft
                  </td>
                  <td className="px-2 py-2">
                    {item.assignment_ok ? (
                      <span className="text-success">OK</span>
                    ) : (
                      <span className="text-danger">Hiba / verseny</span>
                    )}
                  </td>
                  <td className="px-2 py-2">{item.user_email ?? "—"}</td>
                  <td className="px-2 py-2">
                    {new Date(item.paid_at ?? item.created_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingEncOrders && encOrders.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Meg nincs rendeles.</p>
          )}
          {isLoadingEncOrders && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Keszulekre var (varolista)</h3>
          <button
            type="button"
            onClick={() => loadWaitlist()}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Frissites
          </button>
          <button
            type="button"
            onClick={assignNextWaitlist}
            disabled={isAssigning}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
          >
            {isAssigning ? "Kiosztas..." : "Kiosztas keszletbol"}
          </button>
        </div>
        {waitlistError && <p className="mt-3 text-sm text-danger">{waitlistError}</p>}
        {assignError && <p className="mt-2 text-sm text-danger">{assignError}</p>}
        {assignMessage && <p className="mt-2 text-sm text-success">{assignMessage}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-slate-500">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Kat.</th>
                <th className="px-2 py-2">Megjegyzes</th>
                <th className="px-2 py-2">Rogzitve</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{item.user_email ?? "—"}</td>
                  <td className="px-2 py-2">{item.category}</td>
                  <td className="px-2 py-2">{item.note ?? "—"}</td>
                  <td className="px-2 py-2">
                    {new Date(item.created_at).toLocaleString("hu-HU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingWaitlist && waitlist.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">A varolista ures.</p>
          )}
          {isLoadingWaitlist && <p className="mt-3 text-sm text-slate-500">Betoltes...</p>}
        </div>
      </div>
    </section>
  );
}
