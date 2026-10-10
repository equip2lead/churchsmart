// ==========================================
// WHATSAPP CLOUD API HELPERS
// ==========================================
// All WhatsApp traffic goes through ONE central WhatsApp Business account
// owned by the platform. Churches never supply API tokens or create Meta
// developer accounts: they enter their own WhatsApp number (stored on
// whatsapp_config.phone_number for display/contact only) and flip a switch.
//
// Because of that, whatsapp_config.api_token / phone_number_id /
// business_account_id / verify_token are intentionally unused — the real
// credentials live in env vars and are read here, server-side only.

import { createClient } from '@supabase/supabase-js';

const GRAPH_VERSION = 'v21.0';
const DEFAULT_COUNTRY_CODE = '237'; // Cameroon

// WhatsApp text messages cap at 4096 characters.
export const WHATSAPP_MAX_LENGTH = 4096;

/**
 * Platform credentials for the central WhatsApp Business account.
 * Returns null when either is unset so callers can fail with a clear error
 * instead of firing a request that Graph would reject.
 */
export function getPlatformCredentials() {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/**
 * Normalize a locally-written number to international format.
 *
 *   "06 71 23 45 67"  -> "+237671234567"   (leading 0 is the local trunk prefix)
 *   "(677) 123-456"   -> "+237677123456"
 *   "+237677123456"   -> "+237677123456"   (already international, untouched)
 *   "00237677123456"  -> "+237677123456"   (00 is the international prefix)
 *
 * Returns null when nothing usable is left, so callers can report the
 * recipient as failed rather than calling Graph with junk.
 */
export function formatPhone(raw, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  if (!raw) return null;

  // Strip spaces, dashes, parentheses, dots and non-breaking spaces.
  let cleaned = String(raw).replace(/[\s ().\-]/g, '');
  if (!cleaned) return null;

  const hadPlus = cleaned.startsWith('+');
  // Drop everything that isn't a digit (including a leading '+').
  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;

  if (!hadPlus) {
    if (digits.startsWith('00')) {
      // 00 is the international access prefix; the country code follows.
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      // Local trunk prefix: drop it and prepend the country code.
      digits = defaultCountryCode + digits.slice(1);
    } else if (!digits.startsWith(defaultCountryCode)) {
      digits = defaultCountryCode + digits;
    }
  }

  // Shortest possible E.164 subscriber number is 8 digits incl. country code.
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Send one text message through the central account.
 * Resolves to { success, phone, error?, messageId? } and never throws, so one
 * bad recipient cannot abort a whole batch.
 */
export async function sendWhatsAppText({ token, phoneNumberId, to, message }) {
  // Graph wants the number in international format without the leading '+'.
  const graphTo = to.replace(/^\+/, '');
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: graphTo,
        type: 'text',
        text: { body: message }
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.error?.message || `HTTP ${response.status}`;
      return { success: false, phone: to, error: detail };
    }
    return { success: true, phone: to, messageId: payload?.messages?.[0]?.id || null };
  } catch (error) {
    return { success: false, phone: to, error: error.message || 'Network error' };
  }
}

/** Today's date as YYYY-MM-DD, matching the `date` column type. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load a church's WhatsApp config and report how much of today's quota is left.
 *
 * The daily counter is also rolled over here when last_reset_date is stale.
 * The reset-daily cron normally does that, but doing it on read too means a
 * missed or failed cron run can't hand a church a permanently exhausted quota
 * (or, worse, let yesterday's count keep blocking today's sends).
 */
export async function loadWhatsAppConfig(supabase, churchId) {
  const { data: config, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('church_id', churchId)
    .maybeSingle();

  if (error) return { error: `Failed to read WhatsApp config: ${error.message}` };
  if (!config) return { error: 'WhatsApp is not set up for this church', code: 'NOT_CONFIGURED' };
  if (!config.is_active) return { error: 'WhatsApp is not activated for this church', code: 'NOT_ACTIVE' };

  const today = todayISO();
  let sentToday = config.messages_sent_today || 0;

  if (config.last_reset_date !== today) {
    const { error: resetError } = await supabase
      .from('whatsapp_config')
      .update({ messages_sent_today: 0, last_reset_date: today })
      .eq('id', config.id);
    if (!resetError) sentToday = 0;
  }

  const dailyLimit = config.daily_limit || 0;
  return { config, sentToday, dailyLimit, remaining: Math.max(0, dailyLimit - sentToday) };
}

/**
 * Persist the running daily count. Called after each successful send so a
 * function timeout mid-batch cannot leave messages sent but uncounted, which
 * would let a church quietly overshoot its daily limit.
 */
export async function recordSend(supabase, configId, newCount) {
  const { error } = await supabase
    .from('whatsapp_config')
    .update({ messages_sent_today: newCount, last_reset_date: todayISO() })
    .eq('id', configId);
  if (error) console.error('[whatsapp] failed to record send count:', error.message);
}

/**
 * Service-role Supabase client for the WhatsApp routes.
 *
 * Returns null instead of letting createClient throw when the env is
 * incomplete, so a misconfigured deployment answers with a clear
 * "not configured" status rather than an opaque 500.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}
