-- Fix: writes to expense_categories were impossible for every user.
--
-- The table shipped with this policy:
--   "Admins can manage expense categories"
--   USING (church_id = get_my_church_id() AND is_church_admin_or_above())
--
-- is_church_admin_or_above() resolves the caller against public.users:
--   SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('SUPER_ADMIN','CHURCH_ADMIN')
--
-- but public.users is empty in this project. The real user table is
-- church_users (keyed by auth_id, roles 'ADMIN'/'VOLUNTEER'), which is what
-- get_my_church_id() already reads. So the function returned false for
-- everyone and RLS rejected every INSERT/UPDATE/DELETE on expense_categories,
-- which blocks both "+ Add Category" and the Settings management section.
--
-- Scoped deliberately to this table. is_church_admin_or_above() is left alone:
-- it also gates 11 other policies (services, ministries, donation_categories,
-- whatsapp_config, scheduled_reports, prayer_requests, audit_logs,
-- user_church_access, users), and redefining it here would silently grant
-- write access across all of them as a side effect of this feature.

drop policy if exists "Admins can manage expense categories" on public.expense_categories;

create policy "Church admins can manage expense categories"
  on public.expense_categories
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
