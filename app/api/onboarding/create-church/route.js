// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  const tag = `[create-church ${reqId}]`;

  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.log(`${tag} no_auth ts=${new Date().toISOString()}`);
      return Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      console.log(`${tag} invalid_auth ts=${new Date().toISOString()}`);
      return Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
    }

    console.log(`${tag} auth_id=${authUser.id} ts=${new Date().toISOString()}`);

    const body = await request.json().catch(() => ({}));
    const { name, city, denomination, address, senior_pastor, currency, church_phone, church_email, default_language } = body;
    // Validate against the language_pref enum. Default to ENGLISH on null /
    // missing / garbage — explicitly NOT FRENCH, so we don't reproduce the
    // pre-fix silent-bias in the opposite direction.
    const safeDefaultLanguage = default_language === 'FRENCH' ? 'FRENCH' : 'ENGLISH';

    if (!name || !name.trim()) {
      return Response.json({ error: 'Church name is required', code: 'MISSING_NAME' }, { status: 400 });
    }

    const { data: churchUser, error: lookupError } = await supabase
      .from('church_users')
      .select('id, church_id, full_name')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (lookupError) {
      console.error(`${tag} lookup_failed`, lookupError.message);
      return Response.json({ error: 'Failed to look up user profile', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!churchUser) {
      console.error(`${tag} user_not_found auth_id=${authUser.id}`);
      return Response.json({ error: 'User profile not found', code: 'USER_NOT_FOUND' }, { status: 409 });
    }
    if (churchUser.church_id) {
      console.log(`${tag} church_exists auth_id=${authUser.id} church_id=${churchUser.church_id}`);
      return Response.json({ error: 'Church already exists for this user', code: 'CHURCH_EXISTS' }, { status: 409 });
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { data: newChurch, error: churchError } = await supabase
      .from('churches')
      .insert({
        name: name.trim(),
        slug,
        city: city || null,
        denomination: denomination || null,
        address: address || null,
        pastor_name: senior_pastor || null,
        phone: church_phone || null,
        email: church_email || null,
        currency: currency || 'XAF',
        trial_end: trialEnd.toISOString(),
        default_language: safeDefaultLanguage
      })
      .select()
      .single();

    if (churchError || !newChurch?.id) {
      console.error(`${tag} church_insert_failed`, churchError?.message || 'no row returned');
      return Response.json({ error: 'Failed to create church', code: 'CHURCH_INSERT_FAILED' }, { status: 500 });
    }

    const fullName = churchUser.full_name || authUser.email?.split('@')[0] || 'Admin';
    const { error: updateError } = await supabase
      .from('church_users')
      .update({
        church_id: newChurch.id,
        full_name: fullName,
        role: 'ADMIN',
        is_active: true
      })
      .eq('id', churchUser.id);

    if (updateError) {
      console.error(`${tag} link_failed church_id=${newChurch.id}`, updateError.message);
      // Rollback: service-role client bypasses RLS to clean up the orphaned church
      await supabase.from('churches').delete().eq('id', newChurch.id);
      return Response.json({ error: 'Failed to link account', code: 'LINK_FAILED' }, { status: 500 });
    }

    // Seed the 3 default custom roles (Admin/Staff/Volunteer) for the new church.
    // These power the invitation flow's "Account Type → Custom Role" auto-pick.
    // If seeding fails, the church + admin are already created and functional —
    // log and proceed. Admin can manually create roles via Settings → User Roles.
    try {
      const { error: roleSeedError } = await supabase
        .from('user_roles')
        .insert([
          { church_id: newChurch.id, name: 'Admin' },
          { church_id: newChurch.id, name: 'Staff' },
          { church_id: newChurch.id, name: 'Volunteer' }
        ]);
      if (roleSeedError) {
        console.error(`${tag} default_role_seed_failed`, {
          code: roleSeedError.code,
          message: roleSeedError.message,
          details: roleSeedError.details,
          hint: roleSeedError.hint,
          church_id: newChurch.id
        });
      }
    } catch (seedErr) {
      console.error(`${tag} default_role_seed_threw church_id=${newChurch.id}`, seedErr?.message || seedErr);
    }

    console.log(`${tag} success church_id=${newChurch.id}`);
    return Response.json({ success: true, church: newChurch });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ error: 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
