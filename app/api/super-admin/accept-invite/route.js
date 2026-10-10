// Binds a signed invitation to the signed-in user.
//
// Deliberately NOT behind requireSuperAdmin: the invitee has no platform role
// until this runs. Access is proven by the HMAC in the token plus a session
// whose email matches the invited address.
import { getServiceClient, verifyInviteToken, roleLabel } from '../../../../lib/superAdmin';

export async function POST(request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization');
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return Response.json({ error: 'Sign in to accept the invitation', code: 'NO_AUTH' }, { status: 401 });
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authUser) {
    return Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const subAdminId = await verifyInviteToken(body?.token);
  if (!subAdminId) {
    return Response.json({ error: 'This invitation link is not valid', code: 'INVALID_TOKEN' }, { status: 400 });
  }

  const { data: row } = await supabase
    .from('sub_admins')
    .select('id, email, name, role, is_active, accepted_at')
    .eq('id', subAdminId)
    .maybeSingle();

  if (!row) {
    return Response.json({ error: 'This invitation no longer exists', code: 'NOT_FOUND' }, { status: 404 });
  }
  if (!row.is_active) {
    return Response.json({ error: 'This invitation has been revoked', code: 'REVOKED' }, { status: 403 });
  }
  // The invitation is for one address; accepting it from another account would
  // hand that account a platform role it was never granted.
  if (String(row.email).toLowerCase() !== String(authUser.email || '').toLowerCase()) {
    return Response.json(
      { error: `This invitation is for ${row.email}. Sign in with that address to accept it.`, code: 'EMAIL_MISMATCH' },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('sub_admins')
    .update({
      user_id: authUser.id,
      // Re-opening an accepted link must not reset the original timestamp.
      accepted_at: row.accepted_at || now,
      last_login: now
    })
    .eq('id', row.id);

  if (error) {
    console.error('[super-admin/accept-invite] update failed:', error.message);
    return Response.json({ error: 'Failed to accept the invitation', code: 'WRITE_FAILED' }, { status: 500 });
  }

  return Response.json({ ok: true, role: row.role, roleLabel: roleLabel(row.role), alreadyAccepted: !!row.accepted_at });
}
