// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const ENUM_MAPS = {
  gender:             { valid: ['MALE', 'FEMALE'],
                        aliases: { M: 'MALE', MASCULIN: 'MALE', HOMME: 'MALE',
                                   F: 'FEMALE', FEMELLE: 'FEMALE', FEMME: 'FEMALE' } },
  age_group:          { valid: ['CHILD', 'YOUTH', 'ADULT', 'SENIOR'],
                        aliases: { ENFANT: 'CHILD', JEUNE: 'YOUTH', ADULTE: 'ADULT', AINE: 'SENIOR' } },
  membership_status:  { valid: ['ACTIVE', 'INACTIVE', 'DECEASED', 'TRANSFERRED'],
                        aliases: {} },
  language_pref:      { valid: ['ENGLISH', 'FRENCH'],
                        aliases: { EN: 'ENGLISH', ANGLAIS: 'ENGLISH',
                                   FR: 'FRENCH', FRANCAIS: 'FRENCH', 'FRANÇAIS': 'FRENCH' } }
};

function normalizeEnum(value, key) {
  if (value == null || value === '') return null;
  const upper = String(value).toUpperCase().trim();
  const cfg = ENUM_MAPS[key];
  if (!cfg) return null;
  if (cfg.valid.includes(upper)) return upper;
  if (cfg.aliases[upper]) return cfg.aliases[upper];
  return null;
}

export async function POST(request) {
  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  const tag = `[register-member ${reqId}]`;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      churchId, first_name, last_name, email, phone, whatsapp,
      date_of_birth, gender, age_group, language_pref, address, city,
      emergency_contact, emergency_phone, photo_url, location_id
    } = body;

    if (!churchId) {
      return Response.json({ error: 'Church identifier is required', code: 'MISSING_CHURCH' }, { status: 400 });
    }
    if (!first_name?.trim() || !last_name?.trim()) {
      return Response.json({ error: 'First and last name are required', code: 'MISSING_NAME' }, { status: 400 });
    }
    if (!phone?.trim() && !email?.trim()) {
      return Response.json({ error: 'Phone or email is required', code: 'MISSING_CONTACT' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: church, error: churchError } = await supabase
      .from('churches')
      .select('id')
      .eq('id', churchId)
      .maybeSingle();

    if (churchError) {
      console.error(`${tag} church_lookup_failed`, churchError.message);
      return Response.json({ error: 'Failed to verify church', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!church) {
      console.log(`${tag} unknown_church ts=${new Date().toISOString()}`);
      return Response.json({ error: 'Invalid invite link', code: 'CHURCH_NOT_FOUND' }, { status: 404 });
    }

    console.log(`${tag} church_id=${churchId} ts=${new Date().toISOString()}`);

    let safeLocationId = null;
    if (location_id && String(location_id).trim()) {
      const { data: loc } = await supabase
        .from('church_locations')
        .select('id')
        .eq('id', String(location_id).trim())
        .eq('church_id', churchId)
        .maybeSingle();
      if (loc) safeLocationId = loc.id;
    }

    const normGender         = normalizeEnum(gender, 'gender');
    const normAgeGroup       = normalizeEnum(age_group, 'age_group');
    const normLanguagePref   = normalizeEnum(language_pref, 'language_pref');
    const normMembershipStat = normalizeEnum('ACTIVE', 'membership_status');

    const insertPayload = {
      church_id: churchId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      date_of_birth: date_of_birth || null,
      gender: normGender,
      age_group: normAgeGroup,
      language_pref: normLanguagePref,
      address: address?.trim() || null,
      city: city?.trim() || null,
      emergency_contact: emergency_contact?.trim() || null,
      emergency_phone: emergency_phone?.trim() || null,
      photo_url: photo_url || null,
      membership_status: normMembershipStat,
      location_id: safeLocationId,
      spouse_id: null,
      created_by: null,
      membership_date: new Date().toISOString().split('T')[0],
      notes: 'Self-registered via connect link'
    };

    const { error: insertError } = await supabase
      .from('members')
      .insert(insertPayload);

    if (insertError) {
      console.error(`${tag} insert_failed`, {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        church_id: churchId
      });
      return Response.json({ error: 'Failed to register member', code: 'INSERT_FAILED' }, { status: 500 });
    }

    console.log(`${tag} success church_id=${churchId}`);
    return Response.json({ success: true });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ error: 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
