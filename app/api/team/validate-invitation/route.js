// Public endpoint — token IS the auth, no Bearer required.
// Returns 200 with { valid: false, reason } on bad tokens so the client can render
// distinct UI states without parsing 4xx codes.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[validate-invitation ${reqId}]`;

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    // Cheap shape check before DB lookup
    if (!token || typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
      return Response.json({ valid: false, reason: 'not_found' });
    }

    const supabase = getSupabase();

    const { data: assignment, error: lookupError } = await supabase
      .from('user_role_assignments')
      .select('id, church_id, user_email, user_name, role_id, status, pending_base_role, invitation_expires_at')
      .eq('invitation_token', token)
      .maybeSingle();

    if (lookupError) {
      console.error(`${tag} lookup_failed`, lookupError.message);
      return Response.json({ valid: false, reason: 'not_found' });
    }

    if (!assignment) {
      return Response.json({ valid: false, reason: 'not_found' });
    }

    if (assignment.status === 'revoked') {
      console.log(`${tag} revoked invitation_id=${assignment.id}`);
      return Response.json({ valid: false, reason: 'revoked' });
    }

    if (assignment.status !== 'pending') {
      console.log(`${tag} already_used invitation_id=${assignment.id} status=${assignment.status}`);
      return Response.json({ valid: false, reason: 'already_used' });
    }

    if (assignment.invitation_expires_at && new Date(assignment.invitation_expires_at) < new Date()) {
      // Mark expired so subsequent visits skip the lookup chain
      await supabase
        .from('user_role_assignments')
        .update({ status: 'expired', invitation_token: null })
        .eq('id', assignment.id);
      console.log(`${tag} expired invitation_id=${assignment.id}`);
      return Response.json({ valid: false, reason: 'expired' });
    }

    const [{ data: church }, { data: roleRow }] = await Promise.all([
      supabase.from('churches').select('name, default_language').eq('id', assignment.church_id).maybeSingle(),
      supabase.from('user_roles').select('name').eq('id', assignment.role_id).maybeSingle()
    ]);

    console.log(`${tag} valid invitation_id=${assignment.id} church_id=${assignment.church_id}`);

    return Response.json({
      valid: true,
      church_name: church?.name || '',
      // Normalize DB enum ('FRENCH' / 'ENGLISH') to 2-letter code at the API
      // boundary so all clients can compare against 'en' / 'fr' uniformly.
      church_default_language: church?.default_language === 'FRENCH' ? 'fr' : 'en',
      email: assignment.user_email,
      user_name: assignment.user_name,
      base_role: assignment.pending_base_role,
      role_name: roleRow?.name || '',
      expires_at: assignment.invitation_expires_at
    });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ valid: false, reason: 'not_found' });
  }
}
