// The platform admin team: list, invite, change role, activate/deactivate.
import {
  requireSuperAdmin,
  logAdminAction,
  createInviteToken,
  ADMIN_ROLES,
  roleLabel
} from '../../../../lib/superAdmin';
import { sendSubAdminInvite } from '../../../../lib/notifications';

// super_admin is deliberately not invitable from the UI: platform ownership
// comes from the hardcoded email list, not from a form.
const INVITABLE_ROLES = ['support', 'finance', 'viewer'];

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_activity_log');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  const { data, error } = await supabase
    .from('sub_admins')
    .select('id, email, name, role, invited_at, accepted_at, is_active, last_login')
    .order('invited_at', { ascending: false });

  if (error) {
    console.error('[super-admin/sub-admins] read failed:', error.message);
    return Response.json({ error: 'Failed to read the team', code: 'READ_FAILED' }, { status: 500 });
  }
  return Response.json({ subAdmins: data || [] });
}

export async function POST(request) {
  const gate = await requireSuperAdmin(request, 'manage_sub_admins');
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const name = String(body?.name || '').trim();
  const role = String(body?.role || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required', code: 'INVALID_EMAIL' }, { status: 400 });
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return Response.json({ error: `Role must be one of: ${INVITABLE_ROLES.join(', ')}`, code: 'INVALID_ROLE' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('sub_admins')
    .select('id, email, accepted_at')
    .ilike('email', email)
    .maybeSingle();

  if (existing) {
    return Response.json(
      { error: existing.accepted_at ? 'That person is already on the team' : 'That person already has a pending invitation', code: 'ALREADY_INVITED' },
      { status: 409 }
    );
  }

  const { data: row, error } = await supabase
    .from('sub_admins')
    .insert({ email, name: name || null, role, invited_by: authUser.id, is_active: true })
    .select('id, email, name, role, invited_at, accepted_at, is_active, last_login')
    .maybeSingle();

  if (error) {
    console.error('[super-admin/sub-admins] insert failed:', error.message);
    return Response.json({ error: 'Failed to create the invitation', code: 'WRITE_FAILED' }, { status: 500 });
  }

  // The row exists even if the email fails, so the invite can be resent.
  const token = await createInviteToken(row.id);
  let emailSent = false;
  let emailError = null;
  if (token) {
    const result = await sendSubAdminInvite(email, { name, role: roleLabel(role), token, invitedBy: admin.email });
    emailSent = !!result?.success;
    if (!emailSent) emailError = result?.error || 'Email send failed';
  } else {
    emailError = 'No invite signing secret configured on the server';
  }

  await logAdminAction(supabase, {
    authUser, admin, request,
    action: 'sub_admin_invited',
    details: { email, role, email_sent: emailSent }
  });

  return Response.json({ subAdmin: row, emailSent, emailError });
}

export async function PATCH(request) {
  const gate = await requireSuperAdmin(request, 'manage_sub_admins');
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  if (!id) {
    return Response.json({ error: 'id is required', code: 'MISSING_FIELDS' }, { status: 400 });
  }

  const { data: target } = await supabase
    .from('sub_admins')
    .select('id, email, role, is_active')
    .eq('id', id)
    .maybeSingle();
  if (!target) {
    return Response.json({ error: 'Team member not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const updates = {};
  let action = null;

  if (body.role !== undefined) {
    const role = String(body.role);
    if (!ADMIN_ROLES.includes(role)) {
      return Response.json({ error: 'Invalid role', code: 'INVALID_ROLE' }, { status: 400 });
    }
    updates.role = role;
    action = 'sub_admin_role_changed';
  }
  if (body.is_active !== undefined) {
    updates.is_active = !!body.is_active;
    action = updates.is_active ? 'sub_admin_activated' : 'sub_admin_deactivated';
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update', code: 'NO_CHANGES' }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('sub_admins')
    .update(updates)
    .eq('id', id)
    .select('id, email, name, role, invited_at, accepted_at, is_active, last_login')
    .maybeSingle();

  if (error) {
    console.error('[super-admin/sub-admins] update failed:', error.message);
    return Response.json({ error: 'Failed to update the team member', code: 'WRITE_FAILED' }, { status: 500 });
  }

  await logAdminAction(supabase, {
    authUser, admin, request,
    action,
    details: { email: target.email, from_role: target.role, ...updates }
  });

  return Response.json({ subAdmin: row });
}
