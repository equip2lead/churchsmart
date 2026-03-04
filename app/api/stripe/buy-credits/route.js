import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { churchId, priceId, credits, customerEmail } = await request.json();

    if (!churchId || !priceId || !credits) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create Stripe customer
    const { data: church } = await supabase
      .from('churches')
      .select('stripe_customer_id, name')
      .eq('id', churchId)
      .single();

    let customerId = church?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { church_id: churchId, church_name: church?.name || '' }
      });
      customerId = customer.id;

      await supabase
        .from('churches')
        .update({ stripe_customer_id: customerId })
        .eq('id', churchId);
    }

    // Create one-time checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}?section=settings&tab=billing&credits=purchased`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}?section=settings&tab=billing`,
      metadata: {
        church_id: churchId,
        type: 'credit_purchase',
        credits: String(credits)
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Buy credits error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
