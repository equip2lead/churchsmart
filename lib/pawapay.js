// ==========================================
// PAWAPAY MOBILE MONEY
// ==========================================
// Server-only. Credentials come from platform_settings, falling back to the
// environment, so the Super Admin panel can rotate them without a deploy.
import { getPlatformSetting, pawapayBaseUrl } from './superAdmin';

// ──────────────────────────────────────────
// COUNTRY / CORRESPONDENT CONFIG
// ──────────────────────────────────────────
// Adding a country or operator means adding one entry here and nothing else:
// the deposit route, the provider auto-detection and the checkout UI all read
// this object.
//
//   iso3        PawaPay's country code (also the correspondent suffix)
//   currency    the only currency PawaPay accepts for that country
//   usdRate     local units per USD, used to price a plan locally
//   dial        international dialling prefix, for MSISDN normalisation
//   operators   { correspondent, name, prefixes }
//
// `prefixes` are the local subscriber prefixes (after the trunk 0) used to
// guess the operator from a number; the payer can always override the guess.
//
// IMPORTANT: correspondent codes and usdRate values must be confirmed against
// your own PawaPay configuration before taking live payments. GET
// /api/pawapay/active-conf returns the correspondents your account actually has
// enabled. XAF and XOF are pegged to EUR, so those two rates are exact; the
// rest are reference values that need setting to your commercial rate.
export const PAWAPAY_COUNTRIES = {
  CMR: {
    name: 'Cameroon', currency: 'XAF', usdRate: 600, dial: '237',
    operators: [
      { correspondent: 'MTN_MOMO_CMR', name: 'MTN MoMo', prefixes: ['65', '67', '68', '650', '651', '652', '653', '654'] },
      { correspondent: 'ORANGE_CMR', name: 'Orange Money', prefixes: ['69', '655', '656', '657', '658', '659'] }
    ]
  },
  CIV: {
    name: "Côte d'Ivoire", currency: 'XOF', usdRate: 600, dial: '225',
    operators: [
      { correspondent: 'MTN_MOMO_CIV', name: 'MTN MoMo', prefixes: ['05'] },
      { correspondent: 'ORANGE_CIV', name: 'Orange Money', prefixes: ['07'] },
      { correspondent: 'MOOV_CIV', name: 'Moov Money', prefixes: ['01'] }
    ]
  },
  GHA: {
    name: 'Ghana', currency: 'GHS', usdRate: 15, dial: '233',
    operators: [
      { correspondent: 'MTN_MOMO_GHA', name: 'MTN MoMo', prefixes: ['24', '54', '55', '59'] },
      { correspondent: 'VODAFONE_GHA', name: 'Telecel Cash', prefixes: ['20', '50'] },
      { correspondent: 'AIRTELTIGO_GHA', name: 'AirtelTigo Money', prefixes: ['26', '56', '27', '57'] }
    ]
  },
  KEN: {
    name: 'Kenya', currency: 'KES', usdRate: 130, dial: '254',
    operators: [
      { correspondent: 'MPESA_KEN', name: 'M-Pesa', prefixes: ['70', '71', '72', '74', '79'] },
      { correspondent: 'AIRTEL_OAPI_KEN', name: 'Airtel Money', prefixes: ['73', '78'] }
    ]
  },
  UGA: {
    name: 'Uganda', currency: 'UGX', usdRate: 3800, dial: '256',
    operators: [
      { correspondent: 'MTN_MOMO_UGA', name: 'MTN MoMo', prefixes: ['77', '78', '76'] },
      { correspondent: 'AIRTEL_OAPI_UGA', name: 'Airtel Money', prefixes: ['70', '75', '74'] }
    ]
  },
  TZA: {
    name: 'Tanzania', currency: 'TZS', usdRate: 2600, dial: '255',
    operators: [
      { correspondent: 'VODACOM_TZA', name: 'M-Pesa', prefixes: ['74', '75', '76'] },
      { correspondent: 'AIRTEL_OAPI_TZA', name: 'Airtel Money', prefixes: ['68', '69', '78'] },
      { correspondent: 'TIGO_TZA', name: 'Mixx by Yas', prefixes: ['71', '65', '67'] },
      { correspondent: 'HALOTEL_TZA', name: 'Halopesa', prefixes: ['62', '61'] }
    ]
  },
  ZMB: {
    name: 'Zambia', currency: 'ZMW', usdRate: 26, dial: '260',
    operators: [
      { correspondent: 'MTN_MOMO_ZMB', name: 'MTN MoMo', prefixes: ['96', '76'] },
      { correspondent: 'AIRTEL_OAPI_ZMB', name: 'Airtel Money', prefixes: ['97', '77'] },
      { correspondent: 'ZAMTEL_ZMB', name: 'Zamtel Kwacha', prefixes: ['95', '75'] }
    ]
  },
  RWA: {
    name: 'Rwanda', currency: 'RWF', usdRate: 1300, dial: '250',
    operators: [
      { correspondent: 'MTN_MOMO_RWA', name: 'MTN MoMo', prefixes: ['78', '79'] },
      { correspondent: 'AIRTEL_RWA', name: 'Airtel Money', prefixes: ['72', '73'] }
    ]
  },
  SEN: {
    name: 'Senegal', currency: 'XOF', usdRate: 600, dial: '221',
    operators: [
      { correspondent: 'ORANGE_SEN', name: 'Orange Money', prefixes: ['77', '78'] },
      { correspondent: 'FREE_SEN', name: 'Free Money', prefixes: ['76'] },
      { correspondent: 'EXPRESSO_SEN', name: 'E-Money', prefixes: ['70'] }
    ]
  },
  NGA: {
    name: 'Nigeria', currency: 'NGN', usdRate: 1550, dial: '234',
    operators: [
      { correspondent: 'MTN_MOMO_NGA', name: 'MTN MoMo', prefixes: ['803', '806', '813', '816', '810', '814', '903', '906'] },
      { correspondent: 'AIRTEL_NGA', name: 'Airtel Money', prefixes: ['802', '808', '812', '701', '902', '907'] }
    ]
  },
  COD: {
    name: 'DR Congo', currency: 'CDF', usdRate: 2800, dial: '243',
    operators: [
      { correspondent: 'VODACOM_MPESA_COD', name: 'M-Pesa', prefixes: ['81', '82', '83'] },
      { correspondent: 'AIRTEL_COD', name: 'Airtel Money', prefixes: ['99', '97'] },
      { correspondent: 'ORANGE_COD', name: 'Orange Money', prefixes: ['84', '85', '89'] }
    ]
  },
  BEN: {
    name: 'Benin', currency: 'XOF', usdRate: 600, dial: '229',
    operators: [
      { correspondent: 'MTN_MOMO_BEN', name: 'MTN MoMo', prefixes: ['96', '66', '69'] },
      { correspondent: 'MOOV_BEN', name: 'Moov Money', prefixes: ['94', '95', '64', '65'] }
    ]
  },
  BFA: {
    name: 'Burkina Faso', currency: 'XOF', usdRate: 600, dial: '226',
    operators: [
      { correspondent: 'ORANGE_BFA', name: 'Orange Money', prefixes: ['54', '55', '56', '57', '74', '75', '76'] },
      { correspondent: 'MOOV_BFA', name: 'Moov Money', prefixes: ['60', '61', '62', '63', '66', '67'] }
    ]
  },
  MWI: {
    name: 'Malawi', currency: 'MWK', usdRate: 1750, dial: '265',
    operators: [
      { correspondent: 'AIRTEL_MWI', name: 'Airtel Money', prefixes: ['99', '88'] },
      { correspondent: 'TNM_MWI', name: 'Mpamba', prefixes: ['88', '77'] }
    ]
  },
  MOZ: {
    name: 'Mozambique', currency: 'MZN', usdRate: 64, dial: '258',
    operators: [
      { correspondent: 'VODACOM_MOZ', name: 'M-Pesa', prefixes: ['84', '85'] },
      { correspondent: 'MOVITEL_MOZ', name: 'e-Mola', prefixes: ['86', '87'] }
    ]
  }
};

