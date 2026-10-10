-- Correct the platform owner list.
--
-- zoezina@gmail.com is the FIRE CHURCH admin account, not the platform owner;
-- the original list granted a church admin platform-wide access. Replaced with
-- equip2lead@gmail.com. Mirrors SUPER_ADMIN_EMAILS in lib/superAdmin.js —
-- keep the two in step.
--
-- SUPERSEDED: the owner list here was reduced to a single address by
-- 20261010000800_sole_platform_owner.sql. Kept as a record of what was
-- applied at the time.
--
-- NOTE: already applied to the remote project; kept here as the record.
--
-- `stable` is retained from the original definition (the brief's version
-- omitted it, which would make the function volatile and have Postgres
-- re-evaluate it per row during RLS checks).
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('equip2lead@gmail.com', 'denis_ekobena@rfis.org')
    or exists (
      select 1 from sub_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce(sa.is_active, false)
        and sa.accepted_at is not null
    ),
    false
  );
$$;

revoke all on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;
