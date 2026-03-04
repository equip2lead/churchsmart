import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Plan → WhatsApp monthly allowance mapping
const PLAN_WHATSAPP_ALLOWANCE = {
  free: 0,
  starter: 0,
  growth: 100,
  pro: 500
};

// Stripe Price ID → Plan ID mapping
const PRICE_TO_PLAN = {
  'price_1T7IMDAKBjsQAW9nAhSH5F2c': 'starter',
  'price_1T7IMlAKBjsQAW9n6EEg6WvD': 'growth',
  'price_1T7INOAKBjsQAW9nwuq2yOMV': 'pro'
};

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
    .update({ subscription_plan: planId, stripe_customer_id: customerId })
    .eq('id', churchId);

  // Initialize/update message credits for new plan
  await updateCreditsForPlan(supabase, churchId, planId);
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
    .update({ subscription_plan: planId })
    .eq('id', churchId);

  // Update credits if plan changed
  await updateCreditsForPlan(supabase, churchId, planId);
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
    .update({ subscription_plan: 'free' })
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


// ──────────────────────────────────────────
// HELPER: Update credits when plan changes
// ──────────────────────────────────────────
async function updateCreditsForPlan(supabase, churchId, planId) {
  const allowance = PLAN_WHATSAPP_ALLOWANCE[planId] || 0;

  // Check if record exists
  const { data: existing } = await supabase
    .from('message_credits')
    .select('id, bonus_credits')
    .eq('church_id', churchId)
    .single();

  if (existing) {
    await supabase
      .from('message_credits')
      .update({
        monthly_whatsapp_allowance: allowance,
        whatsapp_credits: allowance + (existing.bonus_credits || 0),
        whatsapp_used_this_month: 0,
        last_reset_date: new Date().toISOString().split('T')[0]
      })
      .eq('church_id', churchId);
  } else {
    await supabase
      .from('message_credits')
      .insert({
        church_id: churchId,
        monthly_whatsapp_allowance: allowance,
        whatsapp_credits: allowance,
        whatsapp_used_this_month: 0
      });
  }
}


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