/** Country list for a dropdown, alphabetical by display name. */
export function listCountries() {
  return Object.entries(PAWAPAY_COUNTRIES)
    .map(([iso3, c]) => ({ iso3, name: c.name, currency: c.currency, dial: c.dial, operators: c.operators }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalise a number to the MSISDN PawaPay expects: country code first, no
 * '+', no leading 0, digits only.
 */
export function toMsisdn(phone, iso3) {
  const country = PAWAPAY_COUNTRIES[iso3];
  if (!country || !phone) return null;

  let digits = String(phone).replace(/[^\d+]/g, '');
  const hadPlus = digits.startsWith('+');
  digits = digits.replace(/\D/g, '');
  if (!digits) return null;

  if (hadPlus || digits.startsWith('00')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = country.dial + digits.slice(1);
  } else if (!digits.startsWith(country.dial)) {
    digits = country.dial + digits;
  }

  // Must belong to the country that was selected.
  if (!digits.startsWith(country.dial)) return null;
  const local = digits.slice(country.dial.length);
  if (local.length < 6 || local.length > 12) return null;
  return digits;
}

/** The local part of a number, i.e. what follows the dialling code. */
export function localPart(phone, iso3) {
  const msisdn = toMsisdn(phone, iso3);
  if (!msisdn) return null;
  return msisdn.slice(PAWAPAY_COUNTRIES[iso3].dial.length);
}

/**
 * Guess the operator from the number. Longest prefix wins, so a 3-digit rule
 * beats an overlapping 2-digit one. Returns null when nothing matches, in
 * which case the payer picks from the list.
 */
export function detectOperator(phone, iso3) {
  const country = PAWAPAY_COUNTRIES[iso3];
  const local = localPart(phone, iso3);
  if (!country || !local) return null;

  let best = null;
  for (const operator of country.operators) {
    for (const prefix of operator.prefixes) {
      // A stored prefix may include the trunk 0; compare without it.
      const bare = prefix.replace(/^0+/, '');
      if (local.startsWith(bare) && (!best || bare.length > best.length)) {
        best = { ...operator, length: bare.length };
      }
    }
  }
  return best ? { correspondent: best.correspondent, name: best.name } : null;
}

export function findOperator(iso3, correspondent) {
  return (PAWAPAY_COUNTRIES[iso3]?.operators || []).find(o => o.correspondent === correspondent) || null;
}

/**
 * Price a plan in a country's currency.
 *
 * Zero-decimal currencies (XAF, XOF, RWF, UGX) are rounded to whole units;
 * the rest keep two decimals, which is what PawaPay expects.
 */
const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'RWF', 'UGX', 'MWK']);

export function localAmount(usdAmount, iso3) {
  const country = PAWAPAY_COUNTRIES[iso3];
  if (!country) return null;
  const raw = Number(usdAmount) * country.usdRate;
  if (ZERO_DECIMAL.has(country.currency)) {
    // Rounded up to a whole unit so the charge is never short of the plan price.
    return { amount: String(Math.ceil(raw)), currency: country.currency };
  }
  return { amount: (Math.ceil(raw * 100) / 100).toFixed(2), currency: country.currency };
}

// ──────────────────────────────────────────
// API
// ──────────────────────────────────────────

/** Token and base URL, from platform_settings with an env fallback. */
export async function getPawapayConfig(supabase) {
  const token = await getPlatformSetting(supabase, 'pawapay_token', 'PAWAPAY_API_TOKEN');
  const mode = (await getPlatformSetting(supabase, 'pawapay_mode')) || process.env.PAWAPAY_MODE || 'sandbox';
  return { token, mode, baseUrl: pawapayBaseUrl(mode) };
}

/** Strip anything credential-shaped before a payload is persisted. */
export function sanitizePawapayPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload ?? null;
  const SECRETS = ['access_token', 'accessToken', 'token', 'authorization', 'Authorization', 'apiKey', 'api_key'];
  const clone = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (SECRETS.includes(key)) continue;
    clone[key] = (value && typeof value === 'object') ? sanitizePawapayPayload(value) : value;
  }
  return clone;
}

