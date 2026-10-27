"use client";
// SettingsPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject, isValidEmail, uploadPhoto, invalidateCache, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY, WHATSAPP_MAX_CHARS, WHATSAPP_SETUP_GUIDE_URL, maskTokenTail, timeAgoShort, momoDeadline, momoExpired, MOMO_POLL_MS } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions, ROLE_ACCESS } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits, getEmailLimit, getRequiredPlan, getPlanOrder, comparePlans, PLAN_PRICING, STRIPE_PRICE_IDS, isPlaceholderPriceId } from '../../lib/featureGating';
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES, roleLabel, pawapayBaseUrl, isHardcodedSuperAdmin } from '../../lib/superAdmin';
import { listCountries, detectOperator, findOperator, localAmount, toMsisdn } from '../../lib/pawapay';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, StatCard, SMSModal, exportToCSV, MemberProfile, SearchInput, PaginatedList, AccessDenied, PermissionGate } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';
import Papa from 'papaparse';

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
      const { data: { session } } = await supabase.auth.getSession();
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
        const { data: { session } } = await supabase.auth.getSession();
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

// ==========================================
// WHATSAPP LOG PAGE
// ==========================================
// Every delivery attempt, successful or not, from whatsapp_send_log.
// Admin-only: the table's RLS grants SELECT to church admins only, so a
// non-admin would simply read an empty list.

