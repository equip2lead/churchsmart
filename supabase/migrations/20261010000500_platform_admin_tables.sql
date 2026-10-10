-- Platform admin: church suspension, sub-admins, settings, audit trail.
--
-- NOTE: already applied to the remote project; kept here as the record.
alter table churches add column if not exists is_suspended boolean not null default false;

create table if not exists sub_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null unique,
  name text,
  role text not null check (role in ('super_admin','support','finance','viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  is_active boolean default true,
  last_login timestamptz
);

create table if not exists platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  is_secret boolean default false,
  last4 text generated always as (right(value, 4)) stored,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text not null,
  action text not null,
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_email_idx on admin_audit_log (admin_email, created_at desc);

-- SUPERSEDED: the owner list in this function was corrected by
-- 20261010000700_fix_platform_admin_emails.sql. The address below is the
-- original (wrong) one and is kept only as a record of what was applied.
-- SECURITY DEFINER so the sub_admins lookup is not itself subject to RLS,
-- which would recurse when sub_admins' own policy calls this function.
-- search_path is pinned so a caller cannot redirect it. Mirrors
-- SUPER_ADMIN_EMAILS in lib/superAdmin.js — keep the two in step.
create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('zoezina@gmail.com', 'denis_ekobena@rfis.org')
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

alter table sub_admins enable row level security;
alter table platform_settings enable row level security;
alter table admin_audit_log enable row level security;

drop policy if exists "Platform admins read sub_admins" on sub_admins;
create policy "Platform admins read sub_admins"
  on sub_admins for select using (is_platform_admin());

-- platform_settings deliberately has NO policy: secrets are never read through
-- a client. The API returns last4 only, via the service role.
drop policy if exists "Platform admins read platform_settings" on platform_settings;

drop policy if exists "Platform admins read admin_audit_log" on admin_audit_log;
create policy "Platform admins read admin_audit_log"
  on admin_audit_log for select using (is_platform_admin());
