// ==========================================
// PLATFORM ADMIN ROLES, PERMISSIONS, HELPERS
// ==========================================
// Safe to import from the client: nothing is read from the environment at
// module scope, and no function that touches a secret is called during render.
import { createClient } from '@supabase/supabase-js';

// Platform owners. Mirrored by is_platform_admin() in SQL, which is what RLS
// enforces — keep the two lists in step.
export const SUPER_ADMIN_EMAILS = ['zoezina@gmail.com', 'denis_ekobena@rfis.org'];

export const ADMIN_ROLES = ['super_admin', 'support', 'finance', 'viewer'];

// The permission matrix from the brief, verbatim.
const ROLE_PERMISSIONS = {
  super_admin: {
    view_stats: true,
    view_churches: true,
    change_plans: true,
    suspend_churches: true,
    view_payment_settings: true,
    edit_payment_settings: true,
    send_communications: true,
    view_activity_log: true,
    manage_sub_admins: true
  },
  support: {
    view_stats: true,
    view_churches: true,
    change_plans: false,
    suspend_churches: false,
    view_payment_settings: false,
    edit_payment_settings: false,
    send_communications: true,
    view_activity_log: true,
    manage_sub_admins: false
  },
  finance: {
    view_stats: true,
    view_churches: true,
    change_plans: false,
    suspend_churches: false,
    view_payment_settings: true,   // read-only; edit_payment_settings is false
    edit_payment_settings: false,
    send_communications: false,
    view_activity_log: true,
    manage_sub_admins: false
  },
  viewer: {
    view_stats: true,
    view_churches: true,
    change_plans: false,
    suspend_churches: false,
    view_payment_settings: false,
    edit_payment_settings: false,
    send_communications: false,
    view_activity_log: true,
    manage_sub_admins: false
  }
};

/** All permissions for a role, or an all-false map for an unknown role. */
export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || Object.fromEntries(
    Object.keys(ROLE_PERMISSIONS.super_admin).map(k => [k, false])
  );
}

export function hasPermission(role, permission) {
  return !!permissionsFor(role)[permission];
}

export function isHardcodedSuperAdmin(email) {
  return SUPER_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

/** Human label for the role badge. */
export function roleLabel(role) {
  const labels = {
    super_admin: 'Super Admin',
    support: 'Support',
    finance: 'Finance',
    viewer: 'Viewer'
  };
  return labels[role] || 'No access';
}

// ── PawaPay ──
export const PAWAPAY_BASE_URLS = {
  sandbox: 'https://api.sandbox.pawapay.io',
  live: 'https://api.pawapay.io'
};

export function pawapayBaseUrl(mode) {
  return mode === 'live' ? PAWAPAY_BASE_URLS.live : PAWAPAY_BASE_URLS.sandbox;
}

// Keys held in platform_settings. `secret` ones are never returned to a client.
export const PLATFORM_SETTING_KEYS = {
  stripe_pk: { secret: true },
  stripe_sk: { secret: true },
  stripe_webhook_secret: { secret: true },
  stripe_mode: { secret: false },
  pawapay_token: { secret: true },
  pawapay_mode: { secret: false }
};

// ──────────────────────────────────────────
// SERVER-ONLY HELPERS
// ──────────────────────────────────────────

/** Service-role client, or null when the environment is incomplete. */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Resolve the caller's platform role.
 *
 * A hardcoded owner email always wins. Otherwise the sub_admins roster decides,
 * and only an active row that has actually accepted its invitation counts — a
 * pending invite must not already grant access.
 *
 * @returns {{ role: string, permissions: object, email: string, subAdminId: string|null }|null}
 */
export async function getSuperAdminRole(supabase, authUser) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  if (!email) return null;

  if (isHardcodedSuperAdmin(email)) {
    return { role: 'super_admin', permissions: permissionsFor('super_admin'), email, subAdminId: null };
  }

  const { data: row, error } = await supabase
    .from('sub_admins')
    .select('id, role, is_active, accepted_at')
    .ilike('email', email)
    .maybeSingle();

  if (error || !row) return null;
  if (!row.is_active || !row.accepted_at) return null;
  if (!ADMIN_ROLES.includes(row.role)) return null;

  return { role: row.role, permissions: permissionsFor(row.role), email, subAdminId: row.id };
}

/**
 * Gate a /api/super-admin/* route.
 *
 * Resolves to either { supabase, authUser, admin } or { response } carrying the
 * error to return. Every route uses this so the access rules live in one place.
 */
export async function requireSuperAdmin(request, permission) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { response: Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 }) };
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return { response: Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 }) };
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return { response: Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 }) };
  }

  const admin = await getSuperAdminRole(supabase, authUser);
  if (!admin) {
    return { response: Response.json({ error: 'Not a platform administrator', code: 'NOT_ADMIN' }, { status: 403 }) };
  }
  if (permission && !hasPermission(admin.role, permission)) {
    return {
      response: Response.json(
        { error: `Your role (${roleLabel(admin.role)}) cannot perform this action`, code: 'INSUFFICIENT_ROLE', role: admin.role },
        { status: 403 }
      )
    };
  }

  return { supabase, authUser, admin };
}

/** Best-effort client IP, for the audit trail. */
export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || null;
}

/**
 * Append to admin_audit_log. Never throws: an audit write must not be able to
 * fail the action it is recording.
 */
export async function logAdminAction(supabase, { authUser, admin, action, details = null, request = null }) {
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      admin_id: authUser?.id || null,
      admin_email: admin?.email || authUser?.email || 'unknown',
      action,
      details,
      ip_address: request ? clientIp(request) : null
    });
    if (error) console.error('[super-admin] audit write failed:', error.message);
  } catch (err) {
    console.error('[super-admin] audit write threw:', err?.message || err);
  }
}

/**
 * Read a platform setting, falling back to an environment variable.
 *
 * The env fallback matters: Stripe already runs on env vars, so a freshly
 * created platform_settings row must not be required for anything to work.
 */
export async function getPlatformSetting(supabase, key, envFallback = null) {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (!error && data?.value) return data.value;
  return envFallback ? (process.env[envFallback] || null) : null;
}

// ──────────────────────────────────────────
// SUB-ADMIN INVITATION TOKENS
// ──────────────────────────────────────────
// The invite link carries `<id>.<hmac>` rather than a bare row id, so a link
// cannot be forged by guessing a uuid. An HMAC is enough here: the token only
// binds an already-created row to whoever opens it, and the row is checked for
// is_active and a null accepted_at before anything is granted.

function inviteSecret() {
  return process.env.SUPER_ADMIN_INVITE_SECRET
    || process.env.CRON_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || null;
}

export async function createInviteToken(subAdminId) {
  const secret = inviteSecret();
  if (!secret) return null;
  const { createHmac } = await import('crypto');
  const sig = createHmac('sha256', secret).update(String(subAdminId)).digest('hex').slice(0, 32);
  return `${subAdminId}.${sig}`;
}

/** Returns the sub_admin id when the signature checks out, else null. */
export async function verifyInviteToken(token) {
  const secret = inviteSecret();
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;

  const idx = token.lastIndexOf('.');
  const id = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!id || !sig) return null;

  const { createHmac, timingSafeEqual } = await import('crypto');
  const expected = createHmac('sha256', secret).update(id).digest('hex').slice(0, 32);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? id : null;
  } catch {
    return null;
  }
}
