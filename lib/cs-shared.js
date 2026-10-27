"use client";
// ChurchSmart shared client utilities — extracted from app/page.js
import { createClient } from '@supabase/supabase-js';

// ==========================================
// SUPABASE CONFIG
// ==========================================
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
export const SUPABASE_ANON_KEY = SUPABASE_KEY;
// EDGE_FUNCTION_URL removed — Twilio is no longer used; WhatsApp goes through Wamatas server-side routes.
export const WHATSAPP_MAX_CHARS = 4096;
export const MOMO_TIMEOUT_MS = 180000;
export const MOMO_POLL_MS = 5000;
export const WHATSAPP_SETUP_GUIDE_URL = '/docs/ChurchSmart-WhatsApp-Setup-Guide.pdf';

function timeAgoShort(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function momoDeadline() {
  return Date.now() + MOMO_TIMEOUT_MS;
}
function momoExpired(deadline) {
  return Date.now() > deadline;
}

// Renders a saved access token as bullets plus its last 4 characters. Takes the
// tail only — the full token is never selected into the client, so there is
// nothing here to leak.
function maskTokenTail(last4) {
  if (!last4) return '';
  return `\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${last4}`;
}

// Guard for build time — Supabase client won't work during static generation
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ==========================================
// SECURITY UTILITIES
// ==========================================
const ALLOWED_TABLES = [
  'churches', 'church_users', 'church_locations', 'members', 'visitors',
  'attendance_records', 'donations', 'expenses', 'salvations', 'services',
  'events', 'groups', 'volunteers', 'activity_logs', 'message_logs',
  'message_templates', 'automation_settings', 'user_roles', 'user_role_assignments',
  'super_admin_log', 'subscriptions', 'payment_history', 'message_credits',
  'expense_categories', 'whatsapp_config', 'whatsapp_send_log',
  'admin_audit_log', 'mobile_payments'
];

function sanitizeInput(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val !== 'string') return String(val);
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      cleaned[key] = sanitizeObject(val);
    } else {
      cleaned[key] = sanitizeInput(val);
    }
  }
  return cleaned;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidTable(table) {
  return ALLOWED_TABLES.includes(table);
}

function isValidFilterValue(val) {
  if (typeof val !== 'string') return true;
  const dangerous = /[;'"\\]|--|\bor\b\s+\d|\band\b\s+\d|\bdrop\b|\bunion\b/i;
  return !dangerous.test(val);
}

// SUPABASE API HELPERS (using Supabase client)
// ==========================================

// getAuthHeaders removed — was only used by sendMessage (Twilio). WhatsApp
// messaging now goes through server-side API routes that use the service-role key.

// ==========================================
// QUERY CACHE (reduces duplicate API calls)
// ==========================================
const queryCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(table, options) {
  return `${table}:${JSON.stringify(options)}`;
}

function getCached(key) {
  const entry = queryCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  queryCache.delete(key);
  return null;
}

function setCache(key, data) {
  queryCache.set(key, { data, time: Date.now() });
  // Limit cache size
  if (queryCache.size > 100) {
    const oldest = queryCache.keys().next().value;
    queryCache.delete(oldest);
  }
}

function invalidateCache(table) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(table + ':')) queryCache.delete(key);
  }
}

async function supabaseQuery(table, options = {}) {
  if (!isValidTable(table)) { console.error('Invalid table:', table); return []; }
  
  // Check cache first
  const cacheKey = getCacheKey(table, options);
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  const { select = '*', filters = [], order, limit, single = false } = options;

  let query = supabase.from(table).select(select);

  for (const f of filters) {
    if (!isValidFilterValue(String(f.value))) { console.error('Suspicious filter blocked'); return []; }
    query = query.filter(f.column, f.operator, f.value);
  }

  if (order) {
    const [col, dir] = order.split('.');
    query = query.order(col, { ascending: dir !== 'desc' });
  }
  if (limit) query = query.limit(parseInt(limit, 10) || 50);

  const { data, error } = await query;
  if (error) { console.error(`Query ${table} failed:`, error.message); return single ? null : []; }
  const result = single ? (data?.[0] || null) : (data || []);
  
  // Cache the result
  setCache(cacheKey, result);
  return result;
}

