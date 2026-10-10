// Platform report as CSV: one row per church.
import { requireSuperAdmin, logAdminAction } from '../../../../lib/superAdmin';

/** RFC 4180 quoting: wrap in quotes and double any embedded quote. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // A leading =, +, - or @ is treated as a formula by spreadsheet apps, so it
  // is prefixed with a quote to keep the export inert.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_churches');
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const [churchesRes, membersRes, usersRes, activityRes] = await Promise.all([
    supabase.from('churches').select('id, name, plan, country, city, email, created_at, is_suspended'),
    supabase.from('members').select('church_id'),
    supabase.from('church_users').select('church_id, email, role, is_active'),
    supabase.from('activity_logs').select('church_id, created_at').order('created_at', { ascending: false }).limit(5000)
  ]);

  if (churchesRes.error) {
    console.error('[export-report] query failed:', churchesRes.error.message);
    return Response.json({ error: 'Failed to build the report', code: 'QUERY_FAILED' }, { status: 500 });
  }

  const memberCounts = {};
  for (const m of (membersRes.data || [])) {
    if (!m.church_id) continue;
    memberCounts[m.church_id] = (memberCounts[m.church_id] || 0) + 1;
  }

  const adminByChurch = {};
  for (const u of (usersRes.data || [])) {
    if (!u.church_id || u.role !== 'ADMIN' || u.is_active === false) continue;
    if (!adminByChurch[u.church_id]) adminByChurch[u.church_id] = u.email;
  }

  // activity_logs comes back newest-first, so the first hit per church is its
  // most recent activity.
  const lastActive = {};
  for (const a of (activityRes.data || [])) {
    if (!a.church_id || lastActive[a.church_id]) continue;
    lastActive[a.church_id] = a.created_at;
  }

  const header = ['Church Name', 'Plan', 'Admin Email', 'Member Count', 'Created Date', 'Last Active', 'Country', 'Status'];
  const rows = (churchesRes.data || [])
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(c => [
      c.name,
      String(c.plan || 'free').toLowerCase(),
      adminByChurch[c.id] || c.email || '',
      memberCounts[c.id] || 0,
      c.created_at ? String(c.created_at).slice(0, 10) : '',
      lastActive[c.id] ? String(lastActive[c.id]).slice(0, 10) : '',
      c.country || c.city || '',
      c.is_suspended ? 'suspended' : 'active'
    ]);

  // BOM so Excel opens UTF-8 church names correctly.
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');

  await logAdminAction(supabase, {
    authUser, admin, request,
    action: 'platform_report_exported',
    details: { churches: rows.length }
  });

  const filename = `churchsmart-platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