/** Create a deposit. Never throws; the caller decides what to persist. */
export async function createDeposit({ token, baseUrl, depositId, amount, currency, correspondent, msisdn, statementDescription, metadata }) {
  try {
    const res = await fetch(`${baseUrl}/deposits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositId,
        amount: String(amount),
        currency,
        correspondent,
        payer: { type: 'MSISDN', address: { value: msisdn } },
        // PawaPay caps this at 22 characters and rejects punctuation.
        statementDescription: String(statementDescription || 'ChurchSmart').slice(0, 22),
        customerTimestamp: new Date().toISOString(),
        ...(metadata ? { metadata } : {})
      })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: payload?.errorMessage || payload?.message || `HTTP ${res.status}`, raw: sanitizePawapayPayload(payload) };
    }
    // ACCEPTED means the prompt is on its way; the callback decides the outcome.
    const status = payload?.status || 'ACCEPTED';
    if (status === 'REJECTED' || status === 'DUPLICATE_IGNORED') {
      return { ok: false, error: payload?.rejectionReason?.rejectionMessage || status, raw: sanitizePawapayPayload(payload) };
    }
    return { ok: true, status, raw: sanitizePawapayPayload(payload) };
  } catch (error) {
    return { ok: false, error: error.message || 'Network error', raw: null };
  }
}

/** Ask PawaPay for a deposit's current state, for reconciliation. */
export async function fetchDepositStatus({ token, baseUrl, depositId }) {
  try {
    const res = await fetch(`${baseUrl}/deposits/${encodeURIComponent(depositId)}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: payload?.message || `HTTP ${res.status}` };
    const row = Array.isArray(payload) ? payload[0] : payload;
    return { ok: true, status: row?.status || null, raw: sanitizePawapayPayload(row) };
  } catch (error) {
    return { ok: false, error: error.message || 'Network error' };
  }
}

/** PawaPay status → our mobile_payments.status. */
export function mapDepositStatus(pawapayStatus) {
  switch (String(pawapayStatus || '').toUpperCase()) {
    case 'COMPLETED': return 'completed';
    case 'FAILED': return 'failed';
    case 'CANCELLED': return 'cancelled';
    case 'REJECTED': return 'failed';
    default: return 'pending';
  }
}
