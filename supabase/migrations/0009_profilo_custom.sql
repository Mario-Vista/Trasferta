-- ============================================================================
-- Trasferta — 0009_profilo_custom.sql
-- Permette a ciascuno di personalizzare nome e foto profilo (già possibile
-- lato RLS, profiles_update_self in 0002_rls.sql lascia cambiare nome e
-- avatar_url liberamente, solo ruolo è bloccato). Qui si aggiunge:
--  - uno "snapshot" del nome/foto originali di Google, per poter ripristinare
--    in qualunque momento ("sempre resettabili");
--  - un bucket Storage per caricare davvero una foto (non solo un link).
-- ============================================================================

alter table public.profiles
  add column if not exists nome_google text,
  add column if not exists avatar_url_google text;

-- Per chi è già registrato, lo snapshot di partenza è quello che ha adesso
-- (comunque arrivato da Google al primo login).
update public.profiles
set nome_google = coalesce(nome_google, nome),
    avatar_url_google = coalesce(avatar_url_google, avatar_url)
where nome_google is null;

-- Il trigger di creazione profilo ora popola anche lo snapshot.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  v_nome := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, email, nome, avatar_url, nome_google, avatar_url_google)
  values (
    new.id,
    new.email,
    v_nome,
    new.raw_user_meta_data ->> 'avatar_url',
    v_nome,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage: bucket "avatars", pubblico in lettura (le foto profilo le vede
-- chiunque usi l'app, come già l'avatar di Google). Ognuno scrive solo dentro
-- la propria cartella `<user_id>/...`.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
