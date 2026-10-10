// Everything the Super Admin dashboard renders, computed from real rows.
//
// Served from one route so the dashboard makes a single request, and so the
// cross-table arithmetic (revenue in mixed currencies, trends) lives in one
// place instead of being reassembled in the browser.
import { requireSuperAdmin } from '../../../../lib/superAdmin';
import { PLAN_PRICING, getPlanOrder } from '../../../../lib/featureGating';
import { PAWAPAY_COUNTRIES } from '../../../../lib/pawapay';

const DAY = 86400000;

/** Percentage change, or null when there is no baseline to compare against. */
function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mobile money arrives in local currency. Converted with the same usdRate the
 * checkout priced it at, so the figures are self-consistent — these are
 * USD-equivalents at configured rates, not settled FX.
 */
function momoUsd(payment) {
  const rate = PAWAPAY_COUNTRIES[payment.country_code]?.usdRate;
  const amount = Number(payment.amount || 0);
  if (!rate || !amount) return 0;
  return amount / rate;
}

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_stats');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  try {
    const [
      churchesRes, membersRes, subsRes, stripeRes, momoRes, activityRes, messagesRes, donationsRes, adminLogRes, usersRes
    ] = await Promise.all([
      supabase.from('churches').select('id, name, plan, country, city, created_at, is_suspended, email'),
      supabase.from('members').select('church_id'),
      supabase.from('subscriptions').select('church_id, plan, status'),
      supabase.from('payment_history').select('church_id, amount, currency, status, plan, created_at'),
      supabase.from('mobile_payments').select('church_id, amount, currency, country_code, provider, plan, status, created_at, completed_at'),
      supabase.from('activity_logs').select('church_id, created_at').gte('created_at', new Date(Date.now() - 7 * DAY).toISOString()),
      supabase.from('messages').select('church_id, recipient_count, sent_at'),
      supabase.from('donations').select('church_id, amount, donation_date'),
      supabase.from('admin_audit_log').select('admin_email, action, details, created_at').order('created_at', { ascending: false }).limit(60),
      supabase.from('church_users').select('church_id, email, role, is_active')
    ]);

    const firstError = [churchesRes, membersRes, subsRes, stripeRes, momoRes].find(r => r.error);
    if (firstError) {
      console.error('[dashboard-stats] query failed:', firstError.error.message);
      return Response.json({ error: 'Failed to load platform stats', code: 'QUERY_FAILED' }, { status: 500 });
    }

    const churches = churchesRes.data || [];
    const members = membersRes.data || [];
    const subscriptions = subsRes.data || [];
    const stripePayments = (stripeRes.data || []).filter(p => p.status === 'succeeded' || p.status === 'paid' || p.status === 'completed');
    const momoPayments = (momoRes.data || []).filter(p => p.status === 'completed');
    const recentActivity7d = activityRes.data || [];
    const messages = messagesRes.data || [];
    const donations = donationsRes.data || [];
    const adminLog = adminLogRes.data || [];
    const churchUsers = usersRes.data || [];

    const now = new Date();
    const thisMonth = monthKey(now);
    const last30 = new Date(now.getTime() - 30 * DAY);
    const prev30 = new Date(now.getTime() - 60 * DAY);

    // ── Members per church ──
    const memberCounts = {};
    for (const m of members) {
      if (!m.church_id) continue;
      memberCounts[m.church_id] = (memberCounts[m.church_id] || 0) + 1;
    }
    const totalMembers = members.filter(m => m.church_id).length;

    // ── Churches ──
    const churchesLast30 = churches.filter(c => c.created_at && new Date(c.created_at) >= last30).length;
    const churchesPrev30 = churches.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d >= prev30 && d < last30;
    }).length;

    // Members have no created_at of their own here, so the member trend is
    // approximated by the growth of the churches they belong to.
    const newChurchIds = new Set(churches.filter(c => c.created_at && new Date(c.created_at) >= last30).map(c => c.id));
    const prevChurchIds = new Set(churches.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d >= prev30 && d < last30;
    }).map(c => c.id));
    const membersLast30 = Object.entries(memberCounts).filter(([id]) => newChurchIds.has(id)).reduce((s, [, n]) => s + n, 0);
    const membersPrev30 = Object.entries(memberCounts).filter(([id]) => prevChurchIds.has(id)).reduce((s, [, n]) => s + n, 0);

    // ── Plans ──
    const churchesByPlan = getPlanOrder().reduce((acc, p) => { acc[p] = 0; return acc; }, {});
    for (const c of churches) {
      const plan = String(c.plan || 'free').toLowerCase();
      if (plan in churchesByPlan) churchesByPlan[plan] += 1;
    }
    const activeSubscriptions = churches.filter(c => String(c.plan || 'free').toLowerCase() !== 'free').length;

    // Run-rate implied by current plans.
    const mrr = churches.reduce((sum, c) => sum + (PLAN_PRICING[String(c.plan || 'free').toLowerCase()]?.monthlyUsd || 0), 0);

    // ── Revenue actually received ──
    const revenueIn = (rows, dateOf, usdOf, from, to) => rows.reduce((sum, r) => {
      const when = dateOf(r) ? new Date(dateOf(r)) : null;
      if (!when || isNaN(when.getTime())) return sum;
      if (from && when < from) return sum;
      if (to && when >= to) return sum;
      return sum + usdOf(r);
    }, 0);

    const stripeUsd = (p) => (Number(p.amount || 0) / 100); // Stripe amounts are minor units
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    const revenueThisMonth =
      revenueIn(stripePayments, p => p.created_at, stripeUsd, monthStart, null)
      + revenueIn(momoPayments, p => p.completed_at || p.created_at, momoUsd, monthStart, null);
    const revenuePrevMonth =
      revenueIn(stripePayments, p => p.created_at, stripeUsd, prevMonthStart, monthStart)
      + revenueIn(momoPayments, p => p.completed_at || p.created_at, momoUsd, prevMonthStart, monthStart);

    // ── 12-month series ──
    const churchSignupsByMonth = [];
    const revenueByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const key = monthKey(start);
      const label = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

      churchSignupsByMonth.push({
        key, label,
        value: churches.filter(c => String(c.created_at || '').slice(0, 7) === key).length
      });
      revenueByMonth.push({
        key, label,
        value: Math.round(
          revenueIn(stripePayments, p => p.created_at, stripeUsd, start, end)
          + revenueIn(momoPayments, p => p.completed_at || p.created_at, momoUsd, start, end)
        )
      });
    }

    // ── Admin email per church, for the top-churches table ──
    const adminByChurch = {};
    for (const u of churchUsers) {
      if (!u.church_id || u.role !== 'ADMIN' || u.is_active === false) continue;
      if (!adminByChurch[u.church_id]) adminByChurch[u.church_id] = u.email;
    }

    const topChurches = churches
      .map(c => ({
        id: c.id,
        name: c.name,
        plan: String(c.plan || 'free').toLowerCase(),
        members: memberCounts[c.id] || 0,
        adminEmail: adminByChurch[c.id] || c.email || null,
        country: c.country || null,
        createdAt: c.created_at,
        isSuspended: !!c.is_suspended
      }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 10);

    // ── Recent platform activity ──
    // Three sources merged on timestamp: signups, audited plan changes, and
    // completed payments.
    const churchNameById = Object.fromEntries(churches.map(c => [c.id, c.name]));
    const feed = [
      ...churches
        .filter(c => c.created_at)
        .map(c => ({ kind: 'signup', churchName: c.name, at: c.created_at, detail: String(c.plan || 'free').toLowerCase() })),
      ...adminLog
        .filter(l => l.action === 'plan_changed')
        .map(l => ({
          kind: 'plan_changed',
          churchName: churchNameById[l.details?.church_id] || l.details?.church_name || '—',
          at: l.created_at,
          detail: `${l.details?.from || '?'} → ${l.details?.to || '?'}`,
          by: l.admin_email
        })),
      ...momoPayments.map(p => ({
        kind: 'payment',
        churchName: churchNameById[p.church_id] || '—',
        at: p.completed_at || p.created_at,
        detail: `${p.currency} ${Number(p.amount || 0).toLocaleString()} · ${p.provider}`
      })),
      ...stripePayments.map(p => ({
        kind: 'payment',
        churchName: churchNameById[p.church_id] || '—',
        at: p.created_at,
        detail: `${String(p.currency || 'usd').toUpperCase()} ${(Number(p.amount || 0) / 100).toFixed(2)} · Card`
      }))
    ]
      .filter(x => x.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 20);

    // ── Countries ──
    const byCountry = {};
    for (const c of churches) {
      const key = (c.country || '').trim() || 'Unknown';
      byCountry[key] = (byCountry[key] || 0) + 1;
    }
    const churchesByCountry = Object.entries(byCountry)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // ── Engagement ──
    const activeChurchIds = new Set(recentActivity7d.map(a => a.church_id).filter(Boolean));
    const messagesThisMonth = messages
      .filter(m => String(m.sent_at || '').slice(0, 7) === thisMonth)
      .reduce((sum, m) => sum + (m.recipient_count || 0), 0);
    const donationsThisMonth = donations
      .filter(d => String(d.donation_date || '').slice(0, 7) === thisMonth)
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    return Response.json({
      totalChurches: churches.length,
      totalChurchesTrend: pctChange(churchesLast30, churchesPrev30),
      totalMembers,
      totalMembersTrend: pctChange(membersLast30, membersPrev30),
      revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      revenueTrend: pctChange(revenueThisMonth, revenuePrevMonth),
      mrr,
      activeSubscriptions,
      activeSubscriptionsTrend: pctChange(
        churches.filter(c => String(c.plan || 'free').toLowerCase() !== 'free' && c.created_at && new Date(c.created_at) >= last30).length,
        churches.filter(c => {
          if (String(c.plan || 'free').toLowerCase() === 'free' || !c.created_at) return false;
          const d = new Date(c.created_at);
          return d >= prev30 && d < last30;
        }).length
      ),
      churchesByPlan,
      churchSignupsByMonth,
      revenueByMonth,
      topChurches,
      recentActivity: feed,
      churchesByCountry,
      engagementMetrics: {
        avgMembersPerChurch: churches.length ? Math.round((totalMembers / churches.length) * 10) / 10 : 0,
        activeChurchesLast7Days: activeChurchIds.size,
        messagesThisMonth,
        donationsThisMonth: Math.round(donationsThisMonth),
        suspendedChurches: churches.filter(c => c.is_suspended).length,
        subscriptionsPastDue: subscriptions.filter(s => s.status === 'past_due').length
      }
    });
  } catch (error) {
    console.error('[dashboard-stats] unhandled', error);
    return Response.json({ error: 'Failed to load platform stats', code: 'UNHANDLED' }, { status: 500 });
  }
}
