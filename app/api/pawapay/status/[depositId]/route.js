// Poll endpoint for the checkout modal.
//
// Reports the row's status. While still pending it also asks PawaPay directly,
// so a callback that never arrives (or a sandbox with no callback URL set) does
// not leave the payer staring at a spinner.
import { getServiceClient } from '../../../../../lib/superAdmin';
import { getPawapayConfig, fetchDepositStatus, mapDepositStatus } from '../../../../../lib/pawapay';

export async function GET(request, { params }) {
  const { depositId } = await params;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
  }

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return Response.json({ error: 'Invalid or expired session', code: 'INVALID_AUTH' }, { status: 401 });
  }

  const { data: payment } = await supabase
    .from('mobile_payments')
    .select('deposit_id, church_id, plan, status, amount, currency, provider')
    .eq('deposit_id', depositId)
    .maybeSingle();

  if (!payment) {
    return Response.json({ error: 'Payment not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // The caller must belong to the church that started the payment, so one
  // church cannot poll another's deposit.
  const { data: caller } = await supabase
    .from('church_users')
    .select('id')
    .eq('auth_id', authUser.id)
    .eq('church_id', payment.church_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!caller) {
    return Response.json({ error: 'Not your payment', code: 'FORBIDDEN' }, { status: 403 });
  }

  let status = payment.status;

  if (status === 'pending') {
    const { token: apiToken, baseUrl } = await getPawapayConfig(supabase);
    if (apiToken) {
      const upstream = await fetchDepositStatus({ token: apiToken, baseUrl, depositId });
      if (upstream.ok) {
        const mapped = mapDepositStatus(upstream.status);
        if (mapped !== 'pending') {
          status = mapped;
          await supabase
            .from('mobile_payments')
            .update({ status: mapped, completed_at: new Date().toISOString(), pawapay_response: upstream.raw })
            .eq('deposit_id', depositId)
            .eq('status', 'pending');

          if (mapped === 'completed' && payment.church_id) {
            await supabase
              .from('churches')
              .update({ plan: payment.plan, subscription_plan: payment.plan })
              .eq('id', payment.church_id);
            await supabase.from('admin_audit_log').insert({
              admin_id: null,
              admin_email: 'system@pawapay',
              action: 'plan_changed',
              details: { church_id: payment.church_id, to: payment.plan, source: 'pawapay_poll', deposit_id: depositId }
            });
          }
        }
      }
    }
  }

  return Response.json({
    depositId: payment.deposit_id,
    status,
    plan: payment.plan,
    amount: payment.amount,
    currency: payment.currency,
    provider: payment.provider
  });
}
