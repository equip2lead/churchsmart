// Feature access matrix by plan tier
// Plans are cumulative: each tier includes everything from lower tiers
const PLAN_FEATURES = {
  free: [
    'dashboard', 'members', 'visitors', 'salvations', 'attendance',
    'giving_basic', 'events', 'prayer_requests', 'settings', 'billing'
  ],
  starter: [
    'expenses', 'groups', 'messaging_email', 'data_import_export',
    'volunteers', 'reports_basic', 'giving'
  ],
  growth: [
    'messaging_whatsapp', 'auto_birthday_messages', 'multi_location',
    'reports_advanced'
  ],
  pro: [
    'sms', 'unlimited_members', 'unlimited_locations', 'unlimited_admins'
  ]
};

const PLAN_HIERARCHY = ['free', 'starter', 'growth', 'pro'];

const PLAN_LIMITS = {
  free:    { maxMembers: 50,   maxAdmins: 1, maxLocations: 1, maxWhatsapp: 0   },
  starter: { maxMembers: 200,  maxAdmins: 2, maxLocations: 1, maxWhatsapp: 0   },
  growth:  { maxMembers: 1000, maxAdmins: 5, maxLocations: 3, maxWhatsapp: 100 },
  pro:     { maxMembers: Infinity, maxAdmins: Infinity, maxLocations: Infinity, maxWhatsapp: 500 }
};

// Maps each feature to the minimum plan that unlocks it
const FEATURE_MIN_PLAN = {};
PLAN_HIERARCHY.forEach(plan => {
  PLAN_FEATURES[plan].forEach(feature => {
    if (!FEATURE_MIN_PLAN[feature]) {
      FEATURE_MIN_PLAN[feature] = plan;
    }
  });
});

/**
 * Check if a plan has access to a specific feature.
 * @param {string} plan - 'free' | 'starter' | 'growth' | 'pro'
 * @param {string} feature - Feature key from PLAN_FEATURES
 * @returns {boolean}
 */
export function canAccessFeature(plan, feature) {
  const normalizedPlan = (plan || 'free').toLowerCase();
  const planIndex = PLAN_HIERARCHY.indexOf(normalizedPlan);
  if (planIndex === -1) return false;

  // Collect all features available at this plan level and below
  for (let i = 0; i <= planIndex; i++) {
    if (PLAN_FEATURES[PLAN_HIERARCHY[i]].includes(feature)) {
      return true;
    }
  }
  return false;
}

/**
 * Get numeric limits for a plan.
 * @param {string} plan - 'free' | 'starter' | 'growth' | 'pro'
 * @returns {{ maxMembers: number, maxAdmins: number, maxLocations: number, maxWhatsapp: number }}
 */
export function getPlanLimits(plan) {
  const normalizedPlan = (plan || 'free').toLowerCase();
  return PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.free;
}

/**
 * Get the minimum plan required for a feature.
 * @param {string} feature - Feature key
 * @returns {string} Plan name (capitalized)
 */
export function getRequiredPlan(feature) {
  const plan = FEATURE_MIN_PLAN[feature] || 'pro';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
