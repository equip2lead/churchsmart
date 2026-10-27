"use client";
// BillingSection — extracted from SettingsPage.js for code splitting
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseQuery, invalidateCache, safeGetSession, maskTokenTail, timeAgoShort, momoDeadline, momoExpired, MOMO_POLL_MS } from '../../../lib/cs-shared';
import { useLanguage, useToast } from '../../../lib/cs-contexts';
import { canAccessFeature, getPlanLimits, getPlanOrder, PLAN_PRICING, STRIPE_PRICE_IDS, isPlaceholderPriceId } from '../../../lib/featureGating';
import { listCountries, detectOperator, findOperator, localAmount, toMsisdn } from '../../../lib/pawapay';
import { Modal, FormInput, Button, LoadingSpinner } from '../../cs-ui';

function getBillingPlanLimits(planId) {
  const limits = getPlanLimits(planId);
  return {
    members: limits.maxMembers,
    admins: limits.maxAdmins,
    locations: limits.maxLocations,
    whatsapp: canAccessFeature(planId, 'messaging_whatsapp'),
    email: limits.maxEmailsPerMonth,
    sms: canAccessFeature(planId, 'sms'),
    reports: canAccessFeature(planId, 'reports_advanced') ? 'advanced' : 'basic',
    import_export: canAccessFeature(planId, 'data_import_export'),
    auto_birthday: canAccessFeature(planId, 'auto_birthday_messages'),
    multi_location: canAccessFeature(planId, 'multi_location')
  };
}

// ==========================================
// BILLING SECTION - Stripe Subscription
// ==========================================

