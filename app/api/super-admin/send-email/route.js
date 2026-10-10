// Platform-level email to church admins. Uses the same Resend account and
// one-message-per-recipient pattern as church messaging, so no church ever
// sees another church's address.
import { requireSuperAdmin, logAdminAction } from '../../../../lib/superAdmin';
import { sendChurchBroadcast, isValidEmailAddress } from '../../../../lib/notifications';
import { getPlanOrder } from '../../../../lib/featureGating';

const MAX_RECIPIENTS = 500;

export async function POST(request) {
  const gate = await requireSuperAdmin(request, 'send_communications');
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const body = await request.json().catch(() => ({}));
  const { audience, plans, churchIds, subject, message } = body;

  if (typeof subject !== 'string' || !subject.trim()) {
    return Response.json({ error: 'A subject is required', code: 'MISSING_SUBJECT' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'Message cannot be empty', code: 'EMPTY_MESSAGE' }, { status: 400 });
  }

  // ── Resolve which churches are in scope ──
  let query = supabase.from('churches').select('id, name, email, plan');
  if (audience === 'by_plan') {
    const wanted = (Array.isArray(plans) ? plans : []).filter(p => getPlanOrder().includes(p));
    if (wanted.length === 0) {
      return Response.json({ error: 'Select at least one plan', code: 'NO_PLANS' }, { status: 400 });
    }
    query = query.in('plan', wanted);
  } else if (audience === 'selected') {
    const ids = (Array.isArray(churchIds) ? churchIds : []).filter(Boolean);
    if (ids.length === 0) {
      return Response.json({ error: 'Select at least one church', code: 'NO_CHURCHES' }, { status: 400 });
    }
    query = query.in('id', ids);
  }
  // audience === 'all' (or anything else) leaves the query unfiltered.

  const { data: churches, error: churchError } = await query;
  if (churchError) {
    console.error('[super-admin/send-email] church lookup failed:', churchError.message);
    return Response.json({ error: 'Failed to resolve recipients', code: 'LOOKUP_FAILED' }, { status: 500 });
  }
  if (!churches || churches.length === 0) {
    return Response.json({ error: 'No churches matched that selection', code: 'NO_RECIPIENTS' }, { status: 400 });
  }

  // ── Each church's admins, falling back to the church's own address ──
  const churchIdList = churches.map(c => c.id);
  const { data: admins } = await supabase
    .from('church_users')
    .select('church_id, email, full_name')
    .in('church_id', churchIdList)
    .eq('role', 'ADMIN')
    .eq('is_active', true);

  const byChurch = new Map();
  for (const row of (admins || [])) {
    if (!row.email) continue;
    if (!byChurch.has(row.church_id)) byChurch.set(row.church_id, []);
    byChurch.get(row.church_id).push({ email: row.email, name: row.full_name || '' });
  }

  const seen = new Set();
  const recipients = [];
  const skipped = [];
  for (const church of churches) {
    const targets = byChurch.get(church.id) || (church.email ? [{ email: church.email, name: church.name }] : []);
    if (targets.length === 0) { skipped.push(`${church.name}: no admin email`); continue; }
    for (const target of targets) {
      if (!isValidEmailAddress(target.email)) { skipped.push(`${church.name}: invalid email`); continue; }
      const key = target.email.trim().toLowerCase();
      if (seen.has(key)) continue; // one person may admin several churches
      seen.add(key);
      recipients.push({ email: target.email.trim(), name: target.name });
    }
  }

  if (recipients.length === 0) {
    return Response.json({ error: 'No reachable admin email addresses', code: 'NO_VALID_RECIPIENTS', errors: skipped }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return Response.json({ error: `Too many recipients in one send (max ${MAX_RECIPIENTS})`, code: 'TOO_MANY_RECIPIENTS' }, { status: 400 });
  }

  const result = await sendChurchBroadcast({
    recipients,
    subject: subject.trim(),
    body: message,
    churchName: 'ChurchSmart'
  });

  if (result.notConfigured) {
    return Response.json({ error: 'Email sending is not configured on the server', code: 'EMAIL_NOT_CONFIGURED' }, { status: 503 });
  }

  // The audit row doubles as the campaign log the UI renders.
  await logAdminAction(supabase, {
    authUser, admin, request,
    action: 'email_sent',
    details: {
      subject: subject.trim(),
      audience: audience || 'all',
      plans: audience === 'by_plan' ? plans : null,
      church_count: churches.length,
      recipient_count: result.sent,
      failed: result.failed + skipped.length
    }
  });

  return Response.json({
    sent: result.sent,
    failed: result.failed + skipped.length,
    churches: churches.length,
    errors: [...result.errors, ...skipped]
  });
}
