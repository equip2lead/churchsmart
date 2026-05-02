// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendInvitationEmail } from '../../../../lib/notifications';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const APP_URL = 'https://app.churchsmartnow.com';
const VALID_BASE_ROLES = ['STAFF', 'ADMIN', 'VOLUNTEER'];

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[send-invitation ${reqId}]`;

  try {
    // Authenticate caller
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

    const body = await request.json().catch(() => ({}));
    const { churchId, email, role_id, full_name, base_role } = body;

    if (!churchId || !email || !role_id || !base_role) {
      return Response.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: 'Invalid email format', code: 'INVALID_EMAIL' }, { status: 400 });
    }
    if (!VALID_BASE_ROLES.includes(base_role)) {
      return Response.json({ error: 'Invalid base role', code: 'INVALID_BASE_ROLE' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Caller must be ADMIN of the target church
    const { data: caller, error: callerError } = await supabase
      .from('church_users')
      .select('id, role, church_id, full_name, email')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (callerError) {
      console.error(`${tag} caller_lookup_failed`, callerError.message);
      return Response.json({ error: 'Failed to verify caller', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!caller) {
      console.log(`${tag} not_member auth_id=${authUser.id} church_id=${churchId}`);
      return Response.json({ error: 'You are not a member of this church', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }
    if (caller.role !== 'ADMIN') {
      console.log(`${tag} not_admin auth_id=${authUser.id} role=${caller.role}`);
      return Response.json({ error: 'Only church admins can send invitations', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }

    // role_id must belong to this church
    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('id, name')
      .eq('id', role_id)
      .eq('church_id', churchId)
      .maybeSingle();

    if (roleError) {
      console.error(`${tag} role_lookup_failed`, roleError.message);
      return Response.json({ error: 'Failed to verify role', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (!roleRow) {
      console.log(`${tag} role_not_in_church role_id=${role_id} church_id=${churchId}`);
      return Response.json({ error: 'Role not found for this church', code: 'INVALID_ROLE' }, { status: 400 });
    }

    // STRICT multi-church block (1/2): existing active church_users
    const { data: existingUser, error: existingUserError } = await supabase
      .from('church_users')
      .select('church_id')
      .ilike('email', normalizedEmail)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existingUserError) {
      console.error(`${tag} existing_user_lookup_failed`, existingUserError.message);
      return Response.json({ error: 'Failed to check existing membership', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (existingUser) {
      const { data: existingChurch } = await supabase
        .from('churches')
        .select('name')
        .eq('id', existingUser.church_id)
        .maybeSingle();
      console.log(`${tag} duplicate_user_active email=${normalizedEmail} existing_church_id=${existingUser.church_id}`);
      return Response.json({
        error: 'Email already belongs to another church',
        code: 'DUPLICATE_USER',
        existing_church: existingChurch?.name || 'another church'
      }, { status: 409 });
    }

    // STRICT multi-church block (2/2): existing active assignment (covers users without church_users yet)
    const { data: existingActive, error: existingActiveError } = await supabase
      .from('user_role_assignments')
      .select('church_id')
      .ilike('user_email', normalizedEmail)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existingActiveError) {
      console.error(`${tag} existing_active_lookup_failed`, existingActiveError.message);
      return Response.json({ error: 'Failed to check active assignments', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (existingActive) {
      const { data: existingChurch } = await supabase
        .from('churches')
        .select('name')
        .eq('id', existingActive.church_id)
        .maybeSingle();
      console.log(`${tag} duplicate_assignment_active email=${normalizedEmail} existing_church_id=${existingActive.church_id}`);
      return Response.json({
        error: 'Email already has active role in another church',
        code: 'DUPLICATE_USER',
        existing_church: existingChurch?.name || 'another church'
      }, { status: 409 });
    }

    // Pending invite to THIS church → DUPLICATE_INVITE
    const { data: pending, error: pendingError } = await supabase
      .from('user_role_assignments')
      .select('id, invitation_expires_at')
      .ilike('user_email', normalizedEmail)
      .eq('church_id', churchId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error(`${tag} pending_lookup_failed`, pendingError.message);
      return Response.json({ error: 'Failed to check pending invites', code: 'LOOKUP_FAILED' }, { status: 500 });
    }
    if (pending) {
      console.log(`${tag} duplicate_invite email=${normalizedEmail} expires=${pending.invitation_expires_at}`);
      return Response.json({
        error: 'A pending invitation already exists for this email',
        code: 'DUPLICATE_INVITE',
        expires_at: pending.invitation_expires_at
      }, { status: 409 });
    }

    // Token + 7-day expiry (computed in JS, not relying on DB default)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: inserted, error: insertError } = await supabase
      .from('user_role_assignments')
      .insert({
        church_id: churchId,
        user_email: normalizedEmail,
        user_name: full_name?.trim() || null,
        role_id,
        status: 'pending',
        pending_base_role: base_role,
        invitation_token: inviteToken,
        invitation_expires_at: expiresAt.toISOString(),
        invitation_sent_at: new Date().toISOString(),
        assigned_by: caller.email || null
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      console.error(`${tag} insert_failed`, {
        code: insertError?.code,
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint,
        church_id: churchId
      });
      return Response.json({ error: 'Failed to create invitation', code: 'INSERT_FAILED' }, { status: 500 });
    }

    // Send invitation email
    const { data: church } = await supabase
      .from('churches')
      .select('name, default_language')
      .eq('id', churchId)
      .maybeSingle();

    const churchName = church?.name || 'your church';
    // Normalize DB enum ('FRENCH' / 'ENGLISH') to 2-letter code once. Default
    // to 'en' for null/unrecognized values so callers always get a usable lang.
    const lang = church?.default_language === 'FRENCH' ? 'fr' : 'en';
    const inviteLink = `${APP_URL}/accept-invite?token=${inviteToken}`;

    console.log(`${tag} sending_email invitation_id=${inserted.id} church_id=${churchId} lang=${lang}`);

    const emailResult = await sendInvitationEmail(
      normalizedEmail,
      churchName,
      caller.full_name || 'A church admin',
      base_role,
      inviteLink,
      lang
    );

    if (!emailResult.success) {
      console.error(`${tag} email_failed invitation_id=${inserted.id}`, emailResult.error);
      // Don't roll back — the assignment is still valid. Surface link so admin can manually share.
      return Response.json({
        success: true,
        invitation_id: inserted.id,
        expires_at: expiresAt.toISOString(),
        warning: 'EMAIL_FAILED',
        invite_link: inviteLink
      });
    }

    console.log(`${tag} success invitation_id=${inserted.id}`);
    return Response.json({
      success: true,
      invitation_id: inserted.id,
      expires_at: expiresAt.toISOString()
    });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ error: 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
