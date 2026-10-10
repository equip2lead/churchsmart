-- whatsapp_config: church-facing number + usable RLS.
--
-- NOTE: already applied to the remote project; kept here as the record.
-- (This file was lost to a shell error in the commit that applied it.)
--
-- Both original policies gated on is_church_admin_or_above(), which resolves
-- the caller against public.users. That table is empty in this project (the
-- real user table is church_users, which get_my_church_id() already reads), so
-- the function returned false for everyone: admins could neither read nor
-- write their own WhatsApp config from the browser.
--
-- Read is open to any member of the church so the Messaging page can tell
-- whether WhatsApp is active; writes stay admin-only. Scoped to this table --
-- is_church_admin_or_above() is left alone because other policies depend on it.
alter table public.whatsapp_config
  add column if not exists phone_number varchar(32);

drop policy if exists "Admins can manage WhatsApp config" on public.whatsapp_config;
drop policy if exists "Admins can view WhatsApp config" on public.whatsapp_config;

create policy "Church users can view WhatsApp config"
  on public.whatsapp_config
  for select
  using (church_id = get_my_church_id());

create policy "Church admins can manage WhatsApp config"
  on public.whatsapp_config
  for all
  using (
    church_id = get_my_church_id()
    and exists (
      select 1 from public.church_users cu
      where cu.auth_id = auth.uid()
        and coalesce(cu.is_active, true)
        and (cu.role = 'ADMIN' or cu.is_super_admin = true)
    )
  )
  with check (
    church_id = get_my_church_id()
    and exists (
      select 1 from public.church_users cu
      where cu.auth_id = auth.uid()
        and coalesce(cu.is_active, true)
        and (cu.role = 'ADMIN' or cu.is_super_admin = true)
    )
  );
