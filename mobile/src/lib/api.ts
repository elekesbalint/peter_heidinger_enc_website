import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

function normalizeApiBaseUrl(url: string): string {
  let u = String(url).trim().replace(/\/+$/, '');
  // iOS: fetch gyakran elhasal "localhost"-ra (IPv6 / ATS); a szimulátoron 127.0.0.1 megbízhatóbb.
  if (Platform.OS === 'ios' && /^https?:\/\/localhost\b/i.test(u)) {
    u = u.replace(/localhost/i, '127.0.0.1');
  }
  return u;
}

const extraApi =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl?.trim() || '';

const BASE_URL: string = normalizeApiBaseUrl(
  extraApi ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://peter-heidinger-enc-website.vercel.app',
);

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** fetch, ami hálózati hibát egységes üzenetre cserél (kevesebb zavaró LogBox) */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error('Nem sikerült kapcsolódni a szerverhez. Ellenőrizze a hálózatot és az API címet (.env).');
  }
}

async function readJsonErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    return `A szerver HTML-t küldött (HTTP ${res.status}). Ellenőrizze az EXPO_PUBLIC_API_BASE_URL értéket.`;
  }
  try {
    const j = JSON.parse(text) as { error?: string };
    if (typeof j.error === 'string' && j.error) return j.error;
  } catch {
    /* ignore */
  }
  return text.slice(0, 180) || `HTTP ${res.status}`;
}

export async function fetchTopupConfig() {
  let lastDetail = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      await supabase.auth.refreshSession();
    }
    const headers = await getAuthHeaders();
    const res = await apiFetch('/api/mobile/topup/config', { headers });
    if (res.ok) return res.json();
    lastDetail = await readJsonErrorBody(res);
    if (res.status === 401 && attempt === 0) continue;
    throw new Error(
      res.status === 401
        ? `${lastDetail} Jelentkezz ki és be újra, ha továbbra sem működik.`
        : `Feltöltési beállítások (HTTP ${res.status}): ${lastDetail}`,
    );
  }
  throw new Error(
    lastDetail
      ? `${lastDetail} (munkamenet betöltése után próbáld újra.)`
      : 'Bejelentkezés szükséges a feltöltéshez.',
  );
}

export async function startTopupCheckout(body: {
  deviceIdentifier: string;
  amountEur: number;
  selectedPackageEur?: number;
  travelDestination?: string;
}) {
  const headers = await getAuthHeaders();
  // A szerver `topupAmountEur` mezőt vár (nem `amountEur`)
  const payload = {
    topupAmountEur: body.amountEur,
    selectedPackageEur: body.selectedPackageEur,
    deviceIdentifier: body.deviceIdentifier,
    travelDestination: body.travelDestination,
  };
  const res = await apiFetch('/api/mobile/stripe/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Feltöltés indítása sikertelen.');
  return data as { ok: true; url: string };
}

export async function startDeviceOrderCheckout(body: {
  deviceIdentifier?: string;
  category: string;
  licensePlate: string;
  referralInviteId?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/stripe/checkout-device', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, contractAccepted: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Rendelés indítása sikertelen.');
  return data as { ok: true; url: string; waitlist?: boolean };
}

export type MobileSummaryData = {
  ok: true;
  fxEurToHuf: number;
  referralWalletBonusCapHuf: number;
  minBalanceWarningEur: number;
  displayName: string;
  avatarUrl: string | null;
  devices: Array<{
    identifier: string;
    category: string;
    status: string;
    licensePlate: string | null;
    balanceHuf: number;
  }>;
  wallets: Array<{
    deviceIdentifier: string;
    balanceHuf: number;
    updatedAt: string | null;
  }>;
  orders: Array<{
    id: string;
    deviceIdentifier: string | null;
    status: string;
    paidAt: string | null;
    amountHuf: number | null;
    category: string;
    createdAt: string;
  }>;
  topups: Array<{
    id: string;
    amountHuf: number;
    currency: string;
    status: string;
    paidAt: string | null;
    deviceIdentifier: string | null;
    travelDestination: string | null;
  }>;
  invites: unknown[];
};

/** Fiókom adatok — szerverről (nem közvetlen Supabase PostgREST a mobilon → kevesebb iOS fetch hiba). */
export async function fetchMobileSummary(): Promise<MobileSummaryData> {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/summary', { headers });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    throw new Error('Érvénytelen válasz a szervertől (összefoglaló).');
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Összefoglaló betöltése sikertelen (HTTP ${res.status}).`);
  }
  return body as unknown as MobileSummaryData;
}

/** Mobil profil (Bearer) — mezők egy síkban, a webes `profiles` táblával szinkronban. */
export async function getProfile(): Promise<Record<string, string>> {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/profile', { headers });
  let data: { ok?: boolean; error?: string } & Record<string, unknown> = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
  } catch {
    throw new Error('Érvénytelen válasz a szervertől (profil).');
  }
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Profil betöltése sikertelen.');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'ok') continue;
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

/** Csak a profil teljességét ellenőrzi (name, phone, billing+shipping cím). */
export async function getProfileComplete(): Promise<boolean> {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/profile', { headers });
  if (!res.ok) return false;
  try {
    const data = (await res.json()) as { ok?: boolean; profile_complete?: boolean };
    return data.ok === true && data.profile_complete === true;
  } catch {
    return false;
  }
}

export async function patchProfile(profile: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(profile),
  });
  let data: { ok?: boolean; error?: string } = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    throw new Error('Érvénytelen válasz a szervertől (profil mentés).');
  }
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Profil mentése sikertelen.');
  }
  return data;
}

export async function uploadProfileAvatar(imageBase64: string, mimeType: string) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/profile/avatar', {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  let data: { ok?: boolean; error?: string; avatarUrl?: string } = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string; avatarUrl?: string };
  } catch {
    throw new Error('Érvénytelen válasz a szervertől (profilkép).');
  }
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Profilkép feltöltése sikertelen.');
  }
  return data as { ok: true; avatarUrl: string };
}

export async function sendContactMessage(body: {
  name: string;
  email: string;
  message: string;
}) {
  const res = await apiFetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Üzenet küldése sikertelen.');
  return res.json();
}

export async function getSettings(keys?: string[]): Promise<Record<string, string>> {
  try {
    const params = keys ? `?keys=${keys.join(',')}` : '';
    const res = await apiFetch(`/api/settings/public${params}`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function attachReferral(code: string) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/referrals/attach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function sendReferralInvite(email: string) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/referrals/invite', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  let data: { ok?: boolean; error?: string } = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    throw new Error('Érvénytelen válasz a szervertől.');
  }
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Meghívó küldése sikertelen.');
  }
  return data;
}
