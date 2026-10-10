-- equip2lead@gmail.com becomes the sole hardcoded platform owner.
--
-- NOTE: already applied to the remote project; kept here as the record.
--
-- denis_ekobena@rfis.org is removed: it had no auth user, no church_users row
-- and no sub_admins row, so this revokes a standing grant for an address that
-- never signed up rather than removing anyone's access.
--
-- Mirrors SUPER_ADMIN_EMAILS in lib/superAdmin.js -- keep the two in step.
-- Anyone else who needs access is invited through the Team tab, which records
-- them in sub_admins with a role, an inviter and an audit trail.
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'equip2lead@gmail.com'
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
