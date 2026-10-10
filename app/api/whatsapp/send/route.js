// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
//
// Bulk WhatsApp send. Messages go out through the platform's central WhatsApp
// Business account (env credentials); the church only has to be activated and
// within its daily quota.
import crypto from 'crypto';
import {
  getServiceClient,
  getPlatformCredentials,
  formatPhone,
  sendWhatsAppText,
  loadWhatsAppConfig,
  recordSend,
  WHATSAPP_MAX_LENGTH
} from '../../../../lib/whatsapp';

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[whatsapp-send ${reqId}]`;

  try {
    // ── Authenticate caller ──
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      console.error(`${tag} missing_supabase_env`);
      return Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
    }
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { churchId, recipients, message, groupId } = body;

    if (!churchId || !message) {
      return Response.json({ error: 'churchId and message are required', code: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return Response.json({ error: 'Message cannot be empty', code: 'EMPTY_MESSAGE' }, { status: 400 });
    }
    if (message.length > WHATSAPP_MAX_LENGTH) {
      return Response.json({ error: `Message exceeds ${WHATSAPP_MAX_LENGTH} characters`, code: 'MESSAGE_TOO_LONG' }, { status: 400 });
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

    // ── Platform credentials ──
    const credentials = getPlatformCredentials();
    if (!credentials) {
      console.error(`${tag} missing_platform_credentials`);
      return Response.json(
        { error: 'WhatsApp is not configured on the server', code: 'PLATFORM_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    // ── Church must be active and within quota ──
    const configResult = await loadWhatsAppConfig(supabase, churchId);
    if (configResult.error) {
      return Response.json({ error: configResult.error, code: configResult.code || 'CONFIG_ERROR' }, { status: 403 });
    }
    const { config, dailyLimit } = configResult;
    let sentToday = configResult.sentToday;

    if (configResult.remaining <= 0) {
      return Response.json(
        { error: 'Daily message limit reached', code: 'DAILY_LIMIT_REACHED', sent: 0, failed: 0, dailyLimit, sentToday },
        { status: 429 }
      );
    }

    // ── Resolve the recipient list ──
    // A groupId is resolved here rather than in the browser: group_members is
    // not readable with an anon session under current RLS, so the client has
    // no way to expand a group itself.
    let targets = [];
    if (groupId) {
      const { data: links, error: linkError } = await supabase
        .from('group_members')
        .select('member_id')
        .eq('church_id', churchId)
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (linkError) {
        console.error(`${tag} group_lookup_failed`, linkError.message);
        return Response.json({ error: 'Failed to read group members', code: 'GROUP_LOOKUP_FAILED' }, { status: 500 });
      }

      const memberIds = (links || []).map(l => l.member_id).filter(Boolean);
      if (memberIds.length > 0) {
        const { data: groupMembers } = await supabase
          .from('members')
          .select('first_name, last_name, phone')
          .eq('church_id', churchId)
          .in('id', memberIds);
        targets = (groupMembers || [])
          .filter(m => m.phone)
          .map(m => ({ phone: m.phone, name: `${m.first_name || ''} ${m.last_name || ''}`.trim() }));
      }
    } else {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return Response.json({ error: 'No recipients provided', code: 'NO_RECIPIENTS' }, { status: 400 });
      }
      targets = recipients.filter(r => r && r.phone);
    }

    if (targets.length === 0) {
      return Response.json({ error: 'No recipients with a phone number', code: 'NO_RECIPIENTS' }, { status: 400 });
    }

    // Collapse duplicate numbers so one person isn't messaged twice (and
    // charged twice against the quota) when they match several filters.
    const seen = new Set();
    const deduped = [];
    for (const target of targets) {
      const formatted = formatPhone(target.phone);
      if (!formatted) {
        deduped.push({ ...target, formatted: null });
        continue;
      }
      if (seen.has(formatted)) continue;
      seen.add(formatted);
      deduped.push({ ...target, formatted });
    }

    // ── Send ──
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const target of deduped) {
      const label = target.name || target.phone;

      if (!target.formatted) {
        failed++;
        errors.push(`${label}: invalid phone number`);
        continue;
      }

      // Re-check before every send: the quota is shared across concurrent
      // senders and birthday automation, so it can run out mid-batch.
      if (sentToday >= dailyLimit) {
        failed++;
        errors.push(`${label}: daily limit reached`);
        continue;
      }

      const result = await sendWhatsAppText({
        token: credentials.token,
        phoneNumberId: credentials.phoneNumberId,
        to: target.formatted,
        message
      });

      if (result.success) {
        sent++;
        sentToday++;
        // Persisted per message so a function timeout can't leave sends
        // uncounted and let the church overshoot its limit.
        await recordSend(supabase, config.id, sentToday);
      } else {
        failed++;
        errors.push(`${label}: ${result.error}`);
      }
    }

    // ── Log the blast ──
    // `messages` is aggregate-shaped (one row per send, recipient_count), which
    // is what the History tab renders, so this records the batch rather than
    // one row per recipient.
    if (sent > 0 || failed > 0) {
      const { error: logError } = await supabase.from('messages').insert({
        church_id: churchId,
        message_type: 'WHATSAPP',
        recipient_type: groupId ? 'GROUP' : 'INDIVIDUAL',
        recipient_count: sent,
        body: message,
        status: failed === 0 ? 'SENT' : (sent === 0 ? 'FAILED' : 'PARTIAL'),
        sent_by: caller.email || caller.full_name || 'Admin'
      });
      if (logError) console.error(`${tag} log_failed`, logError.message);
    }

    console.log(`${tag} done church_id=${churchId} sent=${sent} failed=${failed} sent_today=${sentToday}/${dailyLimit}`);

    return Response.json({
      sent,
      failed,
      errors,
      sentToday,
      dailyLimit,
      remaining: Math.max(0, dailyLimit - sentToday)
    });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ error: 'Failed to send messages', code: 'UNHANDLED' }, { status: 500 });
  }
}
