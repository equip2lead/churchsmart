// Public endpoint — token IS the auth.
// Uses an atomic claim pattern: a single UPDATE clears invitation_token while
// the row is still status='pending' and not expired. Concurrent accepts of the
// same token find 0 rows on the claim and fail before any expensive Supabase
// Auth operation runs. Status stays 'pending' until step 4 (finalize) so a
// mid-flow failure can restore the token for the user to retry.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isStrongPassword(pwd) {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8) return false;
  if (!/[A-Z]/.test(pwd)) return false;
  if (!/[0-9]/.test(pwd)) return false;
  return true;
}

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[accept-invitation ${reqId}]`;

  try {
    const body = await request.json().catch(() => ({}));
    const { token, password, full_name } = body;

    if (!token || !password) {
      return Response.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return Response.json({
        error: 'Password must be at least 8 characters with one uppercase letter and one number',
        code: 'WEAK_PASSWORD'
      }, { status: 400 });
    }

    if (typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
      return Response.json({ error: 'Invalid or expired invitation', code: 'INVALID_OR_EXPIRED' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Step 1 — atomic claim. Clear the token in one UPDATE so concurrent accepts
    // can't pass the same gate twice. Status stays 'pending' here; downstream
    // failures can restore the token for the user to retry.
    const { data: claimed, error: claimError } = await supabase
      .from('user_role_assignments')
      .update({ invitation_token: null })
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .gt('invitation_expires_at', new Date().toISOString())
      .select('id, church_id, user_email, role_id, pending_base_role')
      .maybeSingle();

    if (claimError) {
      console.error(`${tag} claim_failed`, claimError.message);
      return Response.json({ error: 'Failed to claim invitation', code: 'LOOKUP_FAILED' }, { status: 500 });
    }

    if (!claimed) {
      // Token doesn't exist, was already used (status != 'pending'), or expired.
      // Same client-facing reason for all three; logged identically.
      console.log(`${tag} invalid_or_expired_or_taken`);
      return Response.json({ error: 'Invalid or expired invitation', code: 'INVALID_OR_EXPIRED' }, { status: 400 });
    }

    console.log(`${tag} claimed invitation_id=${claimed.id} church_id=${claimed.church_id}`);

    const cleanedFullName = (typeof full_name === 'string' && full_name.trim())
      ? full_name.trim()
      : claimed.user_email.split('@')[0];

    // Restore the token if a downstream step fails. Best-effort; failure to
    // restore is logged but doesn't affect the user-facing error.
    const restoreToken = async () => {
      try {
        await supabase
          .from('user_role_assignments')
          .update({ invitation_token: token })
          .eq('id', claimed.id)
          .eq('status', 'pending');
      } catch (e) {
        console.error(`${tag} restore_token_failed`, e?.message || e);
      }
    };

    // Step 2 — create the Supabase auth user. email_confirm: true skips
    // Supabase's email-verification step; clicking the invite link IS the proof
    // of email ownership.
    const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
      email: claimed.user_email,
      password,
      email_confirm: true
    });

    if (authCreateError || !authData?.user?.id) {
      const msg = authCreateError?.message || '';
      console.error(`${tag} auth_create_failed`, msg);
      await restoreToken();
      if (msg.toLowerCase().includes('already')) {
        return Response.json({
          error: 'An account already exists for this email. Please sign in normally.',
          code: 'AUTH_USER_EXISTS'
        }, { status: 409 });
      }
      return Response.json({ error: 'Failed to create account', code: 'AUTH_USER_CREATION_FAILED' }, { status: 500 });
    }

    const authUserId = authData.user.id;

    // Step 3 — link the new auth user to a church_users row with the base role.
    const { error: cuInsertError } = await supabase
      .from('church_users')
      .insert({
        auth_id: authUserId,
        church_id: claimed.church_id,
        email: claimed.user_email,
        full_name: cleanedFullName,
        role: claimed.pending_base_role,
        is_active: true
      });

    if (cuInsertError) {
      console.error(`${tag} church_users_insert_failed`, {
        code: cuInsertError.code,
        message: cuInsertError.message,
        details: cuInsertError.details,
        hint: cuInsertError.hint
      });
      // Roll back: delete the orphaned auth user and restore the token.
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (rollbackErr) {
        console.error(`${tag} auth_rollback_failed`, rollbackErr?.message);
      }
      await restoreToken();
      return Response.json({ error: 'Failed to create user profile', code: 'DB_INSERT_FAILED' }, { status: 500 });
    }

    // Step 4 — finalize. Flip to 'active', record acceptance, clear
    // pending_base_role, store the confirmed name. Token is already null.
    const { error: finalizeError } = await supabase
      .from('user_role_assignments')
      .update({
        status: 'active',
        accepted_at: new Date().toISOString(),
        pending_base_role: null,
        user_name: cleanedFullName
      })
      .eq('id', claimed.id);

    if (finalizeError) {
      // Auth user + church_users already exist — the user CAN log in. The
      // assignment is in a partial-success state (pending + token cleared).
      // Logged for admin cleanup; user is unaffected.
      console.error(`${tag} finalize_failed invitation_id=${claimed.id}`, finalizeError.message);
    }

    // Audit log — fire-and-forget. Logged from the server (not the client)
    // because the accept flow finishes here before any client React tree
    // mounts. Wrapped in try/catch so a logging failure never breaks the
    // accept response. Service-role client bypasses RLS, but we still set
    // church_id explicitly to match the activity_logs RLS contract used by
    // the client logActivity helper.
    try {
      await supabase.from('activity_logs').insert({
        church_id: claimed.church_id,
        user_email: claimed.user_email,
        user_name: cleanedFullName,
        action: 'role_invitation_accepted',
        entity_type: 'role_assignment',
        entity_id: claimed.id,
        entity_name: claimed.user_email,
        details: { base_role: claimed.pending_base_role, role_id: claimed.role_id }
      });
    } catch (logErr) {
      console.error(`${tag} activity_log_failed invitation_id=${claimed.id}`, logErr?.message || logErr);
    }

    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', claimed.church_id)
      .maybeSingle();

    console.log(`${tag} success invitation_id=${claimed.id} auth_id=${authUserId}`);

    return Response.json({
      success: true,
      church_name: church?.name || '',
      email: claimed.user_email,
      redirect_url: '/'
    });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ error: 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