async function supabaseInsert(table, data) {
  if (!isValidTable(table)) { console.error('Invalid table:', table); return null; }
  invalidateCache(table);
  const savedUser = localStorage.getItem('churchsmart_user');
  const churchId = savedUser ? JSON.parse(savedUser).church_id : null;
  const sanitized = sanitizeObject(data);
  const insertData = sanitized.church_id ? sanitized : { ...sanitized, church_id: churchId };

  const { data: result, error } = await supabase.from(table).insert(insertData).select();
  if (error) throw new Error(
    `Insert failed: ${error.message}` +
    (error.code ? ` [${error.code}]` : '') +
    (error.details ? ` | details: ${error.details}` : '') +
    (error.hint ? ` | hint: ${error.hint}` : '')
  );
  return result;
}

async function supabaseUpdate(table, id, data) {
  if (!isValidTable(table)) { console.error('Invalid table:', table); return null; }
  invalidateCache(table);
  const sanitized = sanitizeObject(data);

  const { data: result, error } = await supabase.from(table).update(sanitized).eq('id', id).select();
  if (error) throw new Error(
    `Update failed: ${error.message}` +
    (error.code ? ` [${error.code}]` : '') +
    (error.details ? ` | details: ${error.details}` : '') +
    (error.hint ? ` | hint: ${error.hint}` : '')
  );
  return result;
}

async function supabaseDelete(table, id) {
  if (!isValidTable(table)) { console.error('Invalid table:', table); return false; }
  invalidateCache(table);

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) { console.error(`Delete failed:`, error.message); return false; }
  return true;
}

// ==========================================
// ACTIVITY LOGGING
// ==========================================
// Fire-and-forget audit helper. Writes to activity_logs using the caller's
// church_id and user info pulled from localStorage — same convention as
// supabaseInsert above, no auth network round-trip at log time. The internal
// try/catch guarantees this never throws and never surfaces an error to the
// user, so audit logging cannot block or fail the primary save action.
//
// RLS on activity_logs requires INSERT.church_id to match the caller's church
// (or super_admin). The helper sets church_id explicitly because RLS rejection
// is silent at the Postgres-error layer — a missing church_id would drop the
// row with no exception thrown.
async function logActivity({ action, entity_type, entity_id, entity_name, details }) {
  try {
    const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('churchsmart_user') : null;
    const u = savedUser ? JSON.parse(savedUser) : null;
    const church_id = u?.church_id;
    if (!church_id) {
      console.warn('logActivity: no church_id in scope — skipping', { action });
      return;
    }
    const { error } = await supabase.from('activity_logs').insert({
      church_id,
      user_email: u?.email || null,
      user_name: u?.name || null,
      action,
      entity_type,
      entity_id: entity_id || null,
      entity_name: entity_name || null,
      details: details || null
    });
    if (error) {
      console.error('logActivity insert failed:', error.message, error.details || '');
    }
  } catch (err) {
    console.error('logActivity threw:', err?.message || err);
  }
}

// sendMessage (Twilio SMS via Edge Function) removed — WhatsApp messaging
// now goes through /api/whatsapp/send using the Wamatas provider.

// ==========================================
// PHOTO UPLOAD HELPER
// ==========================================
async function uploadPhoto(file, bucket = 'avatars') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    contentType: file.type,
    upsert: false
  });

  if (!error) {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  }
  console.error('Upload failed:', error.message);
  return null;
}


export { timeAgoShort, momoDeadline, momoExpired, maskTokenTail };
export { supabase };
export { ALLOWED_TABLES, sanitizeInput, sanitizeObject, isValidEmail, isValidTable, isValidFilterValue };
// getAuthHeaders removed (was Twilio-only)
export { queryCache, CACHE_TTL, getCacheKey, getCached, setCache, invalidateCache };
export { supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete };
export { logActivity };
// sendMessage removed (was Twilio-only)
export { uploadPhoto };

/** getSession with a 3-second timeout to prevent auth lock hangs. */
export async function safeGetSession() {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000))
  ]);
}
