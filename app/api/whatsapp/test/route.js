// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
//
// Sends a single confirmation message so an admin can verify their WhatsApp
// setup works before messaging the congregation.
import crypto from 'crypto';
import {
  getServiceClient,
  getPlatformCredentials,
  formatPhone,
  sendWhatsAppText,
  loadWhatsAppConfig,
  recordSend
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

    const credentials = getPlatformCredentials();
    if (!credentials) {
      console.error(`${tag} missing_platform_credentials`);
      return Response.json(
        { success: false, error: 'WhatsApp is not configured on the server', code: 'PLATFORM_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const formatted = formatPhone(testPhone);
    if (!formatted) {
      return Response.json({ success: false, error: 'Invalid phone number', code: 'INVALID_PHONE' }, { status: 400 });
    }

    const configResult = await loadWhatsAppConfig(supabase, churchId);
    if (configResult.error) {
      return Response.json({ success: false, error: configResult.error, code: configResult.code || 'CONFIG_ERROR' }, { status: 403 });
    }
    if (configResult.remaining <= 0) {
      return Response.json({ success: false, error: 'Daily message limit reached', code: 'DAILY_LIMIT_REACHED' }, { status: 429 });
    }

    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', churchId)
      .maybeSingle();

    const churchName = church?.name || 'your church';
    const message = `✅ This is a test from ChurchSmart for ${churchName}. WhatsApp messaging is active!`;

    const result = await sendWhatsAppText({
      token: credentials.token,
      phoneNumberId: credentials.phoneNumberId,
      to: formatted,
      message
    });

    if (!result.success) {
      console.log(`${tag} failed church_id=${churchId} error=${result.error}`);
      return Response.json({ success: false, error: result.error, code: 'SEND_FAILED' }, { status: 502 });
    }

    // A test message is a real message against the central account, so it
    // counts toward the church's daily quota like any other.
    const sentToday = configResult.sentToday + 1;
    await recordSend(supabase, configResult.config.id, sentToday);

    console.log(`${tag} sent church_id=${churchId} sent_today=${sentToday}/${configResult.dailyLimit}`);

    return Response.json({
      success: true,
      phone: formatted,
      sentToday,
      dailyLimit: configResult.dailyLimit
    });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ success: false, error: 'Failed to send test message', code: 'UNHANDLED' }, { status: 500 });
  }
}
