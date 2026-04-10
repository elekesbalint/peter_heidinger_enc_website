import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const supabaseUrl =
  extra.supabaseUrl?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const supabaseAnonKey =
  extra.supabaseAnonKey?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

function normalizeApiBaseUrl(url: string): string {
  let u = String(url).trim().replace(/\/+$/, '');
  if (Platform.OS === 'ios' && /^https?:\/\/localhost\b/i.test(u)) {
    u = u.replace(/localhost/i, '127.0.0.1');
  }
  return u;
}

const relayApiBase = normalizeApiBaseUrl(
  extra.apiBaseUrl?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '',
);

/**
 * Szimulátor / emulátor: RN fetch gyakran elhasal a *.supabase.co auth felé (pl. iOS Sim 18.4).
 * Ilyenkor a GoTrue hívások a Next.js API-n keresztül mennek (ugyanaz a domain, mint a többi mobil API).
 */
const useAuthRelay = !Device.isDevice && !!relayApiBase;

function shouldRelayAuthUrl(urlString: string): boolean {
  if (!supabaseUrl) return false;
  try {
    const u = new URL(urlString);
    const base = new URL(supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl);
    return u.origin === base.origin && u.pathname.startsWith('/auth/v1');
  } catch {
    return false;
  }
}

async function bodyInitToString(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  return null;
}

async function resolveFetchArgs(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ url: string; method: string; headers: Headers; bodyText: string | null }> {
  if (typeof input === 'string') {
    const headers = new Headers(init?.headers ?? undefined);
    const method = (init?.method || 'GET').toUpperCase();
    const bodyText = await bodyInitToString(init?.body ?? undefined);
    return { url: input, method, headers, bodyText };
  }
  if (input instanceof URL) {
    const headers = new Headers(init?.headers ?? undefined);
    const method = (init?.method || 'GET').toUpperCase();
    const bodyText = await bodyInitToString(init?.body ?? undefined);
    return { url: input.href, method, headers, bodyText };
  }
  const req = input;
  const headers = new Headers(req.headers);
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }
  const method = (init?.method ?? req.method).toUpperCase();
  let bodyText: string | null = null;
  if (init?.body != null) {
    bodyText = await bodyInitToString(init.body);
  } else if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      bodyText = await req.clone().text();
    } catch {
      bodyText = null;
    }
  }
  return { url: req.url, method, headers, bodyText };
}

function createAuthRelayFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const resolved = await resolveFetchArgs(input, init);
    if (!shouldRelayAuthUrl(resolved.url)) {
      return globalThis.fetch(input, init);
    }

    const headersObj: Record<string, string> = {};
    resolved.headers.forEach((v, k) => {
      headersObj[k] = v;
    });

    let relayRes: Response;
    try {
      relayRes = await globalThis.fetch(`${relayApiBase}/api/mobile/supabase-auth-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resolved.url,
          method: resolved.method,
          headers: headersObj,
          body: resolved.bodyText,
        }),
      });
    } catch {
      return globalThis.fetch(input, init);
    }

    if (!relayRes.ok) {
      let detail = '';
      try {
        const j = (await relayRes.json()) as { error?: string };
        detail = typeof j.error === 'string' ? j.error : '';
      } catch {
        try {
          detail = await relayRes.text();
        } catch {
          detail = '';
        }
      }
      throw new TypeError(detail || `Auth relay HTTP ${relayRes.status}`);
    }

    const data = (await relayRes.json()) as {
      ok?: boolean;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
    };

    if (!data.ok) {
      return globalThis.fetch(input, init);
    }

    return new Response(data.body ?? '', {
      status: data.status,
      statusText: data.statusText,
      headers: new Headers(data.headers),
    });
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  ...(useAuthRelay ? { global: { fetch: createAuthRelayFetch() } } : {}),
});

export function assertSupabaseConfigured(): void {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase nincs beállítva: EXPO_PUBLIC_SUPABASE_URL és EXPO_PUBLIC_SUPABASE_ANON_KEY kell a .env-ben, majd indítsd újra a Metro-t (expo start -c).',
    );
  }
}

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  tax_number: string | null;
  company_name: string | null;
  is_company: boolean | null;
};

export type DeviceWallet = {
  device_identifier: string;
  balance_huf: number;
  updated_at: string;
};

export type EncDeviceOrder = {
  id: string;
  device_identifier: string | null;
  status: string;
  paid_at: string | null;
  amount_huf: number | null;
  license_plate: string | null;
  category: string | null;
  created_at: string;
};

export type StripeTopup = {
  id: string;
  device_identifier: string | null;
  amount_huf: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  payload?: Record<string, unknown>;
};
