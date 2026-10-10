-- Wamatas integration: per-attempt send log + test-result columns.
--
-- NOTE: already applied to the remote project; kept here as the record.
create table if not exists whatsapp_send_log (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  recipient_id uuid,
  purpose text not null,
  phone text not null,
  message_preview text,
  provider text not null default 'wamatas',
  provider_message_id text,
  status text not null check (status in ('sent','failed')),
  error_message text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_send_log_church_created_idx
  on whatsapp_send_log (church_id, created_at desc);

alter table whatsapp_send_log enable row level security;

-- The brief's version of this policy gated SELECT on is_church_admin_or_above(),
-- which resolves the caller against public.users -- empty in this project -- so
-- it returns false for everyone and the log page would always read as empty.
-- Same church_users predicate the whatsapp_config and expense_categories
-- policies already use.
drop policy if exists "Admins can view send log" on whatsapp_send_log;
create policy "Admins can view send log"
  on whatsapp_send_log
  for select
  using (
    church_id = get_my_church_id()
    and exists (
      select 1 from church_users cu
      where cu.auth_id = auth.uid()
        and coalesce(cu.is_active, true)
        and (cu.role = 'ADMIN' or cu.is_super_admin = true)
    )
  );

-- Inserts come from the API routes via the service role, which bypasses RLS.
drop policy if exists "Server can insert send log" on whatsapp_send_log;
create policy "Server can insert send log"
  on whatsapp_send_log
  for insert
  with check (true);

alter table whatsapp_config add column if not exists last_test_sent_at timestamptz;
alter table whatsapp_config add column if not exists last_test_status text;
