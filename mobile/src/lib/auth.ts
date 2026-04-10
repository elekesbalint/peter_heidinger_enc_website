import { supabase } from './supabase';

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
  // Először megpróbáljuk a szerveres kijelentkezést, de ha nem sikerül (nincs net),
  // akkor csak a lokális session-t töröljük – a felhasználó így is kijelentkezik.
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
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
