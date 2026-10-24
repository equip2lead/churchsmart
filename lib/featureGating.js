// ==========================================
// PLAN TIERS, LIMITS AND FEATURE GATING
// ==========================================
// A church's tier lives in churches.plan — the single source of truth, written
// by the Stripe webhook. churches.subscription_plan and subscriptions.plan are
// legacy columns still written for continuity; nothing reads them for gating.

const PLAN_HIERARCHY = ['free', 'starter', 'growth', 'pro'];

// Cumulative: each tier also has everything from the tiers below it.
const PLAN_FEATURES = {
  free: [
    'dashboard', 'members', 'attendance', 'events', 'settings', 'billing',
    'salvations', 'prayer_requests', 'giving_basic'
  ],
  starter: [
    'visitors', 'messaging_email', 'giving', 'giving_reports', 'expenses',
    'groups', 'volunteers', 'data_import_export', 'reports_basic'
  ],
  growth: [
    'messaging_whatsapp', 'activity_logs', 'giving_analytics',
    'auto_birthday_messages', 'multi_location', 'reports_advanced'
  ],
  pro: [
    'custom_reports', 'priority_support', 'giving_export', 'sms',
    'unlimited_members', 'unlimited_locations', 'unlimited_admins'
  ]
};

const PLAN_LIMITS = {
  free:    { maxMembers: 50,       maxAdmins: 1,        maxLocations: 1,        maxEmailsPerMonth: 0 },
  starter: { maxMembers: 200,      maxAdmins: 2,        maxLocations: 1,        maxEmailsPerMonth: 100 },
  growth:  { maxMembers: Infinity, maxAdmins: 5,        maxLocations: 3,        maxEmailsPerMonth: 500 },
  pro:     { maxMembers: Infinity, maxAdmins: Infinity, maxLocations: Infinity, maxEmailsPerMonth: Infinity }
};
// WhatsApp messaging is gated by the 'messaging_whatsapp' feature (Growth+).
// Message volume limits are managed by the third-party WhatsApp provider, not
// by ChurchSmart — so there is no maxWhatsapp quota here.

// Annual billing is ten months' worth — i.e. two months free.
export const PLAN_PRICING = {
  free:    { monthlyUsd: 0,  annualUsd: 0,   monthlyXaf: 0,     annualXaf: 0 },
  starter: { monthlyUsd: 5,  annualUsd: 50,  monthlyXaf: 3000,  annualXaf: 30000 },
  growth:  { monthlyUsd: 15, annualUsd: 150, monthlyXaf: 9000,  annualXaf: 90000 },
  pro:     { monthlyUsd: 29, annualUsd: 290, monthlyXaf: 18000, annualXaf: 180000 }
};

// Placeholders until the real Stripe prices exist; an env var wins when set,
// so the IDs can be supplied without another deploy of this file.
export const STRIPE_PRICE_IDS = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly_placeholder',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL || 'price_starter_annual_placeholder'
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH_MONTHLY || 'price_growth_monthly_placeholder',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH_ANNUAL || 'price_growth_annual_placeholder'
  },
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder'
  }
};

/** True when a price id is still a placeholder, so checkout can refuse early. */
export function isPlaceholderPriceId(priceId) {
  return !priceId || String(priceId).includes('_placeholder');
}

// Maps each feature to the lowest plan that unlocks it.
const FEATURE_MIN_PLAN = {};
PLAN_HIERARCHY.forEach(plan => {
  PLAN_FEATURES[plan].forEach(feature => {
    if (!FEATURE_MIN_PLAN[feature]) FEATURE_MIN_PLAN[feature] = plan;
  });
});

/** Normalize whatever the caller has into a plan key. */
function planOf(planOrChurch) {
  if (!planOrChurch) return 'free';
  const raw = typeof planOrChurch === 'string'
    ? planOrChurch
    : (planOrChurch.plan || planOrChurch.subscription_plan || 'free');
  const normalized = String(raw).toLowerCase();
  return PLAN_HIERARCHY.includes(normalized) ? normalized : 'free';
}

/**
 * Check whether a plan unlocks a feature.
 * @param {string} plan - 'free' | 'starter' | 'growth' | 'pro'
 * @param {string} feature - a key from PLAN_FEATURES
 */
export function canAccessFeature(plan, feature) {
  const normalized = planOf(plan);
  const planIndex = PLAN_HIERARCHY.indexOf(normalized);
  for (let i = 0; i <= planIndex; i++) {
    if (PLAN_FEATURES[PLAN_HIERARCHY[i]].includes(feature)) return true;
  }
  return false;
}

/**
 * Same check, but accepts a church row (or a plan string) directly.
 * @param {object|string} church - a church row with `plan`, or a plan name
 */
export function canAccess(church, feature) {
  return canAccessFeature(planOf(church), feature);
}

/** Numeric limits for a plan. Unlimited values are Infinity. */
export function getPlanLimits(planOrChurch) {
  return PLAN_LIMITS[planOf(planOrChurch)] || PLAN_LIMITS.free;
}

/** Monthly email allowance. Infinity means unlimited. */
export function getEmailLimit(planOrChurch) {
  return getPlanLimits(planOrChurch).maxEmailsPerMonth;
}

/** The lowest plan that unlocks a feature, capitalized for display. */
export function getRequiredPlan(feature) {
  const plan = FEATURE_MIN_PLAN[feature] || 'pro';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Ordered plan keys, for rendering the pricing cards. */
export function getPlanOrder() {
  return [...PLAN_HIERARCHY];
}

/** Where a target plan sits relative to the current one. */
export function comparePlans(currentPlan, targetPlan) {
  const a = PLAN_HIERARCHY.indexOf(planOf(currentPlan));
  const b = PLAN_HIERARCHY.indexOf(planOf(targetPlan));
  if (a === b) return 'current';
  return b > a ? 'upgrade' : 'downgrade';
}
