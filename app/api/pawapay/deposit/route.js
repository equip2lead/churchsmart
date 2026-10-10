// Start a mobile money payment for a plan.
//
// The row is written BEFORE PawaPay is called: the callback can arrive while
// this request is still in flight, and it must find a row to update.
import crypto from 'crypto';
import { getServiceClient } from '../../../../lib/superAdmin';
import {
  PAWAPAY_COUNTRIES, toMsisdn, detectOperator, findOperator,
  localAmount, getPawapayConfig, createDeposit
} from '../../../../lib/pawapay';
import { PLAN_PRICING, getPlanOrder } from '../../../../lib/featureGating';

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[pawapay-deposit ${reqId}]`;

  try {
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

    const body = await request.json().catch(() => ({}));
    const { churchId, plan, billingPeriod = 'monthly', country, phone } = body;

    if (!churchId || !plan || !country || !phone) {
      return Response.json({ error: 'churchId, plan, country and phone are required', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    // Only a church ADMIN may start a payment for their own church.
    const { data: caller } = await supabase
      .from('church_users')
      .select('id, role, church_id')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!caller) {
      return Response.json({ error: 'You are not a member of this church', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }
    if (caller.role !== 'ADMIN') {
      return Response.json({ error: 'Only church admins can pay for a plan', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }

    // ── Validate the order ──
    if (!getPlanOrder().includes(plan) || plan === 'free') {
      return Response.json({ error: 'Choose a paid plan', code: 'INVALID_PLAN' }, { status: 400 });
    }
    if (!['monthly', 'annual'].includes(billingPeriod)) {
      return Response.json({ error: 'Invalid billing period', code: 'INVALID_PERIOD' }, { status: 400 });
    }
    const countryConfig = PAWAPAY_COUNTRIES[country];
    if (!countryConfig) {
      return Response.json({ error: 'Unsupported country', code: 'INVALID_COUNTRY' }, { status: 400 });
    }

    const msisdn = toMsisdn(phone, country);
    if (!msisdn) {
      return Response.json({ error: 'That phone number is not valid for the selected country', code: 'INVALID_PHONE' }, { status: 400 });
    }

    // An explicit choice wins; otherwise fall back to the detected operator.
    const operator = (body.correspondent && findOperator(country, body.correspondent))
      || detectOperator(phone, country);
    if (!operator) {
      return Response.json({ error: 'Could not determine the mobile money operator', code: 'NO_OPERATOR' }, { status: 400 });
    }

    const usd = billingPeriod === 'annual' ? PLAN_PRICING[plan].annualUsd : PLAN_PRICING[plan].monthlyUsd;
    const priced = localAmount(usd, country);
    if (!priced) {
      return Response.json({ error: 'Could not price this plan locally', code: 'PRICING_FAILED' }, { status: 400 });
    }

    const { token: apiToken, baseUrl, mode } = await getPawapayConfig(supabase);
    if (!apiToken) {
      return Response.json({ error: 'Mobile money is not configured on the server', code: 'PAWAPAY_NOT_CONFIGURED' }, { status: 503 });
    }

    const depositId = crypto.randomUUID();

    const { error: insertError } = await supabase.from('mobile_payments').insert({
      church_id: churchId,
      deposit_id: depositId,
      amount: priced.amount,
      currency: priced.currency,
      country_code: country,
      provider: operator.name,
      correspondent: operator.correspondent,
      phone: msisdn,
      plan,
      billing_period: billingPeriod,
      status: 'pending'
    });
    if (insertError) {
      console.error(`${tag} insert failed:`, insertError.message);
      return Response.json({ error: 'Could not record the payment', code: 'WRITE_FAILED' }, { status: 500 });
    }

    const result = await createDeposit({
      token: apiToken,
      baseUrl,
      depositId,
      amount: priced.amount,
      currency: priced.currency,
      correspondent: operator.correspondent,
      msisdn,
      statementDescription: 'ChurchSmart',
      metadata: [{ fieldName: 'churchId', fieldValue: churchId }, { fieldName: 'plan', fieldValue: plan }]
    });

    if (!result.ok) {
      await supabase
        .from('mobile_payments')
        .update({ status: 'failed', pawapay_response: result.raw, completed_at: new Date().toISOString() })
        .eq('deposit_id', depositId);
      console.log(`${tag} rejected church=${churchId} reason=${result.error}`);
      return Response.json({ error: result.error, code: 'DEPOSIT_REJECTED', depositId }, { status: 502 });
    }

    await supabase.from('mobile_payments').update({ pawapay_response: result.raw }).eq('deposit_id', depositId);

    console.log(`${tag} accepted church=${churchId} plan=${plan} ${priced.currency} ${priced.amount} mode=${mode}`);

    return Response.json({
      depositId,
      status: 'pending',
      amount: priced.amount,
      currency: priced.currency,
      provider: operator.name,
      phone: msisdn
    });
  } catch (error) {
    console.error(`${tag} unhandled`, error);
    return Response.json({ error: 'Could not start the payment', code: 'UNHANDLED' }, { status: 500 });
  }
}
