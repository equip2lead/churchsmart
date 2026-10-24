import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { STRIPE_PRICE_IDS } from '../../../../lib/featureGating';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// WhatsApp messaging is gated by the 'messaging_whatsapp' feature (Growth+).
// Message volume limits are managed by the third-party WhatsApp provider,
// not by ChurchSmart — so there is no credit/quota system here.

// Stripe Price ID → Plan ID mapping.
// Built from the shared price table (monthly + annual per tier) plus the
// original single-price env vars, so existing subscriptions keep resolving.
// Placeholder ids are excluded: leaving them in would let an unrelated price
// resolve to a paid plan once real ids are configured.
const PRICE_TO_PLAN = (() => {
  const map = {};
  const add = (priceId, plan) => {
    if (priceId && !String(priceId).includes('_placeholder')) map[priceId] = plan;
  };
  for (const plan of ['starter', 'growth', 'pro']) {
    add(STRIPE_PRICE_IDS[plan]?.monthly, plan);
    add(STRIPE_PRICE_IDS[plan]?.annual, plan);
  }
  add(process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER, 'starter');
  add(process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH, 'growth');
  add(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO, 'pro');
  return map;
})();

export async function POST(request) {
  const stripe = getStripe();
  const supabase = getSupabase();

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabase, event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    return Response.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return Response.json({ received: true });
}


// ──────────────────────────────────────────
// CHECKOUT COMPLETED
// ──────────────────────────────────────────
async function handleCheckoutCompleted(supabase, session) {
  const churchId = session.metadata?.church_id;
  if (!churchId) return;

  // Handle one-time credit purchase
  if (session.metadata?.type === 'credit_purchase') {
    const credits = parseInt(session.metadata.credits || '0', 10);
    if (credits > 0) {
      await addBonusCredits(supabase, churchId, credits);

      // Record payment
      await supabase.from('payment_history').insert({
        church_id: churchId,
        stripe_payment_intent_id: session.payment_intent,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'succeeded',
        description: `WhatsApp credit pack: ${credits} messages`
      });
    }
    return;
  }

  // Handle subscription checkout
  const planId = session.metadata?.plan_id || 'starter';
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  // Upsert subscription
  await supabase.from('subscriptions').upsert({
    church_id: churchId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan: planId,
    status: 'active'
  }, { onConflict: 'church_id' });

  // Update church plan
  await supabase
    .from('churches')
    // plan is what feature gating reads; subscription_plan is kept in step
    // for the legacy readers that still reference it.
    .update({ plan: planId, subscription_plan: planId, stripe_customer_id: customerId })
    .eq('id', churchId);

}


// ──────────────────────────────────────────
// SUBSCRIPTION UPDATED (plan change, renewal)
// ──────────────────────────────────────────
async function handleSubscriptionUpdated(supabase, subscription) {
  const churchId = subscription.metadata?.church_id;
  if (!churchId) return;

  // Determine plan from price
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planId = PRICE_TO_PLAN[priceId] || subscription.metadata?.plan_id || 'free';

  const status = subscription.status;

  // Update subscription record
  await supabase.from('subscriptions').upsert({
    church_id: churchId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    plan: planId,
    status: status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
  }, { onConflict: 'church_id' });

  // Update church plan
  await supabase
    .from('churches')
    .update({ plan: planId, subscription_plan: planId })
    .eq('id', churchId);

}


// ──────────────────────────────────────────
// SUBSCRIPTION DELETED (canceled)
// ──────────────────────────────────────────
async function handleSubscriptionDeleted(supabase, subscription) {
  const churchId = subscription.metadata?.church_id;
  if (!churchId) return;

  // Revert to free
  await supabase.from('subscriptions').upsert({
    church_id: churchId,
    stripe_subscription_id: null,
    plan: 'free',
    status: 'canceled',
    cancel_at_period_end: false
  }, { onConflict: 'church_id' });

  await supabase
    .from('churches')
    .update({ plan: 'free', subscription_plan: 'free' })
    .eq('id', churchId);

  // Zero out monthly allowance (keep bonus_credits until used)
  await supabase
    .from('message_credits')
    .update({ monthly_whatsapp_allowance: 0 })
    .eq('church_id', churchId);
}


// ──────────────────────────────────────────
// PAYMENT SUCCEEDED
// ──────────────────────────────────────────
async function handlePaymentSucceeded(supabase, invoice) {
  const churchId = invoice.subscription_details?.metadata?.church_id
    || invoice.metadata?.church_id;
  if (!churchId) return;

  const priceId = invoice.lines?.data?.[0]?.price?.id;
  const planId = PRICE_TO_PLAN[priceId] || 'unknown';

  await supabase.from('payment_history').insert({
    church_id: churchId,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent,
    amount: invoice.amount_paid || 0,
    currency: invoice.currency || 'usd',
    status: 'succeeded',
    plan: planId,
    description: invoice.description || `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
    invoice_url: invoice.hosted_invoice_url,
    receipt_url: invoice.receipt_url
  });
}


// ──────────────────────────────────────────
// PAYMENT FAILED
// ──────────────────────────────────────────
async function handlePaymentFailed(supabase, invoice) {
  const churchId = invoice.subscription_details?.metadata?.church_id
    || invoice.metadata?.church_id;
  if (!churchId) return;

  await supabase.from('payment_history').insert({
    church_id: churchId,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_due || 0,
    currency: invoice.currency || 'usd',
    status: 'failed',
    description: 'Payment failed'
  });

  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', invoice.subscription);
  }
}


// WhatsApp credit/quota management removed — message limits are now handled
// by the third-party WhatsApp provider chosen by the church admin.


// ──────────────────────────────────────────
// HELPER: Add bonus credits from purchase
// ──────────────────────────────────────────
async function addBonusCredits(supabase, churchId, credits) {
  const { data: existing } = await supabase
    .from('message_credits')
    .select('id, bonus_credits, whatsapp_credits')
    .eq('church_id', churchId)
    .single();

  if (existing) {
    await supabase
      .from('message_credits')
      .update({
        bonus_credits: (existing.bonus_credits || 0) + credits,
        whatsapp_credits: (existing.whatsapp_credits || 0) + credits
      })
      .eq('church_id', churchId);
  } else {
    await supabase
      .from('message_credits')
      .insert({
        church_id: churchId,
        bonus_credits: credits,
        whatsapp_credits: credits
      });
  }
}
