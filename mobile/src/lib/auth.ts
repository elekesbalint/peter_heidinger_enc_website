import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export async function signInWithGoogle(): Promise<void> {
  const redirectUri = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Nem sikerült a Google bejelentkezési URL lekérése.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== 'success') {
    // A felhasználó megszakította — nem dobunk hibát
    return;
  }

  const parsedUrl = new URL(result.url);

  // PKCE flow: ?code=... paraméter
  const code = parsedUrl.searchParams.get('code');
  if (code) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) throw new Error(sessionError.message);
    return;
  }

  // Implicit flow: #access_token=...&refresh_token=... töredék
  const fragment = parsedUrl.hash.slice(1);
  const hashParams = new URLSearchParams(fragment);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw new Error(sessionError.message);
    return;
  }

  throw new Error('Nem sikerült befejezni a Google bejelentkezést. Próbáld újra.');
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  // Csak lokális kijelentkezés: nem kér hálózatot, így nincs „Network request failed” a szimulátorban.
  await supabase.auth.signOut({ scope: 'local' });
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'adriago://reset-password',
  });
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}
