// Default message templates seeded for every new church.
// Churches can customise these in Settings → Automation → Message Templates.

export const DEFAULT_TEMPLATES = [
  {
    name: 'Day 1 Welcome',
    category: 'VISITOR',
    language: 'ENGLISH',
    body: 'Hello {name}! 👋 Thank you for visiting {churchName}! We were truly blessed to have you with us. We hope you felt at home. God bless you! 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Accueil Jour 1',
    category: 'VISITOR',
    language: 'FRENCH',
    body: 'Bonjour {name} ! 👋 Merci d\'avoir visité {churchName} ! Nous avons été vraiment bénis par votre présence. Nous espérons que vous vous êtes senti(e) chez vous. Que Dieu vous bénisse ! 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Day 3 Follow-up',
    category: 'VISITOR',
    language: 'ENGLISH',
    body: 'Hello {name}! We hope you enjoyed your visit to {churchName}. We would love to see you again this Sunday! You are always welcome. 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Suivi Jour 3',
    category: 'VISITOR',
    language: 'FRENCH',
    body: 'Bonjour {name} ! Nous espérons que votre visite à {churchName} vous a plu. Nous serions ravis de vous revoir ce dimanche ! Vous êtes toujours le/la bienvenu(e). 🙏',
    variables: ['name', 'churchName']
  },
  {
    name: 'Day 7 Reminder',
    category: 'VISITOR',
    language: 'ENGLISH',
    body: 'Hi {name}! Just checking in from {churchName}. We miss you! Join us this Sunday for a powerful service. God bless! ✝️',
    variables: ['name', 'churchName']
  },
  {
    name: 'Rappel Jour 7',
    category: 'VISITOR',
    language: 'FRENCH',
    body: 'Bonjour {name} ! Un petit mot de {churchName}. Vous nous manquez ! Rejoignez-nous ce dimanche pour un culte puissant. Que Dieu vous bénisse ! ✝️',
    variables: ['name', 'churchName']
  },
  {
    name: 'Birthday Greeting',
    category: 'BIRTHDAY',
    language: 'ENGLISH',
    body: '🎂 Happy Birthday, {name}! Everyone at {churchName} wishes you a wonderful and blessed birthday. May God continue to pour His blessings upon you and your family abundantly!',
    variables: ['name', 'churchName']
  },
  {
    name: 'Voeux d\'anniversaire',
    category: 'BIRTHDAY',
    language: 'FRENCH',
    body: '🎂 Joyeux anniversaire, {name} ! Toute l\'équipe de {churchName} vous souhaite un merveilleux anniversaire béni. Que Dieu continue de déverser Ses bénédictions sur vous et votre famille en abondance !',
    variables: ['name', 'churchName']
  },
  {
    name: 'New Member Welcome',
    category: 'WELCOME',
    language: 'ENGLISH',
    body: 'Welcome to {churchName}, {name}! 🎉 We are so glad you\'ve joined our family. We look forward to growing together in faith. God bless you!',
    variables: ['name', 'churchName']
  },
  {
    name: 'Bienvenue nouveau membre',
    category: 'WELCOME',
    language: 'FRENCH',
    body: 'Bienvenue à {churchName}, {name} ! 🎉 Nous sommes si heureux que vous ayez rejoint notre famille. Nous avons hâte de grandir ensemble dans la foi. Que Dieu vous bénisse !',
    variables: ['name', 'churchName']
  }
];

/**
 * Get the right template for a category based on the person's language preference.
 * Falls back to FRENCH if no match (since most of the congregation speaks French).
 *
 * @param {string} category   – e.g. 'BIRTHDAY', 'VISITOR', 'WELCOME'
 * @param {string} language   – 'ENGLISH' or 'FRENCH'
 * @param {object[]} [customTemplates] – church-custom templates from DB (optional)
 * @returns {object|null}
 */
export function getTemplateByLanguage(category, language = 'FRENCH', customTemplates = []) {
  // Try custom templates first (church may have set their own)
  const custom = customTemplates.find(t => t.category === category && t.language === language && t.is_active);
  if (custom) return custom;

  // Fall back to defaults
  const match = DEFAULT_TEMPLATES.find(t => t.category === category && t.language === language);
  if (match) return match;

  // If no match for the requested language, try the other language
  const fallback = DEFAULT_TEMPLATES.find(t => t.category === category);
  return fallback || null;
}

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
    language: t.language || 'FRENCH',
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
