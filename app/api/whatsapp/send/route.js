// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
//
// Bulk WhatsApp send through the church's own Wamatas instance. Credentials are
// read server-side from whatsapp_config and never returned to the client.
import crypto from 'crypto';
import {
  getServiceClient,
  toWamatasNumber,
  sendWamatasText,
  loadWhatsAppConfig,
  recordSend,
  logSend,
  delay,
  SEND_SPACING_MS,
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

    // ── Church credentials and quota ──
    const configResult = await loadWhatsAppConfig(supabase, churchId);
    if (configResult.error) {
      return Response.json({ error: configResult.error, code: configResult.code || 'CONFIG_ERROR' }, { status: 403 });
    }
    const { config, instanceId, accessToken, dailyLimit } = configResult;
    let sentToday = configResult.sentToday;

    if (configResult.remaining <= 0) {
      return Response.json(
        { error: 'Daily message limit reached', code: 'DAILY_LIMIT_REACHED', sent: 0, failed: 0, dailyLimit, sentToday },
        { status: 429 }
      );
    }

    // ── Resolve the recipient list ──
    // A groupId is expanded here rather than in the browser: group_members is
    // not readable with an anon session under current RLS.
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
          .select('id, first_name, last_name, phone')
          .eq('church_id', churchId)
          .in('id', memberIds);
        targets = (groupMembers || [])
          .filter(m => m.phone)
          .map(m => ({ id: m.id, phone: m.phone, name: `${m.first_name || ''} ${m.last_name || ''}`.trim() }));
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

    // Collapse duplicate numbers so one person is not messaged twice (and
    // charged twice against the quota) when they match several filters.
    const seen = new Set();
    const deduped = [];
    for (const target of targets) {
      const formatted = toWamatasNumber(target.phone);
      if (formatted && seen.has(formatted)) continue;
      if (formatted) seen.add(formatted);
      deduped.push({ ...target, formatted });
    }

    // ── Send ──
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < deduped.length; i++) {
      const target = deduped[i];
      const label = target.name || target.phone;

      // Re-checked every iteration: the quota is shared with the birthday
      // automation, so it can run out mid-batch.
      if (sentToday >= dailyLimit) {
        failed++;
        errors.push(`${label}: daily limit reached`);
        await logSend(supabase, {
          churchId, recipientId: target.id || null, purpose: 'bulk_message',
          phone: target.phone, message, status: 'failed',
          errorMessage: 'Daily message limit reached'
        });
        continue;
      }

      if (!target.formatted) {
        failed++;
        errors.push(`${label}: invalid phone number`);
        await logSend(supabase, {
          churchId, recipientId: target.id || null, purpose: 'bulk_message',
          phone: target.phone, message, status: 'failed',
          errorMessage: 'Invalid phone number'
        });
        continue;
      }

      const result = await sendWamatasText({ to: target.phone, message, instanceId, accessToken });

      if (result.ok) {
        sent++;
        sentToday++;
        // Persisted per message so a function timeout cannot leave sends
        // uncounted and let the church overshoot its limit.
        await recordSend(supabase, config.id, sentToday);
        await logSend(supabase, {
          churchId, recipientId: target.id || null, purpose: 'bulk_message',
          phone: target.formatted, message, status: 'sent',
          providerMessageId: result.providerMessageId
        });
      } else {
        failed++;
        errors.push(`${label}: ${result.error}`);
        await logSend(supabase, {
          churchId, recipientId: target.id || null, purpose: 'bulk_message',
          phone: target.formatted || target.phone, message, status: 'failed',
          errorMessage: result.error, raw: result.raw
        });
      }

      // Space out bulk sends to stay under the provider's rate limit.
      if (i < deduped.length - 1) await delay(SEND_SPACING_MS);
    }

    // Aggregate record for the Messaging History tab, which renders `messages`
    // (one row per send, recipient_count). Per-recipient detail lives in
    // whatsapp_send_log.
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
      if (logError) console.error(`${tag} message_log_failed`, logError.message);
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