function SettingsPage({ plan, onNavigate }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const CHURCH_ID = user?.church_id;
  const { t, language, changeLanguage } = useLanguage();
  const [church, setChurch] = useState(null);
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [automationSettings, setAutomationSettings] = useState([]);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('selected_plan')) return 'billing';
    return 'general';
  });
  const [editingChurch, setEditingChurch] = useState(false);
  const [churchForm, setChurchForm] = useState({});
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current: '', new_password: '', confirm: '' });
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showExpCategoryModal, setShowExpCategoryModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingExpCategory, setEditingExpCategory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Expense categories, plus the lowercased category names actually referenced
  // by this church's expenses. expenses.category holds the category NAME (no
  // FK), so that name list is what tells us a category is still in use.
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [usedExpenseCategoryNames, setUsedExpenseCategoryNames] = useState([]);
  const [expCategoryForm, setExpCategoryForm] = useState({ name: '', description: '' });

  // expense_categories writes are admin-only at the RLS layer.
  const isChurchAdmin = user?.role === 'ADMIN' || !!user?.is_super_admin;

  // WhatsApp is sent through each church's own Wamatas instance. Credentials
  // live on whatsapp_config: api_token is the access token and phone_number_id
  // is repurposed to hold the Wamatas instance id.
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState({ provider: 'wamatas', access_token: '', instance_id: '' });
  const [showToken, setShowToken] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  // Result of a test fired in this session, so the message id can be shown.
  const [testResult, setTestResult] = useState(null);
  const whatsappAvailable = canAccessFeature(plan, 'messaging_whatsapp');
  // The saved token is never sent to the browser, only its last 4 characters.
  const hasSavedCredentials = !!(whatsappConfig?.api_token_last4 && whatsappConfig?.phone_number_id);
  // A config row can predate this provider (is_active = true from the earlier
  // platform-account model) yet hold no Wamatas credentials. Such a row cannot
  // send, so it must not be reported as active.
  const whatsappConnected = !!whatsappConfig?.is_active && hasSavedCredentials;
  // 'config' = the credentials form, 'guide' = the in-app walkthrough.
  const [whatsappSubTab, setWhatsappSubTab] = useState('config');
  // Accordion: one step expanded at a time, starting at step 1. null = all closed.
  const [openGuideStep, setOpenGuideStep] = useState(1);

  // Forms
  const [locationForm, setLocationForm] = useState({ name: '', address: '', city: '', phone: '', pastor_name: '', capacity: '', is_main_campus: false, is_active: true });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: {} });
  const [assignForm, setAssignForm] = useState({ user_email: '', user_name: '', role_id: '', base_role: 'STAFF' });
  // True when the church has roles whose names aren't in the default seed set.
  // Drives whether the Assign-Role modal shows the Custom Role dropdown explicitly
  // or auto-picks the default role matching the chosen Account Type.
  const DEFAULT_ROLE_NAMES = ['Admin', 'Staff', 'Volunteer'];
  const BASE_ROLE_TO_NAME = { ADMIN: 'Admin', STAFF: 'Staff', VOLUNTEER: 'Volunteer' };
  const hasCustomRoles = roles.some(r => !DEFAULT_ROLE_NAMES.includes(r.name));

  // Filter + sort role assignments for display. Revoked rows hidden (no toggle in v1).
  // NOTE: revoking an 'active' assignment only flips status on user_role_assignments;
  // it does NOT deactivate the user's church_users row. v1.1 should reconcile this —
  // see the design doc.
  const ASSIGNMENT_STATUS_PRIORITY = { pending: 0, active: 1, expired: 2 };
  const visibleAssignments = roleAssignments
    .filter(a => a.status !== 'revoked')
    .slice()
    .sort((a, b) => {
      const ap = ASSIGNMENT_STATUS_PRIORITY[a.status] ?? 99;
      const bp = ASSIGNMENT_STATUS_PRIORITY[b.status] ?? 99;
      if (ap !== bp) return ap - bp;
      const dateField = a.status === 'pending' ? 'invitation_sent_at'
                      : a.status === 'active' ? 'accepted_at'
                      : 'invitation_expires_at';
      return new Date(b[dateField] || 0) - new Date(a[dateField] || 0);
    });

  // Locale-aware short date for badge labels (e.g. "May 9" / "9 mai").
  const formatBadgeDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  };
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'BIRTHDAY', body: '' });

  // Activity Log Filters
  const [logFilters, setLogFilters] = useState({ action: 'all', entity_type: 'all', from_date: '', to_date: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [churchData, locationsData, rolesData, assignmentsData, logsData, automationData, templatesData, expCategoriesData, expenseRows, whatsappData] = await Promise.all([
        supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('user_roles', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('user_role_assignments', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('activity_logs', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc', limit: 50 }),
        supabaseQuery('automation_settings', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('message_templates', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('expense_categories', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'name.asc' }),
        supabaseQuery('expenses', { select: 'category', filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        // api_token is deliberately excluded so the secret never reaches the
        // browser; the UI shows api_token_last4 instead.
        supabaseQuery('whatsapp_config', { select: 'id,church_id,provider,phone_number_id,is_active,messages_sent_today,daily_limit,last_reset_date,last_test_sent_at,last_test_status,api_token_last4', filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], single: true })
      ]);
      setChurch(churchData);
      setLocations(locationsData || []);
      setRoles(rolesData || []);
      setRoleAssignments(assignmentsData || []);
      setActivityLogs(logsData || []);
      setAutomationSettings(automationData || []);
      setMessageTemplates(templatesData || []);
      setExpenseCategories(expCategoriesData || []);
      setUsedExpenseCategoryNames((expenseRows || []).map(e => (e.category || '').toLowerCase()).filter(Boolean));
      setWhatsappConfig(whatsappData || null);
      setWhatsappForm({
        provider: whatsappData?.provider && whatsappData.provider !== 'none' ? whatsappData.provider : 'wamatas',
        // Left blank on load: the saved token is write-only from the UI's point
        // of view, so an empty field on save means "keep the existing token".
        access_token: '',
        instance_id: whatsappData?.phone_number_id || ''
      });
    } catch (error) {
      console.error('Settings fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============ CHURCH INFO HANDLERS ============
  const openChurchEdit = () => {
    setChurchForm({
      name: church?.name || '', address: church?.address || '', city: church?.city || '',
      phone: church?.phone || '', email: church?.email || '', currency: church?.currency || 'XAF',
      pastor_name: church?.pastor_name || '', website: church?.website || '',
      denomination: church?.denomination || '', description: church?.description || '',
      logo_url: church?.logo_url || ''
    });
    setEditingChurch(true);
  };

  const handleSaveChurch = async () => {
    if (!churchForm.name) { toast.warning('Church name is required'); return; }
    setSaving(true);
    try {
      await supabaseUpdate('churches', CHURCH_ID, churchForm);
      logActivity({
        action: 'church_profile_updated',
        entity_type: 'church',
        entity_id: CHURCH_ID,
        entity_name: churchForm.name || null,
        details: null
      });
      setEditingChurch(false);
      fetchData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  // ============ ACCOUNT HANDLERS ============
  const openAccountEdit = () => {
    setAccountForm({ full_name: user?.name || '', phone: user?.phone || '', email: user?.email || '' });
    setEditingAccount(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.full_name) { toast.warning('Name is required'); return; }
    setSaving(true);
    try {
      const userData = JSON.parse(localStorage.getItem('churchsmart_user'));
      if (userData?.id) {
        await supabaseUpdate('church_users', userData.id, { full_name: accountForm.full_name, phone: accountForm.phone });
        const updatedUser = { ...userData, name: accountForm.full_name, phone: accountForm.phone };
        localStorage.setItem('churchsmart_user', JSON.stringify(updatedUser));
      }
      setEditingAccount(false);
      window.location.reload();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.new_password || !passwordForm.confirm) { toast.warning('Please fill in all password fields'); return; }
    if (passwordForm.new_password !== passwordForm.confirm) { toast.info('Passwords do not match'); return; }
    if (passwordForm.new_password.length < 8) { toast.info('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(passwordForm.new_password) || !/[0-9]/.test(passwordForm.new_password)) { toast.info('Password must include an uppercase letter and a number'); return; }
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: passwordForm.new_password });
      if (authError) {
        toast.error(authError.message);
        setSaving(false);
        return;
      }
      setShowPasswordChange(false);
      setPasswordForm({ current: '', new_password: '', confirm: '' });
      toast.success('Password updated successfully!');
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  // ============ LOCATION HANDLERS ============
  const resetLocationForm = () => { setLocationForm({ name: '', address: '', city: '', phone: '', pastor_name: '', capacity: '', is_main_campus: false, is_active: true }); setEditingLocation(null); };
  
  const openLocationModal = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setLocationForm({ name: location.name || '', address: location.address || '', city: location.city || '', phone: location.phone || '', pastor_name: location.pastor_name || '', capacity: location.capacity || '', is_main_campus: location.is_main_campus || false, is_active: location.is_active ?? true });
    } else { resetLocationForm(); }
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name) { toast.warning('Location name is required'); return; }
    setSaving(true);
    try {
      const data = { 
        ...locationForm, 
        church_id: CHURCH_ID, 
        capacity: locationForm.capacity ? parseInt(locationForm.capacity) : null 
      };
      
      
      if (data.is_main_campus && !editingLocation?.is_main_campus) {
        for (const loc of locations.filter(l => l.is_main_campus)) {
          await supabaseUpdate('church_locations', loc.id, { is_main_campus: false });
        }
      }
      if (editingLocation) {
        await supabaseUpdate('church_locations', editingLocation.id, data);
        logActivity({
          action: 'location_updated',
          entity_type: 'location',
          entity_id: editingLocation.id,
          entity_name: data.name || null,
          details: null
        });
      } else {
        const result = await supabaseInsert('church_locations', data);
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({
          action: 'location_created',
          entity_type: 'location',
          entity_id: realRow?.id || null,
          entity_name: data.name || null,
          details: null
        });
      }
      setShowLocationModal(false);
      resetLocationForm();
      fetchData();
    } catch (error) { 
      toast.error(error.message); 
    }
    setSaving(false);
  };

  // ============ ROLE HANDLERS ============
  const resetRoleForm = () => { setRoleForm({ name: '', description: '', permissions: {} }); setEditingRole(null); };
  
  const openRoleModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name || '', description: role.description || '', permissions: role.permissions || {} });
    } else { resetRoleForm(); }
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name) { toast.warning('Role name is required'); return; }
    setSaving(true);
    try {
      if (editingRole) {
        await supabaseUpdate('user_roles', editingRole.id, roleForm);
        logActivity({
          action: 'custom_role_updated',
          entity_type: 'custom_role',
          entity_id: editingRole.id,
          entity_name: roleForm.name || null,
          details: null
        });
      } else {
        const result = await supabaseInsert('user_roles', { ...roleForm, is_system_role: false });
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({
          action: 'custom_role_created',
          entity_type: 'custom_role',
          entity_id: realRow?.id || null,
          entity_name: roleForm.name || null,
          details: null
        });
      }
      setShowRoleModal(false); resetRoleForm(); fetchData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  // ============ ROLE ASSIGNMENT HANDLERS ============
  // Pick the default role.id whose name matches the given base_role
  // (e.g. base 'STAFF' → role named 'Staff'). Falls back to first role if the
  // default name doesn't exist (church renamed it). Returns '' if zero roles.
  const pickDefaultRoleId = (baseRole) => {
    const targetName = BASE_ROLE_TO_NAME[baseRole];
    const match = roles.find(r => r.name === targetName);
    return match?.id || roles[0]?.id || '';
  };

  const openAssignRoleModal = () => {
    const defaultBase = 'STAFF';
    setAssignForm({
      user_email: '',
      user_name: '',
      base_role: defaultBase,
      role_id: pickDefaultRoleId(defaultBase)
    });
    setShowAssignRoleModal(true);
  };

  const onBaseRoleChange = (newBase) => {
    // When Account Type changes, re-derive role_id so the matching default is
    // pre-selected. User can still override via the Custom Role dropdown after.
    setAssignForm(prev => ({
      ...prev,
      base_role: newBase,
      role_id: pickDefaultRoleId(newBase)
    }));
  };

  const handleAssignRole = async () => {
    if (!assignForm.user_email || !assignForm.base_role) {
      toast.warning(t('inviteEmailRequired'));
      return;
    }
    if (hasCustomRoles && !assignForm.role_id) {
      toast.warning(t('inviteRoleRequired'));
      return;
    }
    // In the auto-pick path, role_id was set when the modal opened; if it's still
    // empty (zero roles in church — shouldn't happen post-migration), bail.
    const finalRoleId = assignForm.role_id || pickDefaultRoleId(assignForm.base_role);
    if (!finalRoleId) {
      toast.error(t('inviteGenericErrorToast'));
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error(t('inviteSessionExpiredToast'));
        setSaving(false);
        return;
      }

      const response = await fetch('/api/team/send-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          churchId: CHURCH_ID,
          email: assignForm.user_email.trim().toLowerCase(),
          full_name: assignForm.user_name?.trim() || null,
          role_id: finalRoleId,
          base_role: assignForm.base_role
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        const code = data?.code;
        const emailLabel = assignForm.user_email;
        if (code === 'DUPLICATE_USER') {
          toast.error(
            t('inviteDuplicateUserToast')
              .replace('{email}', emailLabel)
              .replace('{church}', data.existing_church || 'another church')
          );
        } else if (code === 'DUPLICATE_INVITE') {
          const expires = data.expires_at ? new Date(data.expires_at).toLocaleDateString() : '';
          toast.error(
            t('inviteDuplicateInviteToast')
              .replace('{email}', emailLabel)
              .replace('{date}', expires)
          );
        } else if (code === 'AUTH_INSUFFICIENT_ROLE') {
          toast.error(t('inviteAuthInsufficientRoleToast'));
        } else if (code === 'INVALID_BASE_ROLE' || code === 'INVALID_ROLE') {
          toast.error(t('inviteInvalidBaseRoleToast'));
        } else if (code === 'NO_AUTH' || code === 'INVALID_AUTH') {
          toast.error(t('inviteSessionExpiredToast'));
        } else {
          toast.error(data.error || t('inviteGenericErrorToast'));
        }
        setSaving(false);
        return;
      }

      // Success path. Email may have failed to send even though the invitation row
      // was created; surface the link in that case so the admin can share manually.
      if (data.warning === 'EMAIL_FAILED') {
        toast.warning(
          t('inviteEmailFailedToast').replace('{link}', data.invite_link || '')
        );
      } else {
        toast.success(
          t('inviteSuccessToast').replace('{email}', assignForm.user_email)
        );
      }

      logActivity({
        action: 'role_invitation_sent',
        entity_type: 'role_assignment',
        entity_id: data.invitation_id || null,
        entity_name: assignForm.user_email || null,
        details: { base_role: assignForm.base_role, role_id: finalRoleId }
      });

      setShowAssignRoleModal(false);
      setAssignForm({ user_email: '', user_name: '', role_id: '', base_role: 'STAFF' });
      fetchData();
    } catch (error) {
      console.error('[handleAssignRole] error:', error);
      toast.error(t('inviteGenericErrorToast'));
    }
    setSaving(false);
  };

  const handleRemoveAssignment = async (id) => {
    if (!confirm(t('invitationRevokeConfirm'))) return;
    try {
      // Capture revoked user's email + role BEFORE the update so the audit log
      // can record what was actually revoked, not the post-update state.
      const a = roleAssignments.find(x => x.id === id);
      // Soft-revoke instead of hard-delete: preserves audit trail (assigned_by,
      // invitation_sent_at, accepted_at) and ensures the token can no longer be
      // used to accept (cleared in same UPDATE).
      await supabaseUpdate('user_role_assignments', id, {
        status: 'revoked',
        invitation_token: null
      });
      logActivity({
        action: 'role_invitation_revoked',
        entity_type: 'role_assignment',
        entity_id: id,
        entity_name: a?.user_email || null,
        details: a?.role_id ? { role_id: a.role_id } : null
      });
      toast.success(t('invitationRevokedToast'));
      fetchData();
    } catch (error) {
      console.error('[handleRemoveAssignment] error:', error);
      toast.error(t('saveFailed'));
    }
  };

  // ============ AUTOMATION HANDLERS ============
  const toggleAutomation = async (automationType, enabled) => {
    const setting = automationSettings.find(a => a.automation_type === automationType);
    if (setting) {
      await supabaseUpdate('automation_settings', setting.id, { is_enabled: enabled });
      logActivity({
        action: 'automation_toggled',
        entity_type: 'automation',
        entity_id: setting.id,
        entity_name: automationType || null,
        details: { enabled }
      });
      fetchData();
    }
  };

  // ============ TEMPLATE HANDLERS ============
  const resetTemplateForm = () => { setTemplateForm({ name: '', category: 'BIRTHDAY', body: '' }); setEditingTemplate(null); };
  
  const openTemplateModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name || '', category: template.category || 'BIRTHDAY', body: template.body || '' });
    } else { resetTemplateForm(); }
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) { toast.warning('Name and message body are required'); return; }
    setSaving(true);
    try {
      if (editingTemplate) {
        await supabaseUpdate('message_templates', editingTemplate.id, templateForm);
        logActivity({
          action: 'template_updated',
          entity_type: 'template',
          entity_id: editingTemplate.id,
          entity_name: templateForm.name || null,
          details: null
        });
      } else {
        const result = await supabaseInsert('message_templates', templateForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({
          action: 'template_created',
          entity_type: 'template',
          entity_id: realRow?.id || null,
          entity_name: templateForm.name || null,
          details: null
        });
      }
      setShowTemplateModal(false); resetTemplateForm(); fetchData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  // ============ WHATSAPP (WAMATAS) HANDLERS ============
  // Credentials are written straight to whatsapp_config (admin-only at the RLS
  // layer). The token is only ever written, never read back: the client selects
  // api_token_last4 instead, so the secret does not sit in the browser.
  const handleSaveWhatsappCredentials = async () => {
    const accessToken = (whatsappForm.access_token || '').trim();
    const instanceId = (whatsappForm.instance_id || '').trim();

    if (!whatsappAvailable) { toast.warning(t('whatsappNotAvailable')); return; }
    if (!instanceId) { toast.warning(t('instanceId')); return; }
    // An empty token field on an existing row means "keep the saved token".
    if (!accessToken && !hasSavedCredentials) { toast.warning(t('accessToken')); return; }

    setSavingWhatsapp(true);
    try {
      const payload = {
        provider: 'wamatas',
        phone_number_id: instanceId
      };
      if (accessToken) payload.api_token = accessToken;

      if (whatsappConfig) {
        await supabaseUpdate('whatsapp_config', whatsappConfig.id, payload);
      } else {
        // is_active stays false until the first test passes.
        await supabaseInsert('whatsapp_config', {
          ...payload,
          is_active: false,
          messages_sent_today: 0,
          last_reset_date: new Date().toISOString().slice(0, 10)
        });
      }

      // Audit the change without recording any part of the secret.
      logActivity({
        action: 'whatsapp_credentials_saved',
        entity_type: 'whatsapp_config',
        entity_id: whatsappConfig?.id || null,
        entity_name: 'wamatas',
        details: { instance_id: instanceId, token_updated: !!accessToken }
      });

      setWhatsappForm({ ...whatsappForm, access_token: '' });
      setShowToken(false);
      toast.success(t('credentialsSaved'));
      invalidateCache('whatsapp_config');
      fetchData();
    } catch (error) { toast.error(error.message); }
    setSavingWhatsapp(false);
  };

  const handleTestWhatsapp = async () => {
    const phone = (testPhone || '').trim();
    if (!/\d/.test(phone)) { toast.warning(t('includeCountryCode')); return; }

    setTestingWhatsapp(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ churchId: CHURCH_ID, testPhone: phone })
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // The route also flips is_active on, so refetch to pick that up.
        setTestResult({ ok: true, messageId: data.providerMessageId || '' });
        toast.success(t('testSuccess'));
      } else {
        setTestResult({ ok: false, error: data.error || `HTTP ${response.status}` });
        toast.error(`${t('testFailed')}: ${data.error || response.status}`);
      }
      invalidateCache('whatsapp_config');
      fetchData();
    } catch (error) {
      setTestResult({ ok: false, error: error.message });
      toast.error(`${t('testFailed')}: ${error.message}`);
    }
    setTestingWhatsapp(false);
  };

  // ============ EXPENSE CATEGORY HANDLERS ============
  const resetExpCategoryForm = () => { setExpCategoryForm({ name: '', description: '' }); setEditingExpCategory(null); };

  const openExpCategoryModal = (category = null) => {
    if (category) {
      setEditingExpCategory(category);
      setExpCategoryForm({ name: category.name || '', description: category.description || '' });
    } else { resetExpCategoryForm(); }
    setShowExpCategoryModal(true);
  };

  const categoryIsInUse = (category) => usedExpenseCategoryNames.includes((category.name || '').toLowerCase());

  const handleSaveExpCategory = async () => {
    const name = (expCategoryForm.name || '').trim();
    if (!name) { toast.warning(t('categoryName')); return; }
    // UNIQUE (church_id, name) is case-sensitive in the DB; compare
    // case-insensitively so 'Rent' and 'rent' can't both exist.
    const clash = expenseCategories.some(c => c.id !== editingExpCategory?.id && (c.name || '').toLowerCase() === name.toLowerCase());
    if (clash) { toast.warning(t('categoryExists')); return; }
    setSaving(true);
    try {
      const payload = { name, description: (expCategoryForm.description || '').trim() || null };
      if (editingExpCategory) {
        await supabaseUpdate('expense_categories', editingExpCategory.id, payload);
        logActivity({ action: 'expense_category_updated', entity_type: 'expense_category', entity_id: editingExpCategory.id, entity_name: name, details: null });
        toast.success(t('savedSuccessfully'));
      } else {
        const result = await supabaseInsert('expense_categories', { ...payload, is_active: true });
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({ action: 'expense_category_created', entity_type: 'expense_category', entity_id: realRow?.id || null, entity_name: name, details: null });
        toast.success(t('categoryCreated'));
      }
      setShowExpCategoryModal(false); resetExpCategoryForm(); fetchData();
    } catch (error) {
      // 23505 = unique_violation, e.g. the name belongs to a deactivated row.
      toast.error(/23505|duplicate key/i.test(error.message || '') ? t('categoryExists') : error.message);
    }
    setSaving(false);
  };

  const handleToggleExpCategory = async (category) => {
    const next = !category.is_active;
    // Optimistic flip; reverted from the server on the refetch below.
    setExpenseCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_active: next } : c));
    try {
      await supabaseUpdate('expense_categories', category.id, { is_active: next });
      logActivity({ action: next ? 'expense_category_activated' : 'expense_category_deactivated', entity_type: 'expense_category', entity_id: category.id, entity_name: category.name || null, details: null });
      fetchData();
    } catch (error) {
      setExpenseCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_active: category.is_active } : c));
      toast.error(error.message);
    }
  };

  // ============ DELETE HANDLER ============
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const target = deleteConfirm;
      if (target.table === 'expense_categories' && categoryIsInUse(target)) {
        // Expenses reference the category by name, so a hard delete would strand
        // historical rows with a label nothing explains. Deactivate instead: the
        // category leaves the picker but stays readable on past expenses.
        await supabaseUpdate('expense_categories', target.id, { is_active: false });
        logActivity({ action: 'expense_category_deactivated', entity_type: 'expense_category', entity_id: target.id, entity_name: target.name || null, details: { reason: 'has_linked_expenses' } });
        toast.info(t('categoryDeactivated'));
        setDeleteConfirm(null); fetchData();
        return;
      }
      if (target.table === 'church_locations') {
        if (target.is_main_campus) { toast.error('Cannot delete main campus'); setDeleteConfirm(null); return; }
      }
      await supabaseDelete(target.table, target.id);
      // Per-table audit log. Delete handler is shared across multiple settings
      // tables, so we branch on `table` to emit the right action code and pull
      // the right friendly name from the captured row.
      if (target.table === 'church_locations') {
        logActivity({ action: 'location_deleted', entity_type: 'location', entity_id: target.id, entity_name: target.name || null, details: null });
      } else if (target.table === 'user_roles') {
        logActivity({ action: 'custom_role_deleted', entity_type: 'custom_role', entity_id: target.id, entity_name: target.name || null, details: null });
      } else if (target.table === 'message_templates') {
        logActivity({ action: 'template_deleted', entity_type: 'template', entity_id: target.id, entity_name: target.name || null, details: null });
      } else if (target.table === 'expense_categories') {
        logActivity({ action: 'expense_category_deleted', entity_type: 'expense_category', entity_id: target.id, entity_name: target.name || null, details: null });
      }
      setDeleteConfirm(null); fetchData();
    } catch (error) { toast.error(error.message); }
  };

  // ============ HELPERS ============
  const getRoleName = (roleId) => roles.find(r => r.id === roleId)?.name || 'Unknown';
  const getAutomationSetting = (type) => automationSettings.find(a => a.automation_type === type);
  const formatDateTime = (dateStr) => new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateTime(dateStr);
  };

  const filteredLogs = activityLogs.filter(log => {
    if (logFilters.action !== 'all' && log.action !== logFilters.action) return false;
    if (logFilters.entity_type !== 'all' && log.entity_type !== logFilters.entity_type) return false;
    return true;
  });

  const sections = [
    { id: 'general', label: `⚙️ ${t('general')}`, icon: '⚙️' },
    { id: 'billing', label: `💳 ${t('billing')}`, icon: '💳' },
    { id: 'locations', label: `📍 ${t('locations')}`, icon: '📍' },
    ...(isChurchAdmin ? [{ id: 'expenseCategories', label: `🏷️ ${t('expenseCategories')}`, icon: '🏷️' }] : []),
    ...(isChurchAdmin ? [{ id: 'whatsapp', label: `💬 ${t('whatsapp')}`, icon: '💬' }] : []),
    { id: 'automation', label: `🤖 ${t('automation')}`, icon: '🤖' },
    { id: 'roles', label: `👥 ${t('userRoles')}`, icon: '👥' },
    { id: 'logs', label: `${canAccessFeature(plan, 'activity_logs') ? '📜' : '🔒'} ${t('activityLogs')}`, icon: '📜' },
    { id: 'data', label: `📦 ${t('dataExport')}`, icon: '📦' },
    { id: 'help', label: `❓ ${t('helpSupport')}`, icon: '❓' },
    { id: 'account', label: `👤 ${t('account')}`, icon: '👤' },
  ];

  const permissionsList = [
    { key: 'members', label: '👥 Members' },
    { key: 'visitors', label: '🚶 Visitors' },
    { key: 'attendance', label: '📊 Attendance' },
    { key: 'giving', label: '💰 Giving/Finance' },
    { key: 'salvations', label: '❤️ Salvations' },
    { key: 'groups', label: '👨‍👩‍👧‍👦 Groups & Volunteers' },
    { key: 'services', label: '⛪ Services & Events' },
    { key: 'messaging', label: '💬 Messaging' },
    { key: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div>
      <PageHeader title={`⚙️ ${t('settings')}`} subtitle={t('manageSettings')} />

      {/* Settings Navigation */}
      <div className="cs-tab-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: '10px 20px', border: activeSection === section.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius: '10px', backgroundColor: activeSection === section.id ? '#eef2ff' : 'white',
              color: activeSection === section.id ? '#6366f1' : '#6b7280', fontWeight: activeSection === section.id ? '600' : '400',
              cursor: 'pointer', fontSize: '14px'
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ============ GENERAL SETTINGS ============ */}
          {activeSection === 'general' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Language */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🌍 Language / Langue</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => changeLanguage('en')} style={{ padding: '12px 24px', border: language === 'en' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'en' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'en' ? '600' : '400' }}>🇬🇧 English</button>
                  <button onClick={() => changeLanguage('fr')} style={{ padding: '12px 24px', border: language === 'fr' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'fr' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'fr' ? '600' : '400' }}>🇫🇷 Français</button>
                </div>
              </div>

              {/* Church Logo */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🖼️ Church Logo</h3>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  {/* Logo Preview */}
                  <div style={{ width: '120px', height: '120px', borderRadius: '16px', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f9fafb', flexShrink: 0, position: 'relative' }}>
                    {church?.logo_url ? (
                      <img src={church.logo_url} alt="Church Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '36px', display: 'block' }}>⛪</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>No logo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Upload your church logo
                    </p>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#9ca3af' }}>
                      Your logo appears on the member registration page, sidebar, and reports. PNG, JPG, or SVG recommended. Max 2MB.
                    </p>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {/* File Upload Button */}
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', backgroundColor: '#6366f1', color: 'white',
                        borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                        📤 {saving ? 'Uploading...' : 'Choose File'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            // Validate file size (2MB max)
                            if (file.size > 2 * 1024 * 1024) {
                              toast.info('File is too large. Maximum size is 2MB.');
                              return;
                            }

                            // Validate file type
                            if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
                              toast.info('Please upload a PNG, JPG, SVG, or WebP image.');
                              return;
                            }

                            setSaving(true);
                            try {
                              // Upload to Supabase Storage
                              const publicUrl = await uploadPhoto(file, 'church-logos');
                              
                              if (publicUrl) {
                                // Save URL to church record
                                await supabaseUpdate('churches', CHURCH_ID, { logo_url: publicUrl });
                                fetchData();
                              } else {
                                // Fallback: try avatars bucket if church-logos doesn't exist
                                const fallbackUrl = await uploadPhoto(file, 'avatars');
                                if (fallbackUrl) {
                                  await supabaseUpdate('churches', CHURCH_ID, { logo_url: fallbackUrl });
                                  fetchData();
                                } else {
                                  toast.error('Logo upload failed. Please try again, or contact support if the problem continues.');
                                }
                              }
                            } catch (error) {
                              toast.info('Upload error: ' + error.message);
                            }
                            setSaving(false);
                            e.target.value = ''; // Reset file input
                          }}
                        />
                      </label>

                      {/* Remove Logo Button */}
                      {church?.logo_url && (
                        <button onClick={async () => {
                          if (!confirm('Remove church logo?')) return;
                          setSaving(true);
                          try {
                            await supabaseUpdate('churches', CHURCH_ID, { logo_url: null });
                            fetchData();
                          } catch (error) { toast.error(error.message); }
                          setSaving(false);
                        }} style={{
                          padding: '10px 20px', border: '1px solid #fecaca', borderRadius: '10px',
                          backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '14px',
                          cursor: 'pointer', fontWeight: '500'
                        }}>
                          🗑️ Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Church Info - Editable */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>⛪ Church Information</h3>
                  {!editingChurch ? (
                    <button onClick={openChurchEdit} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>✏️ Edit</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingChurch(false)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleSaveChurch} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '💾 Save'}</button>
                    </div>
                  )}
                </div>

                {!editingChurch ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Church Name</label><p style={{ margin: 0, fontWeight: '500', fontSize: '16px' }}>{church?.name || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Senior Pastor</label><p style={{ margin: 0 }}>{church?.pastor_name || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Denomination</label><p style={{ margin: 0 }}>{church?.denomination || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Address</label><p style={{ margin: 0 }}>{church?.address || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>City</label><p style={{ margin: 0 }}>{church?.city || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</label><p style={{ margin: 0 }}>{church?.phone || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{church?.email || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Currency</label><p style={{ margin: 0 }}>{church?.currency || 'XAF'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Website</label><p style={{ margin: 0 }}>{church?.website || '—'}</p></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Church Name *</label>
                        <input type="text" value={churchForm.name} onChange={(e) => setChurchForm({ ...churchForm, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Senior Pastor</label>
                        <input type="text" value={churchForm.pastor_name} onChange={(e) => setChurchForm({ ...churchForm, pastor_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Denomination</label>
                        <input type="text" value={churchForm.denomination} onChange={(e) => setChurchForm({ ...churchForm, denomination: e.target.value })} placeholder="e.g., Pentecostal" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Currency</label>
                        <select value={churchForm.currency} onChange={(e) => setChurchForm({ ...churchForm, currency: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="XAF">XAF (CFA Franc)</option>
                          <option value="NGN">NGN (Naira)</option>
                          <option value="GHS">GHS (Cedi)</option>
                          <option value="KES">KES (Shilling)</option>
                          <option value="USD">USD (Dollar)</option>
                          <option value="EUR">EUR (Euro)</option>
                          <option value="GBP">GBP (Pound)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Address</label>
                      <input type="text" value={churchForm.address} onChange={(e) => setChurchForm({ ...churchForm, address: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>City</label>
                        <input type="text" value={churchForm.city} onChange={(e) => setChurchForm({ ...churchForm, city: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                        <input type="tel" value={churchForm.phone} onChange={(e) => setChurchForm({ ...churchForm, phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
                        <input type="email" value={churchForm.email} onChange={(e) => setChurchForm({ ...churchForm, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Website</label>
                      <input type="url" value={churchForm.website} onChange={(e) => setChurchForm({ ...churchForm, website: e.target.value })} placeholder="https://www.yourchurch.com" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Description</label>
                      <textarea value={churchForm.description} onChange={(e) => setChurchForm({ ...churchForm, description: e.target.value })} rows={3} placeholder="Brief description of your church..." style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ BILLING & SUBSCRIPTION ============ */}
          {activeSection === 'billing' && <BillingSection churchId={CHURCH_ID} />}

          {/* ============ LOCATIONS ============ */}
          {activeSection === 'locations' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📍 Church Locations / Branches</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{t('manageLocations')}</p>
                </div>
                <Button onClick={() => openLocationModal()}>➕ Add Location</Button>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', display: 'flex', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>🏢</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{locations.length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Total</p></div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>✅</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{locations.filter(l => l.is_active).length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Active</p></div></div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>City</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Pastor</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{loc.is_main_campus ? '🏛️' : '🏢'}</span>
                          <div>
                            <p style={{ margin: 0, fontWeight: '500' }}>{loc.name}</p>
                            {loc.is_main_campus && <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>Main Campus</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{loc.city || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{loc.pastor_name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{loc.is_active ? <span style={{ color: '#10b981' }}>✅ Active</span> : <span style={{ color: '#ef4444' }}>❌ Inactive</span>}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => openLocationModal(loc)} style={{ padding: '4px 10px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', marginRight: '6px', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm({ ...loc, table: 'church_locations' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ============ WHATSAPP (WAMATAS) ============ */}
          {activeSection === 'whatsapp' && isChurchAdmin && (
            <div style={{ display: 'grid', gap: '24px' }}>

              {/* Setup guide. A static PDF, so it opens in a new tab rather
                  than routing through the app. */}
              <a
                href={WHATSAPP_SETUP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '12px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}
              >
                <span style={{ fontSize: '18px' }}>📄</span>
                <span style={{ textDecoration: 'underline' }}>{t('newToWhatsapp')}</span>
              </a>


              {/* Sub-tabs: credentials form vs. walkthrough. cs-tab-row gives
                  horizontal scrolling on narrow screens. */}
              <div className="cs-tab-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'config', label: `\u2699\ufe0f ${t('whatsappSettings')}` },
                  { id: 'guide', label: `📘 ${t('setupGuide')}` }
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setWhatsappSubTab(st.id)}
                    style={{
                      padding: '10px 20px',
                      border: whatsappSubTab === st.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                      borderRadius: '10px',
                      backgroundColor: whatsappSubTab === st.id ? '#eef2ff' : 'white',
                      color: whatsappSubTab === st.id ? '#6366f1' : '#6b7280',
                      fontWeight: whatsappSubTab === st.id ? '600' : '400',
                      cursor: 'pointer', fontSize: '14px'
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {whatsappSubTab === 'config' && (<>
              {/* Plan gate: WhatsApp unlocks on Growth and above. */}
              {!whatsappAvailable && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#92400e' }}>🔒 {t('whatsappSettings')}</h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#92400e' }}>{t('whatsappNotAvailable')}</p>
                  <Button onClick={() => setActiveSection('billing')}>⬆️ {t('upgradeToUnlockWhatsApp')}</Button>
                </div>
              )}

              {/* ── Credentials ── */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💬 {t('whatsappSettings')}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', padding: '4px 12px', borderRadius: '9999px', backgroundColor: whatsappConnected ? '#dcfce7' : '#f3f4f6', color: whatsappConnected ? '#166534' : '#6b7280' }}>
                      {whatsappConnected ? `${t('whatsappActive')} ✅` : t('whatsappInactive')}
                    </span>
                    <button type="button" onClick={() => onNavigate && onNavigate('whatsappLog')} style={{ border: 'none', background: 'none', padding: 0, color: '#6366f1', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>
                      {t('viewLog')}
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>{t('connectWhatsApp')}</p>

                {/* Provider — only Wamatas is wired up; the rest are placeholders. */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('provider')}</label>
                  <select
                    value={whatsappForm.provider}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, provider: e.target.value })}
                    disabled={!whatsappAvailable}
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
                  >
                    <option value="wamatas">Wamatas</option>
                    <option value="meta_cloud" disabled>{`Meta Cloud API (${t('comingSoon')})`}</option>
                    <option value="360dialog" disabled>{`360dialog (${t('comingSoon')})`}</option>
                  </select>
                </div>

                {/* Access token */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    {t('accessToken')} {!hasSavedCredentials && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={whatsappForm.access_token}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, access_token: e.target.value })}
                      placeholder={hasSavedCredentials ? maskTokenTail(whatsappConfig.api_token_last4) : 'Paste your Wamatas access token'}
                      autoComplete="off"
                      disabled={!whatsappAvailable}
                      style={{ width: '100%', padding: '12px 48px 12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(v => !v)}
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', padding: '6px' }}
                    >
                      {showToken ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{t('storedSecurely')}</p>
                  {hasSavedCredentials && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#374151', fontFamily: 'monospace' }}>
                      {maskTokenTail(whatsappConfig.api_token_last4)}
                    </p>
                  )}
                </div>

                {/* Instance ID */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('instanceId')} <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={whatsappForm.instance_id}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, instance_id: e.target.value })}
                    placeholder="609ACF283XXXX"
                    disabled={!whatsappAvailable}
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
                  />
                </div>

                <Button onClick={handleSaveWhatsappCredentials} disabled={savingWhatsapp || !whatsappAvailable}>
                  {savingWhatsapp ? '⏳' : `💾 ${t('saveCredentials')}`}
                </Button>
              </div>

              {/* ── Test send: only once credentials exist ── */}
              {whatsappAvailable && hasSavedCredentials && (
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>🧪 {t('sendTestMessage')}</h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('phoneToTest')}</label>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+237..."
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
                    />
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{t('includeCountryCode')}</p>
                  </div>

                  <Button onClick={handleTestWhatsapp} disabled={testingWhatsapp}>
                    {testingWhatsapp ? '⏳' : `📤 ${t('sendTestMessage')}`}
                  </Button>

                  {/* Outcome of a test fired in this session. */}
                  {testResult && (
                    <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', backgroundColor: testResult.ok ? '#dcfce7' : '#fef2f2', color: testResult.ok ? '#166534' : '#991b1b' }}>
                      {testResult.ok
                        ? `✅ ${t('testSentSuccess')} ${testResult.messageId || '—'}`
                        : `❌ ${testResult.error}`}
                    </div>
                  )}

                  {/* Persisted result of the most recent test, from the DB. */}
                  {whatsappConfig?.last_test_sent_at && (
                    <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                      {t('lastTest')}: {timeAgo(whatsappConfig.last_test_sent_at)} —{' '}
                      <span style={{ color: whatsappConfig.last_test_status === 'success' ? '#16a34a' : '#dc2626' }}>
                        {whatsappConfig.last_test_status === 'success' ? t('success') : whatsappConfig.last_test_status}
                      </span>
                    </p>
                  )}
                </div>
              )}
              </>)}

              {/* ══════════ IN-APP SETUP GUIDE ══════════ */}
              {whatsappSubTab === 'guide' && (
                <div style={{ display: 'grid', gap: '16px' }}>

                  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📘 {t('whatsapp_setup_guide')}</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{t('connectWhatsApp')}</p>
                      </div>
                      <a
                        href={WHATSAPP_SETUP_GUIDE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', border: '1px solid #c7d2fe', backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
                      >
                        📄 {t('download_guide')}
                      </a>
                    </div>
                  </div>

                  {/* Steps as an accordion so the whole guide is not dumped at once. */}
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {[1, 2, 3, 4, 5, 6].map(n => {
                      const open = openGuideStep === n;
                      const lines = t(`step_${n}_desc`);
                      return (
                        <div key={n} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: open ? '1px solid #c7d2fe' : '1px solid transparent' }}>
                          <button
                            onClick={() => setOpenGuideStep(open ? null : n)}
                            aria-expanded={open}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', border: 'none', background: open ? '#f5f3ff' : 'white', cursor: 'pointer', textAlign: 'left' }}
                          >
                            {/* Numbered brand badge */}
                            <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', backgroundColor: open ? '#6366f1' : '#eef2ff', color: open ? 'white' : '#6366f1' }}>
                              {n}
                            </span>
                            <span style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: '#111827' }}>{t(`step_${n}_title`)}</span>
                            <span style={{ flexShrink: 0, fontSize: '12px', color: '#9ca3af' }}>{open ? '\u25b2' : '\u25bc'}</span>
                          </button>
                          {open && (
                            <div style={{ padding: '4px 20px 20px 66px' }}>
                              <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
                                {/* t() returns the key itself when a value is
                                    missing, so guard before mapping. */}
                                {(Array.isArray(lines) ? lines : [String(lines)]).map((line, i) => (
                                  <li key={i} style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Troubleshooting */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>\ud83d\udee0\ufe0f {t('troubleshooting_title')}</h3>
                    </div>
                    <div className="cs-table-wrap">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Problem</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Fix</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(t('troubleshooting_rows')) ? t('troubleshooting_rows') : []).map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#991b1b' }}>{row.code}</td>
                              <td style={{ padding: '12px 16px', fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>{row.fix}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Need help */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>💡 {t('need_help_title')}</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {(Array.isArray(t('need_help_rows')) ? t('need_help_rows') : []).map((row, i) => (
                        <div key={i} style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>{row.topic}</p>
                          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{row.where}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ EXPENSE CATEGORIES ============ */}
          {activeSection === 'expenseCategories' && isChurchAdmin && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>🏷️ {t('expenseCategories')}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{t('manageCategories')}</p>
                </div>
                <Button onClick={() => openExpCategoryModal()}>➕ {t('addCategory')}</Button>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', display: 'flex', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>🏷️</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{expenseCategories.length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{t('total')}</p></div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>✅</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{expenseCategories.filter(c => c.is_active).length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{t('active')}</p></div></div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('categoryName')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('description')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('status')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseCategories.map((cat) => (
                      <tr key={cat.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{cat.name}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>{cat.description || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {/* Clicking the pill toggles is_active. */}
                          <button
                            onClick={() => handleToggleExpCategory(cat)}
                            style={{
                              padding: '4px 12px', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                              border: cat.is_active ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                              backgroundColor: cat.is_active ? '#d1fae5' : '#f3f4f6',
                              color: cat.is_active ? '#065f46' : '#6b7280'
                            }}
                          >
                            {cat.is_active ? `✅ ${t('active')}` : `⚪ ${t('inactive')}`}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={() => openExpCategoryModal(cat)} style={{ padding: '4px 10px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', marginRight: '6px', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => setDeleteConfirm({ ...cat, table: 'expense_categories' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {expenseCategories.length === 0 && (
                      <tr><td colSpan="4" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>{t('noRecords')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: 0, padding: '12px 20px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
                ℹ️ {t('categoryDeleteHint')}
              </p>
            </div>
          )}

          {/* ============ AUTOMATION ============ */}
          {activeSection === 'automation' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Birthday Settings */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>🎂 Birthday Settings</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send birthday wishes to members</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>📱</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500' }}>Send SMS notifications</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Send birthday SMS to members on their birthday</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('BIRTHDAY_SMS')?.is_enabled || false} onChange={(e) => toggleAutomation('BIRTHDAY_SMS', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>💬</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500' }}>Send WhatsApp notifications</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Send birthday WhatsApp to members</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('BIRTHDAY_WHATSAPP')?.is_enabled || false} onChange={(e) => toggleAutomation('BIRTHDAY_WHATSAPP', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>

              {/* Visitor Follow-up */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>🚶 Visitor Follow-up Sequence</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send follow-up messages to first-time visitors</p>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled ? '#f0fdf4' : '#f9fafb', borderRadius: '10px', marginBottom: '16px', border: getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled ? '1px solid #bbf7d0' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Enable Visitor Follow-up Sequence</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Automatically send Day 1, Day 3, and Day 7 messages</p>
                    </div>
                  </div>
                  <input type="checkbox" checked={getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled || false} onChange={(e) => toggleAutomation('VISITOR_FOLLOWUP', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                </label>
                <div style={{ paddingLeft: '20px', borderLeft: '3px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 1: Welcome Message</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Send a welcome message thanking visitors for attending</p></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>3</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 3: Group Invite & Midweek Reminder</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Invite visitors to join a group and remind them of midweek service</p></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>7</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 7: Membership & Pastor Invitation</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Invite visitors to meet the pastor and learn about membership</p></div>
                  </div>
                </div>
              </div>

              {/* Message Templates */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📝 Message Templates</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Customize your automated messages</p>
                  </div>
                  <Button onClick={() => openTemplateModal()}>➕ Add Template</Button>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {messageTemplates.map((template, i) => (
                    <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontWeight: '500' }}>{template.name}</p>
                          <span style={{ padding: '2px 8px', backgroundColor: template.category === 'BIRTHDAY' ? '#fef3c7' : '#dbeafe', color: template.category === 'BIRTHDAY' ? '#92400e' : '#1e40af', borderRadius: '9999px', fontSize: '11px' }}>{template.category}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{template.body?.substring(0, 100)}{template.body?.length > 100 ? '...' : ''}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openTemplateModal(template)} style={{ padding: '4px 10px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm({ ...template, table: 'message_templates' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  {messageTemplates.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No message templates yet</p>}
                </div>
              </div>

              {/* Scheduled Reports */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>📊 Scheduled Reports</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send reports to specified email addresses</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Weekly Report (Every Monday)</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Attendance and giving summary</p>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('WEEKLY_REPORT')?.is_enabled || false} onChange={(e) => toggleAutomation('WEEKLY_REPORT', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Monthly Report (1st of each month)</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Full monthly summary including visitors and salvations</p>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('MONTHLY_REPORT')?.is_enabled || false} onChange={(e) => toggleAutomation('MONTHLY_REPORT', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ============ USER ROLES ============ */}
          {activeSection === 'roles' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* RBAC Info Banner */}
              <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #bfdbfe', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>Role-Based Access Control</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#3b82f6', lineHeight: '1.5' }}>
                    Create roles with specific module permissions, then assign them to staff users. 
                    <strong> Admin</strong> users always have full access. <strong>Staff</strong> users only see sidebar modules matching their assigned role permissions. 
                    Users with no role assignment will only see the Dashboard, Calendar, and Reports.
                  </p>
                </div>
              </div>

              {/* Roles */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>👥 User Roles</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Define roles and permissions for users</p>
                  </div>
                  <Button onClick={() => openRoleModal()}>➕ Create Role</Button>
                </div>
                <div style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>System Roles</h4>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                    {roles.filter(r => r.is_system_role).map((role, i) => (
                      <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{role.name}</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{role.description}</p>
                        </div>
                        <span style={{ padding: '4px 10px', backgroundColor: '#e5e7eb', borderRadius: '6px', fontSize: '11px', color: '#6b7280' }}>System</span>
                      </div>
                    ))}
                  </div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Custom Roles</h4>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {roles.filter(r => !r.is_system_role).map((role, i) => (
                      <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{role.name}</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{role.description || 'No description'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openRoleModal(role)} style={{ padding: '4px 10px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => setDeleteConfirm({ ...role, table: 'user_roles' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                    {roles.filter(r => !r.is_system_role).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                        <span style={{ fontSize: '32px' }}>🛡️</span>
                        <p>No custom roles created yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Role Assignments */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>🎫 Role Assignments</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Assign roles to users</p>
                  </div>
                  <Button onClick={openAssignRoleModal}>➕ Invite User</Button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAssignments.map((assignment, i) => {
                      const status = assignment.status || 'active';
                      const dateIso = status === 'pending' ? assignment.invitation_expires_at
                                    : status === 'active' ? assignment.accepted_at
                                    : assignment.invitation_expires_at;
                      const dateText = formatBadgeDate(dateIso);
                      let badgeBg, badgeColor, badgeLabel, dateLabel;
                      if (status === 'pending') {
                        badgeBg = '#fef3c7'; badgeColor = '#92400e';
                        badgeLabel = `⏳ ${t('inviteStatusPending')}`;
                        dateLabel = dateText ? t('inviteStatusPendingExpiresLabel').replace('{date}', dateText) : '';
                      } else if (status === 'active') {
                        badgeBg = '#dcfce7'; badgeColor = '#166534';
                        badgeLabel = `✅ ${t('inviteStatusActive')}`;
                        dateLabel = dateText ? t('inviteStatusAcceptedLabel').replace('{date}', dateText) : '';
                      } else { // expired (or unknown)
                        badgeBg = '#f3f4f6'; badgeColor = '#6b7280';
                        badgeLabel = `⌛ ${t('inviteStatusExpired')}`;
                        dateLabel = dateText ? t('inviteStatusExpiredOnLabel').replace('{date}', dateText) : '';
                      }
                      return (
                        <tr key={assignment.id || i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600' }}>{assignment.user_name?.[0] || assignment.user_email?.[0]?.toUpperCase()}</div>
                              <div>
                                <p style={{ margin: 0, fontWeight: '500' }}>{assignment.user_name || 'Unknown'}</p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{assignment.user_email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ padding: '4px 12px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{getRoleName(assignment.role_id)}</span>
                              <span style={{ padding: '4px 10px', backgroundColor: badgeBg, color: badgeColor, borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{badgeLabel}</span>
                            </div>
                            {dateLabel && <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#6b7280' }}>{dateLabel}</p>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                              {status === 'expired' && (
                                <button
                                  type="button"
                                  disabled
                                  title={t('inviteResendComingSoon')}
                                  aria-label={t('inviteResendComingSoon')}
                                  style={{ padding: '4px 10px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'not-allowed', color: '#9ca3af', fontSize: '12px' }}
                                >🔄</button>
                              )}
                              <button onClick={() => handleRemoveAssignment(assignment.id)} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleAssignments.length === 0 && <tr><td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>No role assignments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ ACTIVITY LOGS ============ */}
          {activeSection === 'logs' && !canAccessFeature(plan, 'activity_logs') && (
            <UpgradePrompt feature="activity_logs" featureLabel={t('activityLogs')} onNavigate={onNavigate} />
          )}
          {activeSection === 'logs' && canAccessFeature(plan, 'activity_logs') && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📜 Activity Logs</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Track who adds data to the platform or records attendance and finance</p>
              </div>
              {/* Filters */}
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Action</label>
                  <select value={logFilters.action} onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="all">All Actions</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Entity Type</label>
                  <select value={logFilters.entity_type} onChange={(e) => setLogFilters({ ...logFilters, entity_type: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="all">All Entities</option>
                    <option value="member">Members</option>
                    <option value="visitor">Visitors</option>
                    <option value="attendance">Attendance</option>
                    <option value="donation">Donations</option>
                    <option value="salvation">Salvations</option>
                  </select>
                </div>
                <button onClick={() => setLogFilters({ action: 'all', entity_type: 'all', from_date: '', to_date: '' })} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', marginTop: '18px' }}>🔄 Reset</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Entity</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => {
                    const userName = log.user_name || log.user_email || 'System';
                    const initials = userName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 10px', backgroundColor: log.action === 'CREATE' ? '#dcfce7' : log.action === 'UPDATE' ? '#fef3c7' : '#fef2f2', color: log.action === 'CREATE' ? '#166534' : log.action === 'UPDATE' ? '#92400e' : '#991b1b', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                            {log.action === 'CREATE' ? '➕' : log.action === 'UPDATE' ? '✏️' : '🗑️'} {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{log.entity_type}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{log.entity_name || '—'}</p>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>{initials}</span>
                            <span style={{ color: '#374151', fontSize: '14px' }}>{userName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }} title={formatDateTime(log.created_at)}>{timeAgo(log.created_at)}</td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>No activity logs found</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ============ DATA EXPORT ============ */}
          {activeSection === 'data' && user?.role === 'ADMIN' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>📦 {t('exportAllData')}</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>{t('exportAllDesc')}</p>
              <button onClick={async () => {
                if (!confirm('This will export all your church data as CSV files in a ZIP archive. Continue?')) return;
                setSaving(true);
                try {
                  const [membersD, visitorsD, donationsD, attendanceD, eventsD, groupsD] = await Promise.all([
                    supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
                    supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
                    supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
                    supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
                    supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
                    supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
                  ]);
                  const makeCsv = (data) => {
                    if (!data || data.length === 0) return '';
                    const headers = Object.keys(data[0]);
                    const rows = data.map(r => headers.map(h => { let v = r[h] ?? ''; return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
                    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
                  };
                  const files = [
                    { name: 'members.csv', content: makeCsv(membersD || []) },
                    { name: 'visitors.csv', content: makeCsv(visitorsD || []) },
                    { name: 'donations.csv', content: makeCsv(donationsD || []) },
                    { name: 'attendance.csv', content: makeCsv(attendanceD || []) },
                    { name: 'events.csv', content: makeCsv(eventsD || []) },
                    { name: 'groups.csv', content: makeCsv(groupsD || []) }
                  ].filter(f => f.content);
                  // Download each CSV individually (ZIP requires a library)
                  files.forEach(f => {
                    const blob = new Blob([f.content], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `churchsmart-${f.name.replace('.csv', '')}-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  });
                  toast.success(`${files.length} CSV files exported`);
                } catch (err) { toast.error('Export failed: ' + err.message); }
                setSaving(false);
              }} disabled={saving} style={{ padding: '12px 28px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? `⏳ ${t('exporting')}` : `📦 ${t('exportAllBtn')}`}
              </button>
              <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Files are exported as individual CSVs with UTF-8 encoding for Excel compatibility.</p>
            </div>
          )}
          {activeSection === 'data' && user?.role !== 'ADMIN' && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Data export is only available to Admin users.</div>
          )}

          {/* ============ HELP & SUPPORT ============ */}
          {activeSection === 'help' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {[
                { title: 'Getting Started', desc: 'Set up your church profile, add members, and configure your first service. The onboarding wizard on your dashboard guides you step by step.', items: [
                  { q: 'How do I complete setup?', a: 'Go to your Dashboard — the Getting Started checklist shows what to do next. Complete all 6 steps to fully set up your church.' },
                  { q: 'How do I add team members?', a: 'Go to Settings > User Roles. Create roles with specific permissions, then assign them to team members by email.' },
                ]},
                { title: 'Managing Members', desc: 'Add, edit, import, and manage your church members. Track membership status, birthdays, and contact information.', items: [
                  { q: 'How do I add a member?', a: 'Go to Members and click "Add Member". Fill in their details and save. You can also import members in bulk using the "Import CSV" button.' },
                  { q: 'How do I import members from a spreadsheet?', a: 'Click "Import CSV" on the Members page. Download the template, fill it with your data, upload, map columns, and confirm. Requires Starter plan.' },
                  { q: 'How do I convert a visitor to a member?', a: 'On the Visitors page, click "Convert to Member" next to any visitor. Their info will be copied to a new member record.' },
                ]},
                { title: 'Tracking Attendance', desc: 'Create services, record weekly attendance with breakdowns by gender and age group, and track trends over time.', items: [
                  { q: 'How do I set up services?', a: 'Go to Services & Events and click "Add Service". Set the name, day of week, time, and location.' },
                  { q: 'How do I record attendance?', a: 'Go to Attendance, select the service and date, enter the counts (men, women, children), and save.' },
                ]},
                { title: 'Managing Finances', desc: 'Track tithes, offerings, and expenses. Generate financial reports and giving statements for members.', items: [
                  { q: 'How do I record a donation?', a: 'Go to Giving > Income tab and click "Add Donation". Select the member, amount, category (tithe, offering, etc.), and payment method.' },
                  { q: 'How do I track expenses?', a: 'Go to Giving > Expenses tab (requires Starter plan). Add expenses with category, amount, and vendor details.' },
                  { q: 'How do I generate a giving statement?', a: 'Open a member\'s profile and click "Giving Statement". This exports their donation history as a CSV.' },
                ]},
                { title: 'Communication', desc: 'Send email and WhatsApp messages to your congregation. Segment by groups, location, or membership status.', items: [
                  { q: 'Which messaging channels are available?', a: 'Email is available on Starter+, WhatsApp on Growth+. Go to Messaging to compose and send.' },
                  { q: 'How do I send birthday messages?', a: 'Go to Settings > Automation and enable automatic birthday messages. Set your preferred channel and message template.' },
                ]},
                { title: 'Settings & Administration', desc: 'Manage your church profile, locations, user roles, billing, and data exports.', items: [
                  { q: 'How do I change my subscription plan?', a: 'Go to Settings > Billing. Choose a plan and click Upgrade. Payment is processed securely via Stripe.' },
                  { q: 'How do I export all my data?', a: 'Go to Settings > Data Export and click "Export All Data". This downloads CSV files for all your church records. Admin role required.' },
                ]},
              ].map((section, si) => (
                <div key={si} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600' }}>{section.title}</h3>
                  <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#6b7280' }}>{section.desc}</p>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {section.items.map((item, ii) => (
                      <details key={ii} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', color: '#1f2937', backgroundColor: '#f9fafb' }}>{item.q}</summary>
                        <p style={{ padding: '12px 16px', margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.6', borderTop: '1px solid #e5e7eb' }}>{item.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}

              {/* Support Contact */}
              <div style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#312e81' }}>{t('needMoreHelp')}</h3>
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#4338ca' }}>{t('supportDesc')}</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="https://wa.me/237674991704" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: '#25d366', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>💬 {t('whatsappSupport')}</a>
                  <a href="mailto:contact@churchsmartnow.com" style={{ padding: '10px 20px', backgroundColor: '#4f46e5', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>📧 {t('emailSupport')}</a>
                  <a href="https://www.churchsmartnow.com#faq" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: 'white', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>📖 {t('faq')}</a>
                </div>
              </div>
            </div>
          )}

          {/* ============ ACCOUNT ============ */}
          {activeSection === 'account' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Account Info - Editable */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>👤 Your Account</h3>
                  {!editingAccount ? (
                    <button onClick={openAccountEdit} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>✏️ Edit Profile</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingAccount(false)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleSaveAccount} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '💾 Save'}</button>
                    </div>
                  )}
                </div>

                {!editingAccount ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Name</label><p style={{ margin: 0, fontWeight: '500', fontSize: '16px' }}>{user?.name}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{user?.email}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</label><p style={{ margin: 0 }}>{user?.phone || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Role</label><p style={{ margin: 0 }}><StatusBadge status={user?.role} /></p></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Full Name *</label>
                      <input type="text" value={accountForm.full_name} onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                      <input type="tel" value={accountForm.phone} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email (read-only)</label>
                      <input type="email" value={accountForm.email} disabled style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f9fafb', color: '#9ca3af', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Role (read-only)</label>
                      <input type="text" value={user?.role || ''} disabled style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f9fafb', color: '#9ca3af', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Change Password */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🔐 Change Password</h3>
                  {!showPasswordChange && (
                    <button onClick={() => setShowPasswordChange(true)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>🔑 Change</button>
                  )}
                </div>
                {showPasswordChange ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>New Password *</label>
                      <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Min 6 characters" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Confirm New Password *</label>
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Repeat password" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowPasswordChange(false); setPasswordForm({ current: '', new_password: '', confirm: '' }); }} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleChangePassword} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '🔐 Update Password'}</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Click "Change" to update your password</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🔧 Actions</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Button variant="secondary">📤 Export Data</Button>
                  <Button variant="secondary">📊 Generate Report</Button>
                  <Button variant="danger" onClick={logout}>🚪 Sign Out</Button>
                </div>
              </div>

              {/* App Info */}
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>&copy; 2026 ChurchSmart by DigiSmart Africa</p>
              </div>
            </div>
          )}

        </>
      )}

      {/* ============ MODALS ============ */}

      {/* Location Modal */}
      <Modal isOpen={showLocationModal} onClose={() => { setShowLocationModal(false); resetLocationForm(); }} title={editingLocation ? '✏️ Edit Location' : '➕ Add Location'}>
        <FormInput label="Location Name *" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} required placeholder="e.g., East Campus" />
        <FormInput label="Address" value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} placeholder="Street address" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="City" value={locationForm.city} onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })} placeholder="Douala" />
          <FormInput label="Phone" value={locationForm.phone} onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })} placeholder="+237..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Campus Pastor" value={locationForm.pastor_name} onChange={(e) => setLocationForm({ ...locationForm, pastor_name: e.target.value })} />
          <FormInput label="Capacity" type="number" value={locationForm.capacity} onChange={(e) => setLocationForm({ ...locationForm, capacity: e.target.value })} placeholder="500" />
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={locationForm.is_main_campus} onChange={(e) => setLocationForm({ ...locationForm, is_main_campus: e.target.checked })} /><span>🏛️ Main Campus</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={locationForm.is_active} onChange={(e) => setLocationForm({ ...locationForm, is_active: e.target.checked })} /><span>✅ Active</span></label>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowLocationModal(false); resetLocationForm(); }}>Cancel</Button>
          <Button onClick={handleSaveLocation} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal isOpen={showRoleModal} onClose={() => { setShowRoleModal(false); resetRoleForm(); }} title={editingRole ? '✏️ Edit Role' : '➕ Create Role'}>
        <FormInput label="Role Name *" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} required placeholder="e.g., Finance Manager" />
        <FormInput label="Description" type="textarea" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="What can this role do?" />
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '12px' }}>Permissions</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {permissionsList.map((perm, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={roleForm.permissions[perm.key] || false} onChange={(e) => setRoleForm({ ...roleForm, permissions: { ...roleForm.permissions, [perm.key]: e.target.checked } })} />
                <span style={{ fontSize: '13px' }}>{perm.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowRoleModal(false); resetRoleForm(); }}>Cancel</Button>
          <Button onClick={handleSaveRole} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Send Invitation Modal */}
      <Modal isOpen={showAssignRoleModal} onClose={() => setShowAssignRoleModal(false)} title="🎫 Send Invitation">
        <FormInput label="User Name" value={assignForm.user_name} onChange={(e) => setAssignForm({ ...assignForm, user_name: e.target.value })} placeholder="John Doe" />
        <FormInput label="User Email *" type="email" value={assignForm.user_email} onChange={(e) => setAssignForm({ ...assignForm, user_email: e.target.value })} required placeholder="john@example.com" />
        <FormInput
          label={`${t('inviteAccountType')} *`}
          type="select"
          value={assignForm.base_role}
          onChange={(e) => onBaseRoleChange(e.target.value)}
          options={[
            { value: 'STAFF', label: t('inviteRoleStaff') },
            { value: 'ADMIN', label: t('inviteRoleAdmin') },
            { value: 'VOLUNTEER', label: t('inviteRoleVolunteer') }
          ]}
        />
        <p style={{ margin: '-8px 0 16px 0', fontSize: '12px', color: '#9ca3af' }}>{t('inviteAccountTypeHelper')}</p>
        {hasCustomRoles && (
          <>
            <FormInput
              label={`${t('inviteRoleLabel')} *`}
              type="select"
              value={assignForm.role_id}
              onChange={(e) => setAssignForm({ ...assignForm, role_id: e.target.value })}
              options={roles.map(r => ({ value: r.id, label: r.name }))}
            />
            <p style={{ margin: '-8px 0 16px 0', fontSize: '12px', color: '#9ca3af' }}>{t('inviteRoleHelper')}</p>
          </>
        )}
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#4338ca', backgroundColor: '#eef2ff', padding: '10px 12px', borderRadius: '8px', lineHeight: '1.5' }}>
          💌 {t('inviteHelpText').replace('{email}', assignForm.user_email || '…')}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowAssignRoleModal(false)}>Cancel</Button>
          <Button onClick={handleAssignRole} disabled={saving}>
            {saving ? `⏳ ${t('inviteSending')}` : `📤 ${t('inviteSendButton')}`}
          </Button>
        </div>
      </Modal>

      {/* Template Modal */}
      <Modal isOpen={showTemplateModal} onClose={() => { setShowTemplateModal(false); resetTemplateForm(); }} title={editingTemplate ? '✏️ Edit Template' : '➕ Add Template'}>
        <FormInput label="Template Name *" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} required placeholder="e.g., Birthday Greeting" />
        <FormInput label="Category" type="select" value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} options={[{ value: 'BIRTHDAY', label: '🎂 Birthday' }, { value: 'VISITOR_FOLLOWUP', label: '🚶 Visitor Follow-up' }, { value: 'GENERAL', label: '📝 General' }]} />
        <FormInput label="Message Body *" type="textarea" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} required placeholder="Happy Birthday {{name}}! ..." />
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 16px 0' }}>💡 Use {"{{name}}"} to insert the recipient's name</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowTemplateModal(false); resetTemplateForm(); }}>Cancel</Button>
          <Button onClick={handleSaveTemplate} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Expense Category Modal (shared by "Add Category" and row edit) */}
      <Modal isOpen={showExpCategoryModal} onClose={() => { setShowExpCategoryModal(false); resetExpCategoryForm(); }} title={editingExpCategory ? `✏️ ${t('edit')}` : `➕ ${t('addCategory')}`} width="420px">
        <FormInput label={`${t('categoryName')} *`} value={expCategoryForm.name} onChange={(e) => setExpCategoryForm({ ...expCategoryForm, name: e.target.value })} required placeholder="e.g., Sunday School" />
        <FormInput label={t('description')} type="textarea" value={expCategoryForm.description} onChange={(e) => setExpCategoryForm({ ...expCategoryForm, description: e.target.value })} placeholder="What this category covers" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowExpCategoryModal(false); resetExpCategoryForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveExpCategory} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

{/* Delete Confirmation */}
<ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="Delete" message={deleteConfirm ? 'Are you sure you want to delete "' + (deleteConfirm.name || deleteConfirm.title || 'this item') + '"?' : ''} />
    </div>
  );
}

export default SettingsPage;
