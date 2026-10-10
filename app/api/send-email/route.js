// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
//
// Bulk email composed on the Messaging page. Before this route existed the
// page only wrote a `messages` row and showed a success toast, so nothing was
// ever delivered.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendChurchBroadcast, isValidEmailAddress } from '../../../lib/notifications';
import { canAccess, getEmailLimit, getRequiredPlan } from '../../../lib/featureGating';

// Keeps one blast inside the serverless function's time budget, and is well
// above any realistic congregation size for a single send.
const MAX_RECIPIENTS = 500;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[send-email ${reqId}]`;

  try {
    // ── Authenticate caller ──
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error(`${tag} missing_supabase_env`);
      return Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { churchId, recipients, subject, body: messageBody } = body;

    if (!churchId) {
      return Response.json({ error: 'churchId is required', code: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (typeof subject !== 'string' || !subject.trim()) {
      return Response.json({ error: 'A subject is required', code: 'MISSING_SUBJECT' }, { status: 400 });
    }
    if (typeof messageBody !== 'string' || !messageBody.trim()) {
      return Response.json({ error: 'Message cannot be empty', code: 'EMPTY_MESSAGE' }, { status: 400 });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return Response.json({ error: 'No recipients provided', code: 'NO_RECIPIENTS' }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return Response.json(
        { error: `Too many recipients in one send (max ${MAX_RECIPIENTS})`, code: 'TOO_MANY_RECIPIENTS' },
        { status: 400 }
      );
    }

    // Caller must belong to the target church.
    const { data: caller, error: callerError } = await supabase
      .from('church_users')
      .select('id, role, church_id, email, full_name')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (callerError) {
      console.error(`${tag} caller_lookup_failed`, callerError.message);
      return Response.json({ error: 'Failed to verify caller', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!caller) {
      console.log(`${tag} not_member auth_id=${authUser.id} church_id=${churchId}`);
      return Response.json({ error: 'You are not a member of this church', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }

    // ── Clean the recipient list ──
    // Invalid or duplicate addresses are reported rather than handed to the
    // provider, where they would count against the account's bounce rate.
    const seen = new Set();
    const valid = [];
    const skipped = [];

    for (const r of recipients) {
      const email = String(r?.email || '').trim();
      const label = r?.name || email || 'unknown';
      if (!email) { skipped.push(`${label}: no email address`); continue; }
      if (!isValidEmailAddress(email)) { skipped.push(`${label}: invalid email address`); continue; }
      const key = email.toLowerCase();
      if (seen.has(key)) continue; // same person matched more than one filter
      seen.add(key);
      valid.push({ email, name: r?.name || '' });
    }

    if (valid.length === 0) {
      return Response.json(
        { error: 'No recipients with a valid email address', code: 'NO_VALID_RECIPIENTS', sent: 0, failed: skipped.length, errors: skipped },
        { status: 400 }
      );
    }

    const { data: church } = await supabase
      .from('churches')
      .select('name, plan')
      .eq('id', churchId)
      .maybeSingle();

    // ── Plan gate ──
    // Email is a Starter+ feature, and each tier has a monthly allowance.
    if (!canAccess(church, 'messaging_email')) {
      return Response.json(
        {
          error: `Email messaging is available on the ${getRequiredPlan('messaging_email')} plan and above`,
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredPlan: getRequiredPlan('messaging_email')
        },
        { status: 403 }
      );
    }

    const monthlyLimit = getEmailLimit(church);
    if (Number.isFinite(monthlyLimit)) {
      // Usage is the recipients already emailed this calendar month. `messages`
      // records one row per send with recipient_count set to what the provider
      // accepted, so summing that column is the real delivered count.
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const { data: priorSends, error: usageError } = await supabase
        .from('messages')
        .select('recipient_count')
        .eq('church_id', churchId)
        .eq('message_type', 'EMAIL')
        .gte('sent_at', monthStart.toISOString());

      if (usageError) {
        console.error(`${tag} usage_lookup_failed`, usageError.message);
        return Response.json({ error: 'Failed to check your monthly email usage', code: 'USAGE_LOOKUP_FAILED' }, { status: 500 });
      }

      const usedThisMonth = (priorSends || []).reduce((sum, r) => sum + (r.recipient_count || 0), 0);
      const remaining = Math.max(0, monthlyLimit - usedThisMonth);

      // Checked before sending, as a whole: a partial blast would be harder to
      // reason about than being told to narrow the selection.
      if (valid.length > remaining) {
        return Response.json(
          {
            error: remaining === 0
              ? `You have used all ${monthlyLimit} emails included in your plan this month`
              : `This send needs ${valid.length} emails but only ${remaining} of your monthly ${monthlyLimit} remain`,
            code: 'EMAIL_LIMIT_REACHED',
            limit: monthlyLimit,
            used: usedThisMonth,
            remaining
          },
          { status: 429 }
        );
      }
    }

    const result = await sendChurchBroadcast({
      recipients: valid,
      subject: subject.trim(),
      body: messageBody,
      churchName: church?.name || ''
    });

    if (result.notConfigured) {
      console.error(`${tag} resend_not_configured`);
      return Response.json(
        { error: 'Email sending is not configured on the server', code: 'EMAIL_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const failed = result.failed + skipped.length;
    const errors = [...result.errors, ...skipped];

    console.log(`${tag} done church_id=${churchId} sent=${result.sent} failed=${failed}`);

    return Response.json({ sent: result.sent, failed, errors });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ error: 'Failed to send email', code: 'UNHANDLED' }, { status: 500 });
  }
}
