-- Ceges profil mezok (cegnev, adoszam)
-- Futtasd a Supabase SQL Editorben a korabbi schema fajlok utan.

alter table profiles
  add column if not exists company_name text,
  add column if not exists tax_number text;
