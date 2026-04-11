-- Profilkép publikus URL-je (mobil feltöltés után).
-- Futtasd a Supabase SQL Editorben.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'Nyilvános URL (pl. Supabase Storage) a felhasználó profilképéhez.';

-- Storage (Dashboard): hozz létre egy „avatars” (vagy .env: SUPABASE_STORAGE_BUCKET_AVATARS) bucketet,
-- nyilvános olvasás (public), feltöltéshez a service role kulcsot használja az API.
