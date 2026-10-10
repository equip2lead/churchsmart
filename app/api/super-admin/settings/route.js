// Platform settings: payment gateway credentials and live/sandbox modes.
//
// Secrets are write-only from the outside. GET never returns a secret's value —
// only its last 4 characters, taken from the generated `last4` column.
import crypto from 'crypto';
import {
  requireSuperAdmin,
  logAdminAction,
  PLATFORM_SETTING_KEYS
} from '../../../../lib/superAdmin';

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_payment_settings');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, is_secret, last4, updated_at');

  if (error) {
    console.error('[super-admin/settings] read failed:', error.message);
    return Response.json({ error: 'Failed to read settings', code: 'READ_FAILED' }, { status: 500 });
  }

  // Non-secret values (the mode switches) are safe to return in full; they are
  // fetched in a second pass so a secret's value is never even selected here.
  const nonSecretKeys = Object.entries(PLATFORM_SETTING_KEYS)
    .filter(([, meta]) => !meta.secret)
    .map(([key]) => key);

  let modes = {};
  if (nonSecretKeys.length > 0) {
    const { data: plain } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', nonSecretKeys);
    modes = Object.fromEntries((plain || []).map(r => [r.key, r.value]));
  }

  const settings = (data || []).map(row => ({
    key: row.key,
    is_secret: !!row.is_secret,
    last4: row.is_secret ? (row.last4 || null) : null,
    value: row.is_secret ? undefined : (modes[row.key] ?? null),
    configured: true,
    updated_at: row.updated_at
  }));

  return Response.json({ settings });
}

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const gate = await requireSuperAdmin(request, 'edit_payment_settings');
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const body = await request.json().catch(() => ({}));
  const entries = Array.isArray(body?.settings) ? body.settings : [body];

  const written = [];
  for (const entry of entries) {
    const key = String(entry?.key || '').trim();
    const value = entry?.value;

    const meta = PLATFORM_SETTING_KEYS[key];
    if (!meta) {
      return Response.json({ error: `Unknown setting: ${key}`, code: 'UNKNOWN_KEY' }, { status: 400 });
    }
    // An empty value would wipe a working credential; use a delete for that.
    if (typeof value !== 'string' || !value.trim()) {
      return Response.json({ error: `A value is required for ${key}`, code: 'EMPTY_VALUE' }, { status: 400 });
    }
    if (!meta.secret && !['live', 'sandbox'].includes(value)) {
      return Response.json({ error: `${key} must be 'live' or 'sandbox'`, code: 'INVALID_MODE' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert(
        { key, value: value.trim(), is_secret: meta.secret, updated_at: new Date().toISOString(), updated_by: authUser.id },
        { onConflict: 'key' }
      )
      .select('key, is_secret, last4, updated_at')
      .maybeSingle();

    if (error) {
      console.error(`[super-admin/settings ${reqId}] write failed for ${key}:`, error.message);
      return Response.json({ error: `Failed to save ${key}`, code: 'WRITE_FAILED' }, { status: 500 });
    }

    written.push({
      key: data.key,
      is_secret: !!data.is_secret,
      // Confirmation carries last4 only, never the value just submitted.
      last4: data.is_secret ? (data.last4 || null) : null,
      updated_at: data.updated_at
    });
  }

  await logAdminAction(supabase, {
    authUser, admin, request,
    action: 'settings_updated',
    // Keys only. Recording any part of a secret in the audit trail would
    // defeat the point of keeping it out of responses.
    details: { keys: written.map(w => w.key) }
  });

  return Response.json({ saved: written });
}
