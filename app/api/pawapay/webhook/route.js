// PawaPay deposit callback.
//
// The request body is NOT trusted. Anyone can POST here, and acting on a
// body-supplied "COMPLETED" would be a free-upgrade vector: the outcome is
// re-read from PawaPay's own API using the deposit id, and only that decides
// whether a plan changes.
//
// Always answers 200 so PawaPay does not retry forever on our own faults.
import { getServiceClient } from '../../../../lib/superAdmin';
import { getPawapayConfig, fetchDepositStatus, mapDepositStatus, sanitizePawapayPayload } from '../../../../lib/pawapay';

export async function POST(request) {
  const tag = '[pawapay-webhook]';
  try {
    const supabase = getServiceClient();
    if (!supabase) {
      console.error(`${tag} missing supabase env`);
      return Response.json({ received: true });
    }

    const body = await request.json().catch(() => null);
    const depositId = body?.depositId || body?.deposit_id;
    if (!depositId) {
      console.log(`${tag} callback with no depositId`);
      return Response.json({ received: true });
    }

    const { data: payment } = await supabase
      .from('mobile_payments')
      .select('id, church_id, plan, status, deposit_id, amount, currency')
      .eq('deposit_id', depositId)
      .maybeSingle();

    if (!payment) {
      console.log(`${tag} unknown depositId=${depositId}`);
      return Response.json({ received: true });
    }
    // Already settled: callbacks can be delivered more than once, and a plan
    // must not be re-applied (or a refund-then-replay re-upgrade a church).
    if (payment.status !== 'pending') {
      return Response.json({ received: true });
    }

    const { token, baseUrl } = await getPawapayConfig(supabase);
    if (!token) {
      console.error(`${tag} no PawaPay token; cannot verify depositId=${depositId}`);
      return Response.json({ received: true });
    }

    const verified = await fetchDepositStatus({ token, baseUrl, depositId });
    if (!verified.ok) {
      console.error(`${tag} verification failed for ${depositId}: ${verified.error}`);
      return Response.json({ received: true });
    }

    const status = mapDepositStatus(verified.status);
    if (status === 'pending') {
      // Still in flight upstream; leave the row alone and wait.
      return Response.json({ received: true });
    }

    await supabase
      .from('mobile_payments')
      .update({
        status,
        completed_at: new Date().toISOString(),
        pawapay_response: verified.raw ?? sanitizePawapayPayload(body)
      })
      .eq('deposit_id', depositId);

    if (status === 'completed' && payment.church_id) {
      // churches.plan is what feature gating reads; subscription_plan is kept
      // in step, as the Stripe webhook does.
      const { error: planError } = await supabase
        .from('churches')
        .update({ plan: payment.plan, subscription_plan: payment.plan })
        .eq('id', payment.church_id);

      if (planError) {
        console.error(`${tag} plan update failed for ${payment.church_id}:`, planError.message);
      } else {
        await supabase.from('admin_audit_log').insert({
          admin_id: null,
          admin_email: 'system@pawapay',
          action: 'plan_changed',
          details: {
            church_id: payment.church_id,
            to: payment.plan,
            source: 'pawapay',
            deposit_id: depositId,
            amount: payment.amount,
            currency: payment.currency
          }
        });
      }
    }

    console.log(`${tag} ${depositId} -> ${status}`);
    return Response.json({ received: true });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ received: true });
  }
}