function BillingSection({ churchId }) {
  const toast = useToast();
  const { t } = useLanguage();
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [highlightedPlan, setHighlightedPlan] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [churchPlanRow, setChurchPlanRow] = useState(null);

  // Mobile money checkout. `stage` drives the modal: the form, then the
  // waiting state while the payer confirms on their handset, then the outcome.
  const [momoPlan, setMomoPlan] = useState(null);
  const [momoStage, setMomoStage] = useState('form');
  const [momoForm, setMomoForm] = useState({ country: 'CMR', phone: '', correspondent: '' });
  const [momoDeposit, setMomoDeposit] = useState(null);
  const [momoError, setMomoError] = useState('');
  const [momoBusy, setMomoBusy] = useState(false);
  const pollRef = useRef(null);

  // Check for pre-selected plan and billing period from landing page
  useEffect(() => {
    const selectedPlan = localStorage.getItem('selected_plan');
    if (selectedPlan) {
      setHighlightedPlan(selectedPlan);
      localStorage.removeItem('selected_plan');
    }
    const selectedBilling = localStorage.getItem('selected_billing');
    if (selectedBilling === 'annual' || selectedBilling === 'monthly') {
      setBillingPeriod(selectedBilling);
      localStorage.removeItem('selected_billing');
    }
  }, []);

  // Plan cards are derived from the shared pricing table so the Billing page,
  // the gating helpers and the Stripe webhook cannot drift apart.
  // Annual pricing is ten months' worth, i.e. two months free.
  const PLAN_COPY = {
    free:    { name: 'Free',    icon: '○', members: t('plan_members_50'),  giving: t('plan_giving_basic'),     email: t('plan_email_none') },
    starter: { name: 'Starter', icon: '◔', members: t('plan_members_200'), giving: t('plan_giving_reports'),   email: t('plan_email_100') },
    growth:  { name: 'Growth',  icon: '◕', members: t('plan_members_unlimited'), giving: t('plan_giving_analytics'), email: t('plan_email_500') },
    pro:     { name: 'Pro',     icon: '●', members: t('plan_members_unlimited'), giving: t('plan_giving_export'),    email: t('plan_email_unlimited') }
  };

  const plans = getPlanOrder().map(id => {
    const price = PLAN_PRICING[id];
    const copy = PLAN_COPY[id];
    return {
      id,
      name: copy.name,
      icon: copy.icon,
      // Monthly equivalent when billed annually, for the "/mo" display.
      price: price.monthlyUsd,
      priceAnnual: Math.round((price.annualUsd / 12) * 100) / 100,
      annualTotal: price.annualUsd,
      monthlyXaf: price.monthlyXaf,
      annualXaf: price.annualXaf,
      interval: id === 'free' ? 'forever' : 'month',
      stripePriceId: STRIPE_PRICE_IDS[id]?.monthly || null,
      stripePriceIdAnnual: STRIPE_PRICE_IDS[id]?.annual || null,
      features: [
        copy.members,
        t('attendance'),
        copy.giving,
        t('events'),
        copy.email,
        ...(canAccessFeature(id, 'visitors') ? [t('visitors')] : []),
        ...(canAccessFeature(id, 'messaging_whatsapp') ? [t('whatsapp')] : []),
        ...(canAccessFeature(id, 'activity_logs') ? [t('activityLogs')] : []),
        ...(canAccessFeature(id, 'custom_reports') ? [t('plan_custom_reports')] : []),
        ...(canAccessFeature(id, 'priority_support') ? [t('plan_priority_support')] : [])
      ],
      excluded: [
        ...(canAccessFeature(id, 'visitors') ? [] : [t('visitors')]),
        ...(canAccessFeature(id, 'messaging_whatsapp') ? [] : [t('whatsapp')]),
        ...(canAccessFeature(id, 'activity_logs') ? [] : [t('activityLogs')]),
        ...(canAccessFeature(id, 'custom_reports') ? [] : [t('plan_custom_reports')]),
        ...(canAccessFeature(id, 'priority_support') ? [] : [t('plan_priority_support')])
      ]
    };
  });

  // WhatsApp credit packs removed — message limits managed by provider.

  // Trial tracking (30 days)
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(30);

  useEffect(() => {
    const checkTrial = async () => {
      if (!churchId) return;
      const church = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: churchId }], single: true });
      if (church?.created_at) {
        const created = new Date(church.created_at);
        const now = new Date();
        const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        const remaining = Math.max(0, 30 - daysSince);
        setTrialDaysLeft(remaining);
        setTrialExpired(remaining <= 0);
      }
    };
    checkTrial();
  }, [churchId]);

  useEffect(() => {
    if (churchId) loadBilling();
  }, [churchId]);

  // After returning from Stripe checkout, the webhook may take a few seconds
  // to process the payment and update the DB. Refetch billing data after a
  // short delay so the plan and subscription display correctly instead of dashes.
  useEffect(() => {
    if (!churchId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      // Clear the URL param so a manual refresh doesn't retrigger
      window.history.replaceState({}, '', window.location.pathname);
      // Give the webhook 3 seconds to process, then refetch
      const timer = setTimeout(() => {
        invalidateCache('churches');
        invalidateCache('subscriptions');
        loadBilling();
        // Also update the cached plan in localStorage
        supabaseQuery('churches', { select: 'plan', filters: [{ column: 'id', operator: 'eq', value: churchId }], single: true })
          .then(ch => {
            if (ch?.plan) {
              try { localStorage.setItem('churchsmart_plan', ch.plan.toLowerCase()); } catch (e) {}
            }
          });
        toast.info('🎉 Payment successful! Your plan has been upgraded.');
      }, 3000);
      // Also do a second refetch at 8 seconds in case the webhook was slow
      const timer2 = setTimeout(() => {
        invalidateCache('churches');
        invalidateCache('subscriptions');
        loadBilling();
      }, 8000);
      return () => { clearTimeout(timer); clearTimeout(timer2); };
    }
    if (params.get('canceled') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      toast.info('Checkout was canceled. No changes were made.');
    }
  }, [churchId]);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const [sub, hist, cred, churchRow] = await Promise.all([
        supabaseQuery('subscriptions', { filters: [{ column: 'church_id', operator: 'eq', value: churchId }], single: true }),
        supabaseQuery('payment_history', { filters: [{ column: 'church_id', operator: 'eq', value: churchId }], order: 'created_at.desc', limit: 10 }),
        supabaseQuery('message_credits', { filters: [{ column: 'church_id', operator: 'eq', value: churchId }], single: true }),
        // churches.plan is the gating source of truth, so the Billing page has
        // to read it too — a subscriptions row may not exist at all.
        supabaseQuery('churches', { select: 'id,plan', filters: [{ column: 'id', operator: 'eq', value: churchId }], single: true })
      ]);
      setChurchPlanRow(churchRow || null);
      setSubscription(sub || { plan: 'free', status: 'active' });
      setPayments(hist || []);
      setCredits(cred || null);
    } catch (err) { console.error('Billing load error:', err); }
    setLoading(false);
  };

  // Clicking Upgrade on a plan opens checkout at the payment-method choice.
  // Nothing about payment is shown until a plan has been picked.
  const handleUpgrade = (plan) => {
    if (plan.id === 'free') return;
    setMomoPlan(plan);
    setMomoStage('method');
    setMomoError('');
    setMomoDeposit(null);
    setMomoForm({ country: 'CMR', phone: '', correspondent: '' });
  };

  const startCardCheckout = async (plan) => {
    const priceId = billingPeriod === 'annual' ? plan.stripePriceIdAnnual : plan.stripePriceId;
    // Placeholder ids are rejected here: Stripe would return an opaque error
    // and the admin would have no idea the price was never configured.
    if (isPlaceholderPriceId(priceId)) {
      toast.warning(t('stripe_not_configured'));
      return;
    }

    setUpgrading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          priceId,
          planId: plan.id,
          customerEmail: JSON.parse(localStorage.getItem('churchsmart_user'))?.email
        })
      });
      const data = await response.json();
      if (data.url) {
        // assign() rather than setting location.href: the latter reads as a
        // write to an external binding and trips react-hooks/immutability.
        window.location.assign(data.url);
      } else {
        toast.error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    }
    setUpgrading(false);
  };


  // ── Mobile money ──
  // Derived from the config, so a new country or operator needs no UI change.
  const momoCountries = listCountries();
  const momoCountry = momoCountries.find(c => c.iso3 === momoForm.country) || momoCountries[0];
  const momoDetected = momoForm.phone ? detectOperator(momoForm.phone, momoForm.country) : null;
  const momoOperator = (momoForm.correspondent && findOperator(momoForm.country, momoForm.correspondent)) || momoDetected;
  const momoPhoneValid = !!toMsisdn(momoForm.phone, momoForm.country);
  const momoPriced = momoPlan
    ? localAmount(billingPeriod === 'annual' ? momoPlan.annualTotal : momoPlan.price, momoForm.country)
    : null;

  // Polling must stop when the modal closes or the component unmounts,
  // otherwise it keeps hitting the status endpoint forever.
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  const closeMomo = () => {
    stopPolling();
    setMomoPlan(null);
    setMomoStage('form');
    setMomoDeposit(null);
    setMomoError('');
  };

  const startMomoPayment = async () => {
    if (!momoPlan || !momoPhoneValid || !momoOperator) return;
    setMomoBusy(true);
    setMomoError('');
    try {
      const { data: { session } } = await safeGetSession();
      const response = await fetch('/api/pawapay/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          churchId,
          plan: momoPlan.id,
          billingPeriod,
          country: momoForm.country,
          phone: momoForm.phone,
          correspondent: momoOperator.correspondent
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMomoError(data.error || `HTTP ${response.status}`);
        setMomoStage('failed');
      } else {
        setMomoDeposit(data);
        setMomoStage('waiting');
        beginPolling(data.depositId, momoDeadline());
      }
    } catch (error) {
      setMomoError(error.message);
      setMomoStage('failed');
    }
    setMomoBusy(false);
  };

  const beginPolling = (depositId, deadline) => {
    stopPolling();

    pollRef.current = setInterval(async () => {
      if (momoExpired(deadline)) {
        stopPolling();
        setMomoStage('timeout');
        return;
      }
      try {
        const { data: { session } } = await safeGetSession();
        const response = await fetch(`/api/pawapay/status/${encodeURIComponent(depositId)}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return; // transient; the next tick retries

        if (data.status === 'completed') {
          stopPolling();
          setMomoStage('success');
          // The plan has changed server-side, so reload billing to show it.
          invalidateCache('churches');
          loadBilling();
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          stopPolling();
          setMomoError(data.status === 'cancelled' ? t('momo_cancelled') : t('momo_failed_body'));
          setMomoStage('failed');
        }
      } catch {
        // Ignore and let the next tick retry.
      }
    }, MOMO_POLL_MS);
  };

  // handleBuyCredits removed — WhatsApp message limits managed by provider.
  const handleBuyCredits = () => {
  };

  const handleManageBilling = async () => {
    if (!subscription?.stripe_customer_id) {
      toast.warning('No active subscription to manage.');
      return;
    }
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: subscription.stripe_customer_id })
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error('Failed to open billing portal');
    }
  };

  // churches.plan wins; the subscriptions row is only a fallback for churches
  // whose church row has not been read yet.
  const activePlanId = String(churchPlanRow?.plan || subscription?.plan || 'free').toLowerCase();
  const currentPlan = plans.find(p => p.id === activePlanId) || plans[0];
  const planLimits = getBillingPlanLimits(currentPlan.id);
  // WhatsApp message limits are now managed by the third-party provider.

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Trial Warning Banner */}
      {currentPlan.id === 'free' && trialExpired && (
        <div style={{ backgroundColor: '#fef2f2', borderRadius: '16px', padding: '20px', border: '2px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '36px' }}>⚠️</div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#991b1b' }}>Your 30-day free trial has ended</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>Upgrade to continue using ChurchSmart. Your data is safe.</p>
          </div>
          <button onClick={() => handleUpgrade(plans[2])} style={{ padding: '10px 24px', border: 'none', borderRadius: '10px', backgroundColor: '#dc2626', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Upgrade Now
          </button>
        </div>
      )}

      {/* Trial Ending Soon */}
      {currentPlan.id === 'free' && !trialExpired && trialDaysLeft <= 7 && (
        <div style={{ backgroundColor: '#fffbeb', borderRadius: '16px', padding: '16px 20px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>⏰</div>
          <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
            <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</strong> on your free trial. Upgrade to keep all features.
          </p>
        </div>
      )}

      {/* Pre-selected Plan CTA */}
      {highlightedPlan && (() => {
        const hp = plans.find(p => p.id === highlightedPlan);
        if (!hp || hp.id === currentPlan.id) return null;
        return (
          <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #10b981', borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#166534' }}>You selected the {hp.name} plan</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#15803d' }}>Subscribe now to unlock all {hp.name} features for your church.</p>
            </div>
            <button onClick={() => handleUpgrade(hp)} disabled={upgrading} style={{ padding: '14px 32px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {upgrading ? '⏳ Redirecting...' : `Subscribe to ${hp.name} — $${billingPeriod === 'annual' ? hp.priceAnnual : hp.price}/mo${billingPeriod === 'annual' ? ` (${t('billedAnnually')})` : ''}`}
            </button>
          </div>
        );
      })()}

      {/* Current Plan Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>💳 Current Plan</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{t('manageSubscription')}</p>
          </div>
          {subscription?.stripe_customer_id && (
            <button onClick={handleManageBilling} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>
              🔗 Manage in Stripe
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', backgroundColor: '#f0f0ff', borderRadius: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '40px' }}>{currentPlan.icon}</div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#4338ca' }}>{currentPlan.name} Plan</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              {currentPlan.price === 0
                ? (trialExpired ? 'Trial ended — please upgrade' : `Free trial • ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`)
                : `$${currentPlan.price}/month`}
              {subscription?.cancel_at_period_end && ' • Cancels at period end'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600',
              backgroundColor: subscription?.status === 'active' || subscription?.status === 'trialing' ? '#d1fae5' : subscription?.status === 'past_due' ? '#fef3c7' : '#fee2e2',
              color: subscription?.status === 'active' || subscription?.status === 'trialing' ? '#065f46' : subscription?.status === 'past_due' ? '#92400e' : '#991b1b'
            }}>
              {(subscription?.status || 'active').toUpperCase()}
            </span>
            {subscription?.current_period_end && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Billing cycle / next payment / method on file. Only meaningful once
            a paid subscription exists. */}
        {currentPlan.id !== 'free' && (
          <div className="cs-dash-stats" style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #c7d2fe' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6366f1', fontWeight: '600' }}>{t('billing_cycle')}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#312e81' }}>
                {subscription?.current_period_start && subscription?.current_period_end
                  ? `${new Date(subscription.current_period_start).toLocaleDateString()} – ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : '—'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6366f1', fontWeight: '600' }}>{t('next_payment')}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#312e81' }}>
                {subscription?.cancel_at_period_end
                  ? t('cancels_at_period_end')
                  : (subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—')}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6366f1', fontWeight: '600' }}>{t('payment_method_on_file')}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#312e81' }}>
                {/* Card details live in Stripe; only the provider is known here. */}
                {subscription?.stripe_customer_id
                  ? `💳 ${t('pay_with_card')}`
                  : (subscription?.payment_provider === 'pawapay' ? `📱 ${t('pay_with_mobile_money')}` : '—')}
              </p>
            </div>
          </div>
        )}
      </div>


      {/* ── Mobile money checkout ── */}
      <Modal
        isOpen={!!momoPlan}
        onClose={closeMomo}
        title={momoStage === 'method'
          ? `⬆️ ${t('plan_upgrade_to')} ${momoPlan?.name || ''}`
          : `📱 ${t('pay_with_mobile_money')}`}
        width="440px"
      >
        {/* Plan summary, shared by the method choice and the momo form. */}
        {momoPlan && ['method', 'form'].includes(momoStage) && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#eef2ff', marginBottom: '18px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#4338ca', fontWeight: '600' }}>
              {momoPlan.name} · {billingPeriod === 'annual' ? t('billedAnnually') : t('monthly')}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: '700', color: '#312e81' }}>
              ${billingPeriod === 'annual' ? momoPlan.annualTotal : momoPlan.price}
              <span style={{ fontSize: '13px', fontWeight: '500' }}> USD{billingPeriod === 'annual' ? `/${t('sa_year') || 'yr'}` : `/${t('month') || 'mo'}`}</span>
            </p>
            {/* Local equivalent only matters once a country is in play. */}
            {momoStage === 'form' && momoPriced && (
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6366f1' }}>
                ≈ {momoPriced.currency} {Number(momoPriced.amount).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* ── Stage 1 · how do you want to pay ── */}
        {momoStage === 'method' && momoPlan && (
          <>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>{t('payment_method')}</label>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => startCardCheckout(momoPlan)}
                disabled={upgrading}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', cursor: upgrading ? 'wait' : 'pointer', textAlign: 'left', border: '1px solid #e5e7eb', backgroundColor: 'white' }}
              >
                <span style={{ fontSize: '22px' }}>💳</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151' }}>{t('pay_with_card')}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#9ca3af' }}>{t('pay_with_card_hint')}</span>
                </span>
                <span style={{ fontSize: '14px', color: '#9ca3af' }}>{upgrading ? '⏳' : '→'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMomoStage('form')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid #e5e7eb', backgroundColor: 'white' }}
              >
                <span style={{ fontSize: '22px' }}>📱</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151' }}>{t('pay_with_mobile_money')}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#9ca3af' }}>{t('pay_with_momo_hint')}</span>
                </span>
                <span style={{ fontSize: '14px', color: '#9ca3af' }}>→</span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={closeMomo}>{t('cancel')}</Button>
            </div>
          </>
        )}

        {/* ── Stage 2 · mobile money details ── */}
        {momoStage === 'form' && momoPlan && (
          <>
            <FormInput
              label={t('momo_country')}
              type="select"
              value={momoForm.country}
              onChange={(e) => setMomoForm({ ...momoForm, country: e.target.value, correspondent: '' })}
              options={momoCountries.map(c => ({ value: c.iso3, label: `${c.name} (+${c.dial})` }))}
            />

            <FormInput
              label={`${t('momo_phone')} *`}
              type="tel"
              value={momoForm.phone}
              onChange={(e) => setMomoForm({ ...momoForm, phone: e.target.value, correspondent: '' })}
              placeholder={`+${momoCountry?.dial} ...`}
            />
            {momoForm.phone && !momoPhoneValid && (
              <p style={{ margin: '-10px 0 16px 0', fontSize: '12px', color: '#dc2626' }}>{t('momo_phone_invalid')}</p>
            )}

            {/* Auto-detected, but always overridable: prefix rules go stale. */}
            <FormInput
              label={t('momo_provider')}
              type="select"
              value={momoOperator?.correspondent || ''}
              onChange={(e) => setMomoForm({ ...momoForm, correspondent: e.target.value })}
              options={(momoCountry?.operators || []).map(o => ({ value: o.correspondent, label: o.name }))}
            />
            {momoDetected && !momoForm.correspondent && (
              <p style={{ margin: '-10px 0 16px 0', fontSize: '12px', color: '#16a34a' }}>
                ✓ {t('momo_detected').replace('{provider}', momoDetected.name)}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setMomoStage('method')}>{t('back')}</Button>
              <Button onClick={startMomoPayment} disabled={momoBusy || !momoPhoneValid || !momoOperator}>
                {momoBusy ? '⏳' : `📲 ${t('momo_pay_now')}`}
              </Button>
            </div>
          </>
        )}

        {momoStage === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '44px', margin: '0 0 12px' }}>⏳</p>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>{t('momo_waiting_title')}</h4>
            <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>{t('momo_waiting_body')}</p>
            {momoDeposit && (
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#374151', fontWeight: '600' }}>
                {momoDeposit.provider} · {momoDeposit.phone}
              </p>
            )}
            <div style={{ height: '4px', borderRadius: '2px', overflow: 'hidden', backgroundColor: '#eef2ff', marginBottom: '18px' }}>
              <div className="cs-skeleton" style={{ height: '100%', borderRadius: '2px' }} />
            </div>
            <Button variant="secondary" onClick={closeMomo}>{t('momo_close')}</Button>
          </div>
        )}

        {momoStage === 'success' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '44px', margin: '0 0 12px' }}>✅</p>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#166534' }}>
              {t('momo_success_title').replace('{plan}', momoPlan?.name || '')}
            </h4>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#6b7280' }}>{t('momo_success_body')}</p>
            <Button onClick={closeMomo}>{t('momo_done')}</Button>
          </div>
        )}

        {momoStage === 'failed' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '44px', margin: '0 0 12px' }}>❌</p>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#991b1b' }}>{t('momo_failed_title')}</h4>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', wordBreak: 'break-word' }}>{momoError || t('momo_failed_body')}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={closeMomo}>{t('cancel')}</Button>
              <Button onClick={() => { setMomoStage('form'); setMomoError(''); }}>{t('momo_try_again')}</Button>
            </div>
          </div>
        )}

        {momoStage === 'timeout' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '44px', margin: '0 0 12px' }}>⌛</p>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#92400e' }}>{t('momo_timeout_title')}</h4>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>{t('momo_timeout_body')}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={closeMomo}>{t('momo_close')}</Button>
              {/* Re-checks the SAME deposit rather than creating another one,
                  so a payment already approved on the handset is not charged
                  twice. */}
              {momoDeposit?.depositId && (
                <Button onClick={() => { setMomoStage('waiting'); beginPolling(momoDeposit.depositId, momoDeadline()); }}>
                  {t('momo_check_again')}
                </Button>
              )}
              <Button variant="secondary" onClick={() => { setMomoStage('form'); setMomoError(''); setMomoDeposit(null); }}>{t('momo_try_again')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* WhatsApp Feature Status */}
      {planLimits.whatsapp && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💬 WhatsApp Messaging</h3>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#10b981', backgroundColor: '#d1fae5', padding: '4px 12px', borderRadius: '50px' }}>✓ Enabled</span>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            WhatsApp messaging is available on your plan. Message limits are managed by your WhatsApp provider. Configure your provider in the WhatsApp settings tab.
          </p>
        </div>
      )}

      {/* Plans Grid */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📦 Available Plans</h3>
          {/* Monthly / Annual Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              onClick={() => setBillingPeriod('monthly')}
              style={{ fontSize: '14px', fontWeight: billingPeriod === 'monthly' ? '700' : '500', color: billingPeriod === 'monthly' ? '#111827' : '#9ca3af', cursor: 'pointer' }}
            >
              {t('monthlyLabel')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === 'annual'}
              onClick={() => setBillingPeriod(billingPeriod === 'annual' ? 'monthly' : 'annual')}
              style={{
                position: 'relative', width: '44px', height: '24px', borderRadius: '9999px',
                border: 'none', cursor: 'pointer', padding: 0,
                backgroundColor: billingPeriod === 'annual' ? '#6366f1' : '#d1d5db',
                transition: 'background-color 0.2s'
              }}
            >
              <span style={{
                position: 'absolute', top: '2px', left: billingPeriod === 'annual' ? '22px' : '2px',
                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span
              onClick={() => setBillingPeriod('annual')}
              style={{ fontSize: '14px', fontWeight: billingPeriod === 'annual' ? '700' : '500', color: billingPeriod === 'annual' ? '#111827' : '#9ca3af', cursor: 'pointer' }}
            >
              {t('annualLabel')}
            </span>
            <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#166534' }}>
              {t('save20')}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan.id;
            const isDowngrade = plans.indexOf(plan) < plans.indexOf(currentPlan);
            const isHighlighted = plan.id === highlightedPlan;
            return (
              <div key={plan.id} id={`plan-${plan.id}`} ref={isHighlighted ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); } : undefined} style={{
                border: isHighlighted ? '2px solid #10b981' : plan.popular ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '16px', padding: '24px', position: 'relative',
                backgroundColor: isCurrent ? '#fafaff' : isHighlighted ? '#f0fdf4' : 'white',
                opacity: isDowngrade ? 0.6 : 1,
                boxShadow: isHighlighted ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none'
              }}>
                {isHighlighted && !isCurrent && (
                  <div style={{ position: 'absolute', top: '-12px', right: '16px', backgroundColor: '#10b981', color: 'white', padding: '2px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600' }}>
                    SELECTED
                  </div>
                )}
                {plan.popular && !isHighlighted && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#6366f1', color: 'white', padding: '2px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600' }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '18px', marginBottom: '8px', color: '#6366f1', letterSpacing: '4px' }}>{plan.icon}</div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>{plan.name}</h4>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#111827' }}>
                    {plan.price === 0 ? 'Free' : `$${billingPeriod === 'annual' && plan.priceAnnual ? plan.priceAnnual : plan.price}`}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>
                    {plan.price === 0 ? '30-day trial' : (billingPeriod === 'annual' && plan.priceAnnual ? `per month, ${t('billedAnnually')}` : 'per month')}
                  </p>
                  {billingPeriod === 'annual' && plan.annualTotal > 0 && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
                      ${plan.annualTotal}/{t('perYearSave')} ${(plan.price * 12 - plan.annualTotal)})
                    </p>
                  )}
                </div>
                <div style={{ marginBottom: '20px' }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '3px 0', fontSize: '12px', color: '#4b5563' }}>
                      <span style={{ color: '#10b981', marginTop: '1px' }}>✓</span> <span>{f}</span>
                    </div>
                  ))}
                  {(plan.excluded || []).map((f, i) => (
                    <div key={`ex-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '3px 0', fontSize: '12px', color: '#d1d5db' }}>
                      <span style={{ marginTop: '1px' }}>✗</span> <span>{f}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <button disabled style={{ width: '100%', padding: '10px', border: '2px solid #6366f1', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#6366f1', fontWeight: '600', fontSize: '14px', cursor: 'default' }}>
                    {plan.id === 'free' && trialExpired
                      ? `⏰ ${t('trialEnded')}`
                      : plan.id === 'free' && trialDaysLeft > 0
                        ? `✅ ${t('plan_current')} · ${trialDaysLeft}d`
                        : `✅ ${t('plan_current')}`}
                  </button>
                ) : isDowngrade ? (
                  /* Downgrades are not self-serve: Stripe handles them through
                     the billing portal, so this points at support instead of
                     pretending to start one. */
                  <button disabled title={t('plan_downgrade_hint')} style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: '#f9fafb', color: '#9ca3af', fontSize: '14px', cursor: 'not-allowed' }}>
                    {t('plan_contact_support')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={upgrading}
                    style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '10px', backgroundColor: plan.popular ? '#4f46e5' : '#111827', color: 'white', fontWeight: '600', fontSize: '14px', cursor: upgrading ? 'wait' : 'pointer' }}
                  >
                    {upgrading ? '⏳' : `${t('plan_upgrade_to')} ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: '16px 0 0 0', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
          💳 No credit card required for free plan • Cancel anytime • 30-day money-back guarantee
        </p>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🧾 Payment History</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{p.description || `${(p.plan || '').charAt(0).toUpperCase() + (p.plan || '').slice(1)} Plan`}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600' }}>${((p.amount || 0) / 100).toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600',
                      backgroundColor: p.status === 'succeeded' ? '#d1fae5' : '#fee2e2',
                      color: p.status === 'succeeded' ? '#065f46' : '#991b1b'
                    }}>{p.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '13px' }}>View ↗</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export default BillingSection;
