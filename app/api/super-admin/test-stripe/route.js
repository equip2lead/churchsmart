// Verify the stored (or env) Stripe secret key by retrieving the account.
import Stripe from 'stripe';
import { requireSuperAdmin, getPlatformSetting } from '../../../../lib/superAdmin';

export async function POST(request) {
  const gate = await requireSuperAdmin(request, 'view_payment_settings');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  // platform_settings wins; the existing env var is the fallback so a key that
  // was never entered through the UI still tests green.
  const secretKey = await getPlatformSetting(supabase, 'stripe_sk', 'STRIPE_SECRET_KEY');
  if (!secretKey) {
    return Response.json({ connected: false, error: 'No Stripe secret key configured', code: 'NO_KEY' }, { status: 200 });
  }

  try {
    const stripe = new Stripe(secretKey);
    const account = await stripe.accounts.retrieve();
    return Response.json({
      connected: true,
      // Enough to confirm which account answered, with no credential echoed.
      accountId: account.id,
      livemode: !!account.charges_enabled && !String(secretKey).startsWith('sk_test'),
      country: account.country || null,
      businessName: account.business_profile?.name || account.settings?.dashboard?.display_name || null
    });
  } catch (error) {
    // Stripe's message names the failure (bad key, revoked, wrong mode).
    return Response.json({ connected: false, error: error?.message || 'Stripe rejected the key', code: 'STRIPE_ERROR' }, { status: 200 });
  }
}
