// Who am I, platform-side? The client uses this to decide which tabs to show;
// every mutating route re-checks the same way, so the UI is a convenience and
// never the enforcement point.
import { requireSuperAdmin, roleLabel } from '../../../../lib/superAdmin';

export async function GET(request) {
  const gate = await requireSuperAdmin(request);
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  // Record the visit for sub-admins so the Team tab can show last login.
  if (admin.subAdminId) {
    await supabase
      .from('sub_admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.subAdminId);
  }

  return Response.json({
    email: admin.email,
    role: admin.role,
    roleLabel: roleLabel(admin.role),
    permissions: admin.permissions,
    isOwner: admin.subAdminId === null
  });
}
