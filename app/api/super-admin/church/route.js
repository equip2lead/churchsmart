// Platform-level changes to a single church: plan override and suspension.
// Both are audited, and both are gated on their own permission.
import { requireSuperAdmin, logAdminAction, hasPermission, roleLabel } from '../../../../lib/superAdmin';
import { getPlanOrder } from '../../../../lib/featureGating';

export async function POST(request) {
  // Authenticate before reading the body, so an anonymous caller learns
  // nothing about the request shape.
  const gate = await requireSuperAdmin(request);
  if (gate.response) return gate.response;
  const { supabase, authUser, admin } = gate;

  const body = await request.json().catch(() => ({}));
  const { churchId, action, plan, suspended } = body;

  if (!churchId || !action) {
    return Response.json({ error: 'churchId and action are required', code: 'MISSING_FIELDS' }, { status: 400 });
  }

  // The permission required depends on which change is being made.
  const permission = action === 'change_plan' ? 'change_plans'
    : action === 'set_suspended' ? 'suspend_churches'
    : null;
  if (!permission) {
    return Response.json({ error: `Unknown action: ${action}`, code: 'UNKNOWN_ACTION' }, { status: 400 });
  }
  if (!hasPermission(admin.role, permission)) {
    return Response.json(
      { error: `Your role (${roleLabel(admin.role)}) cannot perform this action`, code: 'INSUFFICIENT_ROLE', role: admin.role },
      { status: 403 }
    );
  }

  const { data: church, error: readError } = await supabase
    .from('churches')
    .select('id, name, plan, is_suspended')
    .eq('id', churchId)
    .maybeSingle();

  if (readError) {
    return Response.json({ error: 'Failed to read church', code: 'READ_FAILED' }, { status: 500 });
  }
  if (!church) {
    return Response.json({ error: 'Church not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  if (action === 'change_plan') {
    if (!getPlanOrder().includes(plan)) {
      return Response.json({ error: `Invalid plan: ${plan}`, code: 'INVALID_PLAN' }, { status: 400 });
    }

    // churches.plan is the gating source of truth; subscription_plan is kept
    // in step for the legacy readers, exactly as the Stripe webhook does.
    const { error } = await supabase
      .from('churches')
      .update({ plan, subscription_plan: plan })
      .eq('id', churchId);

    if (error) {
      console.error('[super-admin/church] plan update failed:', error.message);
      return Response.json({ error: 'Failed to change plan', code: 'WRITE_FAILED' }, { status: 500 });
    }

    await logAdminAction(supabase, {
      authUser, admin, request,
      action: 'plan_changed',
      details: { church_id: churchId, church_name: church.name, from: church.plan, to: plan, manual_override: true }
    });

    return Response.json({ ok: true, churchId, plan });
  }

  // action === 'set_suspended'
  const nextSuspended = !!suspended;
  const { error } = await supabase
    .from('churches')
    .update({ is_suspended: nextSuspended })
    .eq('id', churchId);

  if (error) {
    console.error('[super-admin/church] suspend update failed:', error.message);
    return Response.json({ error: 'Failed to update church status', code: 'WRITE_FAILED' }, { status: 500 });
  }

  await logAdminAction(supabase, {
    authUser, admin, request,
    action: nextSuspended ? 'church_suspended' : 'church_activated',
    details: { church_id: churchId, church_name: church.name }
  });

  return Response.json({ ok: true, churchId, is_suspended: nextSuspended });
}
