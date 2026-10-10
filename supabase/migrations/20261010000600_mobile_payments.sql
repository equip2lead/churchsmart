-- PawaPay mobile money transactions.
--
-- NOTE: already applied to the remote project; kept here as the record.
create table if not exists mobile_payments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  deposit_id text unique not null,
  amount decimal not null,
  currency text not null,
  country_code text not null,
  provider text not null,
  correspondent text not null,
  phone text not null,
  plan text not null,
  -- Not in the brief's DDL, but the deposit amount depends on it, so the row
  -- has to record which period was paid for.
  billing_period text not null default 'monthly',
  status text default 'pending' check (status in ('pending','completed','failed','cancelled')),
  pawapay_response jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists mobile_payments_church_idx on mobile_payments (church_id, created_at desc);
create index if not exists mobile_payments_status_idx on mobile_payments (status, created_at desc);

alter table mobile_payments enable row level security;

-- A church's admins see that church's payments; platform admins see every row.
-- Writes come only from the API via the service role, which bypasses RLS, so
-- no insert/update policy is granted to clients.
drop policy if exists "Church admins read own mobile payments" on mobile_payments;
create policy "Church admins read own mobile payments"
  on mobile_payments for select
  using (
    is_platform_admin()
    or (
      church_id = get_my_church_id()
      and exists (
        select 1 from church_users cu
        where cu.auth_id = auth.uid()
          and coalesce(cu.is_active, true)
          and (cu.role = 'ADMIN' or cu.is_super_admin = true)
      )
    )
  );
