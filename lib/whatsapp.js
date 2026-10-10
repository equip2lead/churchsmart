// ==========================================
// WHATSAPP (WAMATAS) HELPERS
// ==========================================
// Each church connects its own Wamatas sender. Credentials live per-church on
// whatsapp_config: api_token holds the access token and phone_number_id is
// repurposed to hold the Wamatas instance id.
//
// These helpers are server-only. They are never imported into the client
// bundle, so an access token cannot reach the browser.
import { createClient } from '@supabase/supabase-js';

const WAMATAS_BASE = 'https://wamatas.com/api';
const DEFAULT_COUNTRY_CODE = '237'; // Cameroon

// WhatsApp text messages cap at 4096 characters.
export const WHATSAPP_MAX_LENGTH = 4096;

// Wamatas rejects bursts, so bulk sends are spaced out.
export const SEND_SPACING_MS = 200;

/** Pause between bulk sends. */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize a number to the full international format Wamatas expects:
 * country code first, no leading 0, no spaces, no '+'.
 *
 *   "+237 677 12 34 56" -> "237677123456"
 *   "0677123456"        -> "237677123456"  (0 is the local trunk prefix)
 *   "00237677123456"    -> "237677123456"  (00 is the international prefix)
 *   "14155550123"       -> "14155550123"   (already international, untouched)
 *
 * Returns null when nothing usable is left so the caller can mark that one
 * recipient failed instead of posting junk to the provider.
 */
export function toWamatasNumber(phone, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  if (!phone) return null;

  let n = String(phone).replace(/[\s \-().]/g, '');
  if (!n) return null;

  const hadPlus = n.startsWith('+');
  if (hadPlus) n = n.slice(1);

  // Anything left that is not a digit (stray letters, a second '+') is junk.
  if (!/^\d+$/.test(n)) return null;

  if (!hadPlus) {
    if (n.startsWith('00')) {
      n = n.slice(2);
    } else if (n.startsWith('0')) {
      n = defaultCountryCode + n.slice(1);
    }
    // A number with no 0 and no '+' is assumed already international (a US
    // 1415..., a South African 27...), matching the brief's examples.
  }

  // Shortest/longest plausible E.164 subscriber numbers.
  if (n.length < 8 || n.length > 15) return null;
  return n;
}

/** Last 4 characters of a secret, for display. Never returns the secret. */
export function maskToken(token) {
  if (!token) return '';
  const tail = String(token).slice(-4);
  return `••••••••${tail}`;
}

/**
 * Send one text message through a church's Wamatas instance.
 *
 * Never throws and never echoes the access token, so one bad recipient cannot
 * abort a batch and a provider error cannot leak credentials into a log.
 * `raw` is returned only on failure, which is the only case the caller stores.
 */
export async function sendWamatasText({ to, message, instanceId, accessToken }) {
  const number = toWamatasNumber(to);
  if (!number) {
    return { ok: false, error: 'Invalid phone number', raw: { number: to } };
  }

  try {
    const res = await fetch(`${WAMATAS_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        type: 'text',
        message,
        instance_id: instanceId,
        access_token: accessToken
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.error || data.status === 'error') {
      return {
        ok: false,
        number,
        error: data?.message || data?.error || `HTTP ${res.status}`,
        raw: sanitizeProviderPayload(data)
      };
    }

    // Wamatas has returned the message id under a few different keys.
    const providerMessageId =
      data.id || data.message_id || data.messageId || data.data?.id || '';

    return { ok: true, number, providerMessageId: String(providerMessageId || '') };
  } catch (error) {
    return { ok: false, number, error: error.message || 'Network error', raw: null };
  }
}

/** Ask Wamatas whether a number is registered on WhatsApp. */
export async function checkWamatasPhone({ phone, instanceId, accessToken }) {
  const number = toWamatasNumber(phone);
  if (!number) return { isOnWhatsApp: false, error: 'Invalid phone number' };

  try {
    const res = await fetch(`${WAMATAS_BASE}/check_phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        instance_id: instanceId,
        access_token: accessToken
      })
    });
    const data = await res.json().catch(() => null);
    return { isOnWhatsApp: !!data?.exists || !!data?.result, number };
  } catch (error) {
    return { isOnWhatsApp: false, error: error.message || 'Network error' };
  }
}

/**
 * Strip anything credential-shaped out of a provider payload before it is
 * persisted to whatsapp_send_log.raw_response. Wamatas echoes the request on
 * some errors, which would otherwise write the access token into the database.
 */
function sanitizeProviderPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload ?? null;
  const SECRET_KEYS = ['access_token', 'accessToken', 'token', 'api_token', 'apiToken'];
  const clone = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (SECRET_KEYS.includes(key)) continue;
    clone[key] = (value && typeof value === 'object') ? sanitizeProviderPayload(value) : value;
  }
  return clone;
}

/** Today's date as YYYY-MM-DD, matching the `date` column type. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Service-role Supabase client for the WhatsApp routes.
 *
 * Returns null rather than letting createClient throw when the env is
 * incomplete, so a misconfigured deployment answers with a clear
 * "not configured" status instead of an opaque 500.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Load a church's Wamatas credentials and remaining daily quota.
 *
 * `requireActive: false` lets the test route run against saved credentials
 * before the church has ever been activated — the first successful test is
 * what flips is_active on.
 *
 * The daily counter is also rolled over here when last_reset_date is stale:
 * the reset-daily cron normally does that, but doing it on read means a missed
 * run cannot leave a church with a permanently exhausted quota.
 */
export async function loadWhatsAppConfig(supabase, churchId, { requireActive = true } = {}) {
  const { data: config, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('church_id', churchId)
    .maybeSingle();

  if (error) return { error: `Failed to read WhatsApp config: ${error.message}` };
  if (!config) return { error: 'WhatsApp is not set up for this church', code: 'NOT_CONFIGURED' };
  if (!config.api_token || !config.phone_number_id) {
    return { error: 'WhatsApp credentials are missing', code: 'NO_CREDENTIALS' };
  }
  if (requireActive && !config.is_active) {
    return { error: 'WhatsApp is not activated for this church', code: 'NOT_ACTIVE' };
  }

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
  return {
    config,
    instanceId: config.phone_number_id,
    accessToken: config.api_token,
    sentToday,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - sentToday)
  };
}

/**
 * Persist the running daily count. Written after each successful send so a
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
 * Append one attempt to whatsapp_send_log.
 * Per the brief, raw_response is stored on failures only.
 */
export async function logSend(supabase, {
  churchId, recipientId = null, purpose, phone, message,
  status, providerMessageId = null, errorMessage = null, raw = null
}) {
  const { error } = await supabase.from('whatsapp_send_log').insert({
    church_id: churchId,
    recipient_id: recipientId,
    purpose,
    phone,
    message_preview: (message || '').slice(0, 100),
    provider: 'wamatas',
    provider_message_id: status === 'sent' ? (providerMessageId || null) : null,
    status,
    error_message: status === 'failed' ? errorMessage : null,
    raw_response: status === 'failed' ? (raw ?? null) : null
  });
  if (error) console.error('[whatsapp] failed to write send log:', error.message);
}
