-- churches.plan becomes the single source of truth for a church's tier.
--
-- NOTE: already applied to the remote project; kept here as the record.
--
-- Added without the CHECK first so the backfill can normalise existing data:
-- churches.subscription_plan and subscriptions.plan both held UPPERCASE values
-- ('FREE', 'PRO'), which the lowercase CHECK rejects outright. A plain
-- `ADD COLUMN plan TEXT DEFAULT 'free'` would also have silently demoted the
-- two PRO churches to free, since nothing backfills a default.
alter table churches add column if not exists plan text default 'free';

-- Prefer the subscriptions row (what the app read until now), fall back to
-- churches.subscription_plan, then 'free'. Unrecognised values land on 'free'
-- rather than failing the constraint.
update churches c
set plan = case lower(coalesce(
      (select s.plan from subscriptions s where s.church_id = c.id order by s.created_at desc limit 1),
      c.subscription_plan,
      'free'
    ))
    when 'starter' then 'starter'
    when 'growth'  then 'growth'
    when 'pro'     then 'pro'
    else 'free'
  end;

alter table churches alter column plan set not null;

alter table churches drop constraint if exists churches_plan_check;
alter table churches add constraint churches_plan_check
  check (plan in ('free','starter','growth','pro'));
