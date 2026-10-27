// Default message templates seeded for every new church.
// Churches can customise these in Settings → Automation → Message Templates.

export const DEFAULT_TEMPLATES = [
  {
    name: 'Day 1 Welcome',
    category: 'VISITOR',
    body: 'Hello {name}! 👋 Thank you for visiting {churchName}! We were truly blessed to have you with us. We hope you felt at home. God bless you! 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Day 3 Follow-up',
    category: 'VISITOR',
    body: 'Hello {name}! We hope you enjoyed your visit to {churchName}. We would love to see you again this Sunday! You are always welcome. 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Day 7 Reminder',
    category: 'VISITOR',
    body: 'Hi {name}! Just checking in from {churchName}. We miss you! Join us this Sunday for a powerful service. God bless! ✝️',
    variables: ['name', 'churchName']
  },
  {
    name: 'Birthday Greeting',
    category: 'BIRTHDAY',
    body: '🎂 Happy Birthday, {name}! Everyone at {churchName} wishes you a wonderful and blessed birthday. May God continue to pour His blessings upon you and your family abundantly!',
    variables: ['name', 'churchName']
  },
  {
    name: 'New Member Welcome',
    category: 'WELCOME',
    body: 'Welcome to {churchName}, {name}! 🎉 We are so glad you\'ve joined our family. We look forward to growing together in faith. God bless you!',
    variables: ['name', 'churchName']
  }
];

/**
 * Seed default message templates for a church if it has none.
 * Safe to call multiple times — does nothing when templates already exist.
 *
 * @param {object} supabase  – an initialised Supabase client
 * @param {string} churchId  – the church UUID
 * @returns {object[]}       – the inserted rows (empty array if skipped)
 */
export async function seedDefaultTemplates(supabase, churchId) {
  if (!churchId) return [];

  // Check whether this church already owns any templates.
  const { data: existing } = await supabase
    .from('message_templates')
    .select('id')
    .eq('church_id', churchId)
    .limit(1);

  if (existing && existing.length > 0) return [];

  const rows = DEFAULT_TEMPLATES.map(t => ({
    church_id: churchId,
    name: t.name,
    category: t.category,
    body: t.body,
    variables: t.variables,
    is_active: true
  }));

  const { data: inserted, error } = await supabase
    .from('message_templates')
    .insert(rows)
    .select();

  if (error) {
    console.warn('seedDefaultTemplates: insert failed', error.message);
    return [];
  }

  return inserted || [];
}
