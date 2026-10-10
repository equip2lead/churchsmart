// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
//
// Sends one confirmation message so an admin can verify their Wamatas
// credentials. The first successful test is what activates WhatsApp for the
// church (is_active = true).
import crypto from 'crypto';
import {
  getServiceClient,
  toWamatasNumber,
  sendWamatasText,
  loadWhatsAppConfig,
  recordSend,
  logSend
} from '../../../../lib/whatsapp';

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[whatsapp-test ${reqId}]`;

  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ success: false, error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      console.error(`${tag} missing_supabase_env`);
      return Response.json({ success: false, error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return Response.json({ success: false, error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { churchId, testPhone } = body;

    if (!churchId || !testPhone) {
      return Response.json({ success: false, error: 'churchId and testPhone are required', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    // Only admins of this church may fire a test.
    const { data: caller, error: callerError } = await supabase
      .from('church_users')
      .select('id, role, church_id')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (callerError) {
      console.error(`${tag} caller_lookup_failed`, callerError.message);
      return Response.json({ success: false, error: 'Failed to verify caller', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!caller) {
      return Response.json({ success: false, error: 'You are not a member of this church', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }
    if (caller.role !== 'ADMIN') {
      return Response.json({ success: false, error: 'Only church admins can send a test message', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }

    const formatted = toWamatasNumber(testPhone);
    if (!formatted) {
      return Response.json({ success: false, error: 'Invalid phone number', code: 'INVALID_PHONE' }, { status: 400 });
    }

    // requireActive: false — a test runs on saved credentials before the church
    // has ever been activated, since passing the test is what activates it.
    const configResult = await loadWhatsAppConfig(supabase, churchId, { requireActive: false });
    if (configResult.error) {
      return Response.json({ success: false, error: configResult.error, code: configResult.code || 'CONFIG_ERROR' }, { status: 403 });
    }
    const { config, instanceId, accessToken, dailyLimit } = configResult;

    if (configResult.remaining <= 0) {
      return Response.json({ success: false, error: 'Daily message limit reached', code: 'DAILY_LIMIT_REACHED' }, { status: 429 });
    }

    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', churchId)
      .maybeSingle();

    const churchName = church?.name || 'your church';
    const message = `✅ ChurchSmart test — if you see this, WhatsApp is connected for ${churchName}.`;

    const result = await sendWamatasText({ to: testPhone, message, instanceId, accessToken });
    const now = new Date().toISOString();

    await logSend(supabase, {
      churchId,
      purpose: 'test',
      phone: formatted,
      message,
      status: result.ok ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId,
      errorMessage: result.error,
      raw: result.raw
    });

    if (!result.ok) {
      // Record the failure so Settings can show what went wrong; is_active is
      // deliberately left untouched.
      await supabase
        .from('whatsapp_config')
        .update({ last_test_sent_at: now, last_test_status: String(result.error || 'failed').slice(0, 200) })
        .eq('id', config.id);

      console.log(`${tag} failed church_id=${churchId}`);
      return Response.json({ success: false, error: result.error, code: 'SEND_FAILED' }, { status: 502 });
    }

    // A passing test both proves the credentials and activates the channel.
    const sentToday = configResult.sentToday + 1;
    await supabase
      .from('whatsapp_config')
      .update({ is_active: true, last_test_sent_at: now, last_test_status: 'success' })
      .eq('id', config.id);
    await recordSend(supabase, config.id, sentToday);

    console.log(`${tag} sent church_id=${churchId} sent_today=${sentToday}/${dailyLimit}`);

    return Response.json({
      success: true,
      providerMessageId: result.providerMessageId,
      phone: formatted,
      sentToday,
      dailyLimit
    });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ success: false, error: 'Failed to send test message', code: 'UNHANDLED' }, { status: 500 });
  }
}
