"use client";
// SuperAdminPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY, sanitizeInput, sanitizeObject, timeAgoShort, maskTokenTail } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES, roleLabel, isHardcodedSuperAdmin, pawapayBaseUrl } from '../../lib/superAdmin';
import { PLAN_PRICING, STRIPE_PRICE_IDS, isPlaceholderPriceId, getPlanOrder, comparePlans, canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { listCountries, detectOperator, findOperator, localAmount, toMsisdn } from '../../lib/pawapay';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, StatCard, exportToCSV, DashStatCard, DashStatSkeleton, DashPanelSkeleton, DashLineChart, DashBarChart, compactNumber, InitialsAvatar } from '../cs-ui';

function SuperAdminPage({ onNavigate, tab: controlledTab, onTabChange }) {
  const { t, language } = useLanguage();
  const toast = useToast();

  // Platform role, resolved server-side. Until it arrives nothing renders:
  // the tabs are a convenience, and every route re-checks the role itself.
  const [me, setMe] = useState(null);
  const [authState, setAuthState] = useState('checking');
  const [internalTab, setInternalTab] = useState('dashboard');
  // Controlled when the platform sidebar owns the selection, otherwise local.
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange || setInternalTab;

  const [churches, setChurches] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [subscriptions, setSubscriptions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [churchSearch, setChurchSearch] = useState('');
  const [churchPlanFilter, setChurchPlanFilter] = useState('all');
  const [expandedChurch, setExpandedChurch] = useState(null);
  const [savingChurch, setSavingChurch] = useState(null);

  const [secretDraft, setSecretDraft] = useState({ stripe_pk: '', stripe_sk: '', stripe_webhook_secret: '', pawapay_token: '' });
  const [showSecret, setShowSecret] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [testResult, setTestResult] = useState({ stripe: null, pawapay: null });
  const [testing, setTesting] = useState({ stripe: false, pawapay: false });

  const [comms, setComms] = useState({ audience: 'all', plans: [], churchIds: [], subject: '', message: '' });
  const [sendingComms, setSendingComms] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const [logFilter, setLogFilter] = useState({ admin: 'all', action: 'all', from: '', to: '' });
  const [mobilePayments, setMobilePayments] = useState([]);
  // Platform KPIs, computed server-side in one request.
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [momoFilter, setMomoFilter] = useState({ status: 'all', country: 'all', from: '', to: '' });
  const [expandedLog, setExpandedLog] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'support' });
  const [inviting, setInviting] = useState(false);

  const can = (permission) => !!me?.permissions?.[permission];

  // Authed fetch against /api/super-admin/*. Returns { ok, data }.
  const api = useCallback(async (path, options = {}) => {
    // Read auth token: try getSession() with a timeout, fall back to localStorage.
    // supabase.auth.getSession() can hang indefinitely during Supabase client
    // initialization race conditions (never-resolving promise), so we race it
    // against a 3-second timeout and read localStorage as the primary fallback.
    let token = '';
    try {
      const ref = SUPABASE_URL ? SUPABASE_URL.split('//')[1]?.split('.')[0] : null;
      const authKey = ref ? `sb-${ref}-auth-token` : Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const stored = authKey ? localStorage.getItem(authKey) : null;
      if (stored) { token = JSON.parse(stored)?.access_token || ''; }
    } catch (_) { /* ignore parse errors */ }
    if (!token && supabase) {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000))
        ]);
        token = result?.data?.session?.access_token || '';
      } catch (err) {
        console.warn('SuperAdmin: getSession() failed:', err?.message);
      }
    }
    const response = await fetch(`/api/super-admin/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }, []);

  // ── Restore / refresh Supabase session from localStorage ──
  // supabase.auth.setSession() can also hang when the internal auth lock is
  // held by the stuck getSession() initialization. We race it with a 3-second
  // timeout so it never blocks the access check indefinitely.
  const restoreSession = useCallback(async () => {
    if (!supabase) return;
    try {
      const ref = SUPABASE_URL ? SUPABASE_URL.split('//')[1]?.split('.')[0] : null;
      const authKey = ref ? `sb-${ref}-auth-token` : Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const stored = authKey ? localStorage.getItem(authKey) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.access_token && parsed?.refresh_token) {
          await Promise.race([
            supabase.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('setSession timeout')), 3000))
          ]);
        }
      }
    } catch (err) {
      console.warn('SuperAdmin: restoreSession skipped:', err?.message);
    }
  }, []);

  // ── Access check ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await restoreSession();
        const { ok, data } = await api('me');
        if (cancelled) return;
        if (ok) { setMe(data); setAuthState('allowed'); }
        else { setAuthState('denied'); }
      } catch (err) {
        console.error('SuperAdmin: access check failed', err);
        if (!cancelled) setAuthState('denied');
      }
    })();
    return () => { cancelled = true; };
  }, [api, restoreSession]);

  // ── Platform data ──
  // All data is fetched through Next.js API routes. Direct supabaseQuery()
  // calls hang because the Supabase client's internal auth initialization
  // holds a lock on getSession() which never resolves.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch raw platform data through server-side API route (bypasses
      // client-side Supabase auth entirely).
      const [platformData, platformStats, team] = await Promise.all([
        api('platform-data'),
        api('dashboard-stats'),
        api('sub-admins')
      ]);

      if (platformData.ok) {
        setChurches(platformData.data.churches || []);
        setSubscriptions(platformData.data.subscriptions || []);
        setAuditLog(platformData.data.auditLog || []);
        setMobilePayments(platformData.data.mobilePayments || []);

        const counts = {};
        for (const row of (platformData.data.members || [])) {
          if (!row.church_id) continue;
          counts[row.church_id] = (counts[row.church_id] || 0) + 1;
        }
        setMemberCounts(counts);
      }

      if (platformStats.ok) setStats(platformStats.data);
      if (team.ok) setSubAdmins(team.data.subAdmins || []);

      if (can('view_payment_settings')) {
        const s = await api('settings');
        if (s.ok) setSettings(s.data.settings || []);
      }
    } catch (error) {
      console.error('Super admin load error:', error);
    } finally {
      setLoading(false);
    }
  }, [api, me]);

  useEffect(() => { if (authState === 'allowed') loadData(); }, [authState, loadData]);

  // ── Derived stats ──
  const totalMembers = Object.values(memberCounts).reduce((sum, n) => sum + n, 0);
  const planCounts = getPlanOrder().reduce((acc, p) => {
    acc[p] = churches.filter(c => String(c.plan || 'free').toLowerCase() === p).length;
    return acc;
  }, {});

  // Monthly recurring revenue, from each church's current tier. Annual payers
  // are billed at ten months, so this is an approximation of run-rate, not a
  // figure reconciled against Stripe.
  const mrrUsd = churches.reduce((sum, c) => {
    const plan = String(c.plan || 'free').toLowerCase();
    return sum + (PLAN_PRICING[plan]?.monthlyUsd || 0);
  }, 0);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const signupsThisWeek = churches.filter(c => c.created_at && new Date(c.created_at) >= weekAgo).length;
  const signupsThisMonth = churches.filter(c => c.created_at && new Date(c.created_at) >= monthStart).length;

  const signupSeries = (() => {
    const series = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      series.push({
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        fullLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        value: churches.filter(c => String(c.created_at || '').slice(0, 7) === key).length
      });
    }
    return series;
  })();

  const filteredChurches = churches.filter(c => {
    const matchesPlan = churchPlanFilter === 'all' || String(c.plan || 'free').toLowerCase() === churchPlanFilter;
    const needle = churchSearch.trim().toLowerCase();
    const matchesName = !needle
      || String(c.name || '').toLowerCase().includes(needle)
      || String(c.email || '').toLowerCase().includes(needle)
      || String(c.city || '').toLowerCase().includes(needle);
    return matchesPlan && matchesName;
  });

  const auditActions = [...new Set(auditLog.map(l => l.action).filter(Boolean))].sort();
  const auditAdmins = [...new Set(auditLog.map(l => l.admin_email).filter(Boolean))].sort();
  const filteredLog = auditLog.filter(l => {
    if (logFilter.admin !== 'all' && l.admin_email !== logFilter.admin) return false;
    if (logFilter.action !== 'all' && l.action !== logFilter.action) return false;
    if (logFilter.from && new Date(l.created_at) < new Date(logFilter.from)) return false;
    // Inclusive of the chosen end date, hence the +1 day.
    if (logFilter.to && new Date(l.created_at) >= new Date(new Date(logFilter.to).getTime() + 86400000)) return false;
    return true;
  });

  const emailCampaigns = auditLog.filter(l => l.action === 'email_sent');

  const churchNameById = Object.fromEntries(churches.map(c => [c.id, c.name]));
  const momoCountryOptions = [...new Set(mobilePayments.map(p => p.country_code).filter(Boolean))].sort();
  const filteredMomo = mobilePayments.filter(p => {
    if (momoFilter.status !== 'all' && p.status !== momoFilter.status) return false;
    if (momoFilter.country !== 'all' && p.country_code !== momoFilter.country) return false;
    if (momoFilter.from && new Date(p.created_at) < new Date(momoFilter.from)) return false;
    if (momoFilter.to && new Date(p.created_at) >= new Date(new Date(momoFilter.to).getTime() + 86400000)) return false;
    return true;
  });

  // Only completed payments count as revenue. Totals stay per currency rather
  // than being converted: mixing XAF and KES into one number would be fiction.
  const momoRevenue = (keyOf) => {
    const totals = {};
    for (const payment of filteredMomo) {
      if (payment.status !== 'completed') continue;
      const key = `${keyOf(payment)}|${payment.currency}`;
      totals[key] = (totals[key] || 0) + Number(payment.amount || 0);
    }
    return Object.entries(totals)
      .map(([key, total]) => { const [label, currency] = key.split('|'); return { label, currency, total }; })
      .sort((a, b) => b.total - a.total);
  };
  const revenueByCountry = momoRevenue(p => p.country_code);
  const revenueByProvider = momoRevenue(p => p.provider);

  const settingOf = (key) => settings.find(s => s.key === key) || null;
  const modeOf = (key, fallback = 'sandbox') => settingOf(key)?.value || fallback;

  const formatWhen = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch { return d.toLocaleString(); }
  };
  const formatDay = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  // ── Actions ──
  const changeChurchPlan = async (church, plan) => {
    setSavingChurch(church.id);
    const { ok, data } = await api('church', { method: 'POST', body: JSON.stringify({ churchId: church.id, action: 'change_plan', plan }) });
    if (ok) {
      setChurches(prev => prev.map(c => c.id === church.id ? { ...c, plan } : c));
      toast.success(t('sa_plan_changed'));
      loadData();
    } else {
      toast.error(data.error || t('sa_action_failed'));
    }
    setSavingChurch(null);
  };

  const toggleSuspend = async (church) => {
    setSavingChurch(church.id);
    const next = !church.is_suspended;
    const { ok, data } = await api('church', { method: 'POST', body: JSON.stringify({ churchId: church.id, action: 'set_suspended', suspended: next }) });
    if (ok) {
      setChurches(prev => prev.map(c => c.id === church.id ? { ...c, is_suspended: next } : c));
      toast.success(next ? t('sa_church_suspended') : t('sa_church_activated'));
      loadData();
    } else {
      toast.error(data.error || t('sa_action_failed'));
    }
    setSavingChurch(null);
  };

  const saveSettings = async (entries) => {
    setSavingSettings(true);
    const { ok, data } = await api('settings', { method: 'POST', body: JSON.stringify({ settings: entries }) });
    if (ok) {
      // Drafts are cleared on success: the value is never echoed back, so
      // leaving it in the field would imply it is still unsaved.
      setSecretDraft(prev => {
        const next = { ...prev };
        for (const e of entries) if (e.key in next) next[e.key] = '';
        return next;
      });
      toast.success(t('sa_settings_saved'));
      const s = await api('settings');
      if (s.ok) setSettings(s.data.settings || []);
    } else {
      toast.error(data.error || t('sa_action_failed'));
    }
    setSavingSettings(false);
  };

  const runTest = async (gateway) => {
    setTesting(prev => ({ ...prev, [gateway]: true }));
    setTestResult(prev => ({ ...prev, [gateway]: null }));
    const { data } = await api(gateway === 'stripe' ? 'test-stripe' : 'test-pawapay', { method: 'POST' });
    setTestResult(prev => ({ ...prev, [gateway]: data }));
    setTesting(prev => ({ ...prev, [gateway]: false }));
  };

  const commsRecipientCount = (() => {
    if (comms.audience === 'all') return churches.length;
    if (comms.audience === 'by_plan') return churches.filter(c => comms.plans.includes(String(c.plan || 'free').toLowerCase())).length;
    return comms.churchIds.length;
  })();

  const sendComms = async () => {
    setConfirmSend(false);
    setSendingComms(true);
    const { ok, data } = await api('send-email', { method: 'POST', body: JSON.stringify(comms) });
    if (ok) {
      toast.success(t('sa_email_result').replace('{sent}', data.sent || 0).replace('{failed}', data.failed || 0));
      setComms({ ...comms, subject: '', message: '' });
      if (Array.isArray(data.errors) && data.errors.length) console.warn('[super-admin email]', data.errors);
      loadData();
    } else {
      toast.error(data.error || t('sa_action_failed'));
    }
    setSendingComms(false);
  };

  const sendInvite = async () => {
    setInviting(true);
    const { ok, data } = await api('sub-admins', { method: 'POST', body: JSON.stringify(inviteForm) });
    if (ok) {
      if (data.emailSent) toast.success(t('sa_invite_sent'));
      else toast.warning(`${t('sa_invite_created_no_email')} ${data.emailError || ''}`);
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'support' });
      loadData();
    } else {
      toast.error(data.error || t('sa_action_failed'));
    }
    setInviting(false);
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await Promise.race([supabase.auth.getSession(), new Promise((_, rej) => setTimeout(() => rej('timeout'), 3000))]).catch(() => ({ data: { session: null } }));
      const response = await fetch('/api/super-admin/export-report', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('sa_action_failed'));
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `churchsmart-platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success(t('sa_report_exported'));
      }
    } catch (error) {
      toast.error(error.message);
    }
    setExporting(false);
  };

  const updateSubAdmin = async (id, updates) => {
    const { ok, data } = await api('sub-admins', { method: 'PATCH', body: JSON.stringify({ id, ...updates }) });
    if (ok) { toast.success(t('savedSuccessfully')); loadData(); }
    else toast.error(data.error || t('sa_action_failed'));
  };

  // ── Gate ──
  if (authState === 'checking') return <LoadingSpinner />;
  if (authState === 'denied') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px', backgroundColor: 'white', borderRadius: '20px', padding: '48px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: '44px', margin: '0 0 16px' }}>🛡️</p>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>{t('sa_not_admin_title')}</h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>{t('sa_not_admin_body')}</p>
          <Button onClick={() => onNavigate && onNavigate('dashboard')}>{t('dashboard')}</Button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'dashboard', label: `📊 ${t('dashboard')}`, permission: 'view_stats' },
    { id: 'churches', label: `⛪ ${t('sa_churches')}`, permission: 'view_churches' },
    { id: 'payments', label: `💳 ${t('sa_payments')}`, permission: 'view_payment_settings' },
    { id: 'comms', label: `📣 ${t('sa_communications')}`, permission: 'send_communications' },
    { id: 'log', label: `📜 ${t('activityLogs')}`, permission: 'view_activity_log' },
    { id: 'team', label: `👤 ${t('sa_team')}`, permission: 'manage_sub_admins' },
    { id: 'settings', label: `⚙️ ${t('settings')}`, permission: 'view_stats' }
  ].filter(tabDef => can(tabDef.permission));

  // A role can lose access to the tab it is sitting on (or start on one it
  // never had), so fall back to the first tab it does have.
  const activeTab = TABS.some(x => x.id === tab) ? tab : (TABS[0]?.id || null);

  const roleBadgeColor = { super_admin: '#6366f1', support: '#0ea5e9', finance: '#10b981', viewer: '#6b7280' }[me?.role] || '#6b7280';

  const statusPill = (connected) => connected === null
    ? { text: `⏳ ${t('sa_testing')}`, bg: '#f3f4f6', fg: '#6b7280' }
    : connected
      ? { text: `🟢 ${t('sa_connected')}`, bg: '#dcfce7', fg: '#166534' }
      : { text: `🔴 ${t('sa_not_connected')}`, bg: '#fef2f2', fg: '#991b1b' };

  const secretField = (key, label) => {
    const saved = settingOf(key);
    return (
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{label}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showSecret[key] ? 'text' : 'password'}
            value={secretDraft[key] || ''}
            onChange={(e) => setSecretDraft({ ...secretDraft, [key]: e.target.value })}
            placeholder={saved?.last4 ? maskTokenTail(saved.last4) : t('sa_paste_key')}
            autoComplete="off"
            disabled={!can('edit_payment_settings')}
            style={{ width: '100%', padding: '10px 44px 10px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '42px', backgroundColor: can('edit_payment_settings') ? 'white' : '#f9fafb' }}
          />
          <button type="button" onClick={() => setShowSecret({ ...showSecret, [key]: !showSecret[key] })}
            aria-label={showSecret[key] ? 'Hide' : 'Show'}
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', padding: '6px' }}>
            {showSecret[key] ? '🙈' : '👁️'}
          </button>
        </div>
        {saved?.last4 && (
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{maskTokenTail(saved.last4)}</p>
        )}
      </div>
    );
  };

  const modeToggle = (key, currentMode) => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
      {['sandbox', 'live'].map(mode => {
        const on = currentMode === mode;
        const colors = mode === 'live' ? { bg: '#dcfce7', border: '#16a34a', fg: '#166534' } : { bg: '#fef3c7', border: '#f59e0b', fg: '#92400e' };
        return (
          <button key={mode} type="button"
            disabled={!can('edit_payment_settings') || savingSettings}
            onClick={() => saveSettings([{ key, value: mode }])}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
              cursor: can('edit_payment_settings') ? 'pointer' : 'not-allowed',
              border: on ? `2px solid ${colors.border}` : '1px solid #e5e7eb',
              backgroundColor: on ? colors.bg : 'white',
              color: on ? colors.fg : '#9ca3af' }}>
            {mode === 'live' ? `🟢 ${t('sa_live')}` : `🟡 ${t('sa_sandbox')}`}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`🛡️ ${t('sa_title')}`}
        subtitle={t('sa_subtitle')}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ padding: '5px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', backgroundColor: `${roleBadgeColor}18`, color: roleBadgeColor }}>
              {me?.roleLabel}
            </span>
            <Button variant="secondary" onClick={loadData}>🔄</Button>
          </div>
        }
      />

      <div className="cs-tab-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {TABS.map(tabDef => (
          <button key={tabDef.id} onClick={() => setTab(tabDef.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
              border: activeTab === tabDef.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
              backgroundColor: activeTab === tabDef.id ? '#eef2ff' : 'white',
              color: activeTab === tabDef.id ? '#6366f1' : '#6b7280',
              fontWeight: activeTab === tabDef.id ? '600' : '400' }}>
            {tabDef.label}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <div className="cs-dash-stats" style={{ marginBottom: '16px' }}>
            {[0, 1, 2, 3].map(i => <DashStatSkeleton key={i} />)}
          </div>
          <DashPanelSkeleton />
        </>
      ) : (
        <>
          {/* ═══════════ DASHBOARD ═══════════ */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'grid', gap: '16px' }}>

              {/* ── ROW 1 · Platform KPIs ── */}
              <div className="cs-dash-stats">
                <DashStatCard
                  icon="⛪" color="#6366f1"
                  label={t('sa_total_churches')}
                  value={stats?.totalChurches ?? churches.length}
                  trend={stats?.totalChurchesTrend}
                  trendLabel={t('sa_vs_prev_30')}
                />
                <DashStatCard
                  icon="👥" color="#0ea5e9"
                  label={t('sa_total_members')}
                  value={stats?.totalMembers ?? totalMembers}
                  trend={stats?.totalMembersTrend}
                  trendLabel={t('sa_vs_prev_30')}
                />
                <DashStatCard
                  icon="💰" color="#10b981"
                  label={t('sa_revenue_this_month')}
                  value={stats?.revenueThisMonth ?? 0}
                  display={(v) => `$${Math.round(v).toLocaleString()}`}
                  sublabel={`${t('sa_mrr')}: $${(stats?.mrr ?? mrrUsd).toLocaleString()}`}
                  trend={stats?.revenueTrend}
                  trendLabel={t('vs_last_month')}
                />
                <DashStatCard
                  icon="📈" color="#f59e0b"
                  label={t('sa_active_subs')}
                  value={stats?.activeSubscriptions ?? 0}
                  sublabel={`${stats?.totalChurches ?? churches.length} ${t('sa_total_churches').toLowerCase()}`}
                  trend={stats?.activeSubscriptionsTrend}
                  trendLabel={t('sa_vs_prev_30')}
                />
              </div>

              {/* ── ROW 2 · Growth ── */}
              <div className="cs-dash-two">
                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>📈 {t('sa_signups_chart')}</h3>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('sa_last_12_months')}</span>
                  </div>
                  <DashLineChart
                    points={stats?.churchSignupsByMonth || []}
                    color="#6366f1"
                    formatValue={(v) => String(Math.round(v))}
                    emptyLabel={t('not_enough_data')}
                  />
                </div>

                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>💹 {t('sa_revenue_chart')}</h3>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('sa_last_12_months')}</span>
                  </div>
                  <DashBarChart
                    bars={stats?.revenueByMonth || []}
                    color="#10b981"
                    formatValue={(v) => `$${compactNumber(v)}`}
                    emptyLabel={t('not_enough_data')}
                  />
                  <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>{t('sa_revenue_note')}</p>
                </div>
              </div>

              {/* ── ROW 3 · Plan mix + activity ── */}
              <div className="cs-dash-two">
                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>🧩 {t('sa_plan_distribution')}</h3>
                  {(() => {
                    const dist = stats?.churchesByPlan || planCounts;
                    const total = Object.values(dist).reduce((sum, n) => sum + n, 0) || 1;
                    const colors = { free: '#9ca3af', starter: '#0ea5e9', growth: '#6366f1', pro: '#10b981' };
                    return (
                      <div style={{ display: 'grid', gap: '14px' }}>
                        {getPlanOrder().map(plan => {
                          const count = dist[plan] || 0;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={plan}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'capitalize', color: '#374151' }}>{plan}</span>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                  <strong style={{ color: '#111827' }}>{count}</strong> · {pct}%
                                </span>
                              </div>
                              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', backgroundColor: colors[plan], transition: 'width 0.4s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '600' }}>🔔 {t('sa_recent_platform_activity')}</h3>
                  {(stats?.recentActivity || []).length === 0 ? (
                    <p style={{ margin: 0, padding: '28px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('no_recent_activity')}</p>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '2px' }}>
                      {stats.recentActivity.map((item, i) => {
                        const look = {
                          signup: { icon: '🎉', color: '#6366f1', label: t('sa_act_signup') },
                          plan_changed: { icon: '🔀', color: '#f59e0b', label: t('sa_act_plan') },
                          payment: { icon: '💰', color: '#10b981', label: t('sa_act_payment') }
                        }[item.kind] || { icon: '•', color: '#6b7280', label: item.kind };
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                            <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', backgroundColor: `${look.color}14` }}>
                              {look.icon}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.45' }}>
                                <strong>{item.churchName}</strong> · {look.label}
                              </p>
                              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
                                {item.detail} · {timeAgoShort(item.at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── ROW 4 · Top churches + quick actions ── */}
              <div className="cs-dash-two">
                <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>🏆 {t('sa_top_churches')}</h3>
                  </div>
                  {(stats?.topChurches || []).length === 0 ? (
                    <p style={{ margin: 0, padding: '32px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('noRecords')}</p>
                  ) : (
                    <div className="cs-table-wrap">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{t('name')}</th>
                            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{t('billing')}</th>
                            <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{t('members')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.topChurches.map((church, i) => (
                            <tr key={church.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '10px 16px', fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>{i + 1}</td>
                              <td style={{ padding: '10px 16px' }}>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{church.name}</p>
                                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{church.adminEmail || '—'}</p>
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <span style={{ padding: '2px 9px', borderRadius: '9999px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', backgroundColor: '#eef2ff', color: '#4338ca' }}>{church.plan}</span>
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600' }}>{church.members}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '600' }}>⚡ {t('quickActions')}</h3>
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
                    {[
                      { icon: '⛪', label: t('sa_view_all_churches'), go: 'churches', show: can('view_churches') },
                      { icon: '💳', label: t('sa_payment_settings'), go: 'payments', show: can('view_payment_settings') },
                      { icon: '👥', label: t('sa_manage_team'), go: 'team', show: can('manage_sub_admins') }
                    ].filter(a => a.show).map(action => (
                      <button key={action.go} type="button" onClick={() => setTab(action.go)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}>
                        <span>{action.icon}</span>{action.label}
                      </button>
                    ))}
                    <button type="button" onClick={exportReport} disabled={exporting}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '10px', border: '1px solid #c7d2fe', backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '13px', fontWeight: '600', cursor: exporting ? 'wait' : 'pointer', textAlign: 'left' }}>
                      <span>📥</span>{exporting ? '⏳' : t('sa_export_report')}
                    </button>
                  </div>

                  {/* Health. Database size and backup time are not exposed by
                      the Supabase client, so they are shown as unavailable
                      rather than invented. */}
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9ca3af' }}>{t('sa_platform_health')}</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {[
                      { label: t('sa_api_status'), value: `🟢 ${t('sa_operational')}` },
                      { label: t('sa_database_size'), value: t('sa_not_available') },
                      { label: t('sa_last_backup'), value: t('sa_not_available') },
                      { label: t('sa_suspended_churches'), value: String(stats?.engagementMetrics?.suspendedChurches ?? 0) },
                      { label: t('sa_past_due'), value: String(stats?.engagementMetrics?.subscriptionsPastDue ?? 0) }
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
                        <span style={{ color: '#6b7280' }}>{row.label}</span>
                        <strong style={{ color: '#111827' }}>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── ROW 5 · Geography + engagement ── */}
              <div className="cs-dash-two">
                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>🌍 {t('sa_by_country')}</h3>
                  {(() => {
                    const rows = stats?.churchesByCountry || [];
                    const max = Math.max(...rows.map(r => r.count), 1);
                    if (rows.length === 0) {
                      return <p style={{ margin: 0, padding: '28px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('noRecords')}</p>;
                    }
                    return (
                      <div style={{ display: 'grid', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                        {rows.map(row => (
                          <div key={row.country}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                              <span style={{ color: '#374151', fontWeight: '500' }}>{row.country}</span>
                              <strong style={{ color: '#111827' }}>{row.count}</strong>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.round((row.count / max) * 100)}%`, height: '100%', borderRadius: '3px', backgroundColor: '#0ea5e9' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>📊 {t('sa_engagement')}</h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {[
                      { label: t('sa_avg_members'), value: stats?.engagementMetrics?.avgMembersPerChurch ?? 0 },
                      { label: t('sa_active_7d'), value: stats?.engagementMetrics?.activeChurchesLast7Days ?? 0 },
                      { label: t('sa_messages_month'), value: (stats?.engagementMetrics?.messagesThisMonth ?? 0).toLocaleString() },
                      { label: t('sa_donations_month'), value: (stats?.engagementMetrics?.donationsThisMonth ?? 0).toLocaleString() }
                    ].map(metric => (
                      <div key={metric.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f9fafb' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>{metric.label}</span>
                        <strong style={{ fontSize: '18px', color: '#111827' }}>{metric.value}</strong>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>{t('sa_donations_note')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ PLATFORM SETTINGS ═══════════ */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>🛡️ {t('sa_owners')}</h3>
                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280' }}>{t('sa_owners_hint')}</p>
                {SUPER_ADMIN_EMAILS.map(email => (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f9fafb', marginBottom: '8px' }}>
                    <InitialsAvatar name={email} size={30} />
                    <span style={{ fontSize: '13px', color: '#374151' }}>{email}</span>
                    {email === me?.email && (
                      <span style={{ marginLeft: 'auto', padding: '2px 9px', borderRadius: '9999px', fontSize: '10px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#166534' }}>{t('sa_you')}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '600' }}>💓 {t('sa_platform_health')}</h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {[
                    { label: t('sa_api_status'), value: `🟢 ${t('sa_operational')}` },
                    { label: t('sa_database_size'), value: t('sa_not_available') },
                    { label: t('sa_last_backup'), value: t('sa_not_available') },
                    { label: t('sa_total_churches'), value: String(stats?.totalChurches ?? churches.length) },
                    { label: t('sa_total_members'), value: String(stats?.totalMembers ?? totalMembers) }
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f9fafb' }}>
                      <span style={{ color: '#6b7280' }}>{row.label}</span>
                      <strong style={{ color: '#111827' }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>{t('sa_health_note')}</p>
              </div>

              <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>📥 {t('sa_export_report')}</h3>
                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280' }}>{t('sa_export_hint')}</p>
                <Button onClick={exportReport} disabled={exporting}>{exporting ? '⏳' : `📥 ${t('sa_export_report')}`}</Button>
              </div>
            </div>
          )}

          {/* ═══════════ CHURCHES ═══════════ */}
          {activeTab === 'churches' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" value={churchSearch} onChange={(e) => setChurchSearch(e.target.value)} placeholder={t('sa_search_churches')}
                  style={{ flex: '1 1 220px', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '42px' }} />
                <select value={churchPlanFilter} onChange={(e) => setChurchPlanFilter(e.target.value)}
                  style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', minHeight: '42px' }}>
                  <option value="all">{t('sa_all_plans')}</option>
                  {getPlanOrder().map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{filteredChurches.length} / {churches.length}</span>
              </div>

              <div className="cs-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('name')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('billing')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('members')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_created')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChurches.map(church => {
                      const expanded = expandedChurch === church.id;
                      return (
                        <React.Fragment key={church.id}>
                          <tr onClick={() => setExpandedChurch(expanded ? null : church.id)} style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: expanded ? '#f9fafb' : 'white' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <InitialsAvatar name={church.name} size={32} />
                                <div>
                                  <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{church.name}</p>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{church.city || church.email || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', backgroundColor: '#eef2ff', color: '#4338ca' }}>
                                {String(church.plan || 'free')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>{memberCounts[church.id] || 0}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{formatDay(church.created_at)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: church.is_suspended ? '#fef2f2' : '#dcfce7', color: church.is_suspended ? '#991b1b' : '#166534' }}>
                                {church.is_suspended ? t('sa_suspended') : t('active')}
                              </span>
                            </td>
                          </tr>
                          {expanded && (
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              <td colSpan="5" style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    <p style={{ margin: '0 0 4px 0' }}><strong>{t('email')}:</strong> {church.email || '—'}</p>
                                    <p style={{ margin: 0 }}><strong>ID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{church.id}</span></p>
                                  </div>

                                  {can('change_plans') && (
                                    <div>
                                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{t('sa_change_plan')}</label>
                                      <select
                                        value={String(church.plan || 'free')}
                                        disabled={savingChurch === church.id}
                                        onChange={(e) => changeChurchPlan(church, e.target.value)}
                                        style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', minHeight: '38px' }}>
                                        {getPlanOrder().map(p => <option key={p} value={p}>{p}</option>)}
                                      </select>
                                    </div>
                                  )}

                                  {can('suspend_churches') && (
                                    <button type="button" disabled={savingChurch === church.id} onClick={() => toggleSuspend(church)}
                                      style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                        border: '1px solid', borderColor: church.is_suspended ? '#16a34a' : '#dc2626',
                                        backgroundColor: church.is_suspended ? '#dcfce7' : '#fef2f2',
                                        color: church.is_suspended ? '#166534' : '#991b1b' }}>
                                      {savingChurch === church.id ? '⏳' : (church.is_suspended ? `✅ ${t('sa_activate')}` : `⛔ ${t('sa_suspend')}`)}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredChurches.length === 0 && (
                      <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>{t('noResults')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════ PAYMENTS ═══════════ */}
          {activeTab === 'payments' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {!can('edit_payment_settings') && (
                <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '13px' }}>
                  ℹ️ {t('sa_read_only_notice')}
                </div>
              )}

              <div className="cs-dash-two">
                {/* Stripe */}
                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>💳 Stripe</h3>
                    {(() => {
                      const r = testResult.stripe;
                      const pill = statusPill(testing.stripe ? null : (r ? r.connected : false));
                      return (
                        <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', backgroundColor: pill.bg, color: pill.fg }}>
                          {testing.stripe ? `⏳ ${t('sa_testing')}` : (r ? pill.text : t('sa_untested'))}
                        </span>
                      );
                    })()}
                  </div>

                  {secretField('stripe_pk', t('sa_publishable_key'))}
                  {secretField('stripe_sk', t('sa_secret_key'))}
                  {secretField('stripe_webhook_secret', t('sa_webhook_secret'))}

                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('sa_mode')}</label>
                  {modeToggle('stripe_mode', modeOf('stripe_mode'))}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {can('edit_payment_settings') && (
                      <Button
                        onClick={() => {
                          const entries = ['stripe_pk', 'stripe_sk', 'stripe_webhook_secret']
                            .filter(k => (secretDraft[k] || '').trim())
                            .map(k => ({ key: k, value: secretDraft[k].trim() }));
                          if (entries.length === 0) { toast.warning(t('sa_nothing_to_save')); return; }
                          saveSettings(entries);
                        }}
                        disabled={savingSettings}
                      >
                        {savingSettings ? '⏳' : `💾 ${t('save')}`}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => runTest('stripe')} disabled={testing.stripe}>
                      {testing.stripe ? '⏳' : `🔌 ${t('sa_test_connection')}`}
                    </Button>
                  </div>

                  {testResult.stripe && (
                    <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: testResult.stripe.connected ? '#166534' : '#991b1b', wordBreak: 'break-word' }}>
                      {testResult.stripe.connected
                        ? `${testResult.stripe.businessName || testResult.stripe.accountId} · ${testResult.stripe.country || ''}`
                        : testResult.stripe.error}
                    </p>
                  )}
                </div>

                {/* PawaPay */}
                <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📱 PawaPay</h3>
                    {(() => {
                      const r = testResult.pawapay;
                      const pill = statusPill(testing.pawapay ? null : (r ? r.connected : false));
                      return (
                        <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', backgroundColor: pill.bg, color: pill.fg }}>
                          {testing.pawapay ? `⏳ ${t('sa_testing')}` : (r ? pill.text : t('sa_untested'))}
                        </span>
                      );
                    })()}
                  </div>

                  {secretField('pawapay_token', t('sa_api_token'))}

                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('sa_mode')}</label>
                  {modeToggle('pawapay_mode', modeOf('pawapay_mode'))}

                  <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: '14px' }}>
                    <p style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9ca3af', fontWeight: '600' }}>{t('sa_base_url')}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all' }}>
                      {pawapayBaseUrl(modeOf('pawapay_mode'))}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {can('edit_payment_settings') && (
                      <Button
                        onClick={() => {
                          const value = (secretDraft.pawapay_token || '').trim();
                          if (!value) { toast.warning(t('sa_nothing_to_save')); return; }
                          saveSettings([{ key: 'pawapay_token', value }]);
                        }}
                        disabled={savingSettings}
                      >
                        {savingSettings ? '⏳' : `💾 ${t('save')}`}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => runTest('pawapay')} disabled={testing.pawapay}>
                      {testing.pawapay ? '⏳' : `🔌 ${t('sa_test_connection')}`}
                    </Button>
                  </div>

                  {testResult.pawapay && (
                    <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: testResult.pawapay.connected ? '#166534' : '#991b1b', wordBreak: 'break-word' }}>
                      {testResult.pawapay.connected
                        ? `${testResult.pawapay.mode} · ${testResult.pawapay.providers ?? '?'} ${t('sa_wallets')}`
                        : testResult.pawapay.error}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Mobile money transactions ── */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {(revenueByCountry.length > 0 || revenueByProvider.length > 0) && (
                  <div className="cs-dash-two">
                    {[
                      { title: `🌍 ${t('momo_revenue_by_country')}`, rows: revenueByCountry },
                      { title: `📱 ${t('momo_revenue_by_provider')}`, rows: revenueByProvider }
                    ].map(card => (
                      <div key={card.title} className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>{card.title}</h4>
                        {card.rows.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{t('noRecords')}</p>
                        ) : (
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {card.rows.map(row => (
                              <div key={`${card.title}-${row.label}-${row.currency}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                                <span style={{ color: '#6b7280' }}>{row.label}</span>
                                <strong style={{ color: '#111827' }}>{row.currency} {row.total.toLocaleString()}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', flex: '1 1 160px' }}>📲 {t('momo_transactions')}</h3>
                    <select value={momoFilter.status} onChange={(e) => setMomoFilter({ ...momoFilter, status: e.target.value })}
                      style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }}>
                      <option value="all">{t('sa_all_actions')}</option>
                      {['pending', 'completed', 'failed', 'cancelled'].map(st => <option key={st} value={st}>{t(`momo_status_${st}`)}</option>)}
                    </select>
                    <select value={momoFilter.country} onChange={(e) => setMomoFilter({ ...momoFilter, country: e.target.value })}
                      style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }}>
                      <option value="all">{t('momo_all_countries')}</option>
                      {momoCountryOptions.map(code => <option key={code} value={code}>{code}</option>)}
                    </select>
                    <input type="date" value={momoFilter.from} onChange={(e) => setMomoFilter({ ...momoFilter, from: e.target.value })}
                      style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }} />
                    <input type="date" value={momoFilter.to} onChange={(e) => setMomoFilter({ ...momoFilter, to: e.target.value })}
                      style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }} />
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{filteredMomo.length} / {mobilePayments.length}</span>
                  </div>

                  {filteredMomo.length === 0 ? (
                    <p style={{ margin: 0, padding: '44px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('noRecords')}</p>
                  ) : (
                    <div className="cs-table-wrap">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('date')}</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_churches')}</th>
                            <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('amount')}</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('momo_provider')}</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('billing')}</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMomo.map(payment => {
                            const look = {
                              completed: { bg: '#dcfce7', fg: '#166534', icon: '✅' },
                              pending: { bg: '#fef3c7', fg: '#92400e', icon: '⏳' },
                              failed: { bg: '#fef2f2', fg: '#991b1b', icon: '❌' },
                              cancelled: { bg: '#f3f4f6', fg: '#6b7280', icon: '⊖' }
                            }[payment.status] || { bg: '#f3f4f6', fg: '#6b7280', icon: '•' };
                            return (
                              <tr key={payment.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatWhen(payment.created_at)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{churchNameById[payment.church_id] || '—'}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                  {payment.currency} {Number(payment.amount || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                  {payment.provider}
                                  <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af' }}>{payment.country_code}</span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280' }}>{payment.plan}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: look.bg, color: look.fg, whiteSpace: 'nowrap' }}>
                                    {look.icon} {t(`momo_status_${payment.status}`)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ COMMUNICATIONS ═══════════ */}
          {activeTab === 'comms' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>✉️ {t('sa_email_churches')}</h3>

                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{t('sa_recipients')}</label>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { id: 'all', label: `${t('sa_all_churches')} (${churches.length})` },
                    { id: 'by_plan', label: t('sa_by_plan') },
                    { id: 'selected', label: t('sa_select_churches') }
                  ].map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', border: comms.audience === opt.id ? '2px solid #6366f1' : '1px solid #e5e7eb', backgroundColor: comms.audience === opt.id ? '#eef2ff' : 'white' }}>
                      <input type="radio" name="sa-audience" checked={comms.audience === opt.id} onChange={() => setComms({ ...comms, audience: opt.id })} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>

                {comms.audience === 'by_plan' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {getPlanOrder().map(plan => (
                      <label key={plan} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '9999px', cursor: 'pointer', border: '1px solid #e5e7eb', backgroundColor: comms.plans.includes(plan) ? '#eef2ff' : 'white' }}>
                        <input type="checkbox" checked={comms.plans.includes(plan)}
                          onChange={() => setComms({ ...comms, plans: comms.plans.includes(plan) ? comms.plans.filter(p => p !== plan) : [...comms.plans, plan] })} />
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{plan} ({planCounts[plan] || 0})</span>
                      </label>
                    ))}
                  </div>
                )}

                {comms.audience === 'selected' && (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px' }}>
                    {churches.map((church, i) => (
                      <label key={church.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: i < churches.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}>
                        <input type="checkbox" checked={comms.churchIds.includes(church.id)}
                          onChange={() => setComms({ ...comms, churchIds: comms.churchIds.includes(church.id) ? comms.churchIds.filter(id => id !== church.id) : [...comms.churchIds, church.id] })} />
                        <span style={{ flex: 1, fontSize: '13px' }}>{church.name}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{church.plan}</span>
                      </label>
                    ))}
                  </div>
                )}

                <FormInput label={t('subject')} value={comms.subject} onChange={(e) => setComms({ ...comms, subject: e.target.value })} placeholder={t('sa_subject_placeholder')} />
                <FormInput label="Message" type="textarea" value={comms.message} onChange={(e) => setComms({ ...comms, message: e.target.value })} placeholder={t('sa_message_placeholder')} />

                <Button onClick={() => setConfirmSend(true)} disabled={sendingComms || !comms.subject.trim() || !comms.message.trim() || commsRecipientCount === 0}>
                  {sendingComms ? `⏳ ${t('sendingMessages')}` : `📤 ${t('sa_send_to_n').replace('{n}', commsRecipientCount)}`}
                </Button>
              </div>

              {/* WhatsApp to churches — not built yet. */}
              <div style={{ backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '16px', padding: '20px', opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#6b7280' }}>💬 {t('sa_whatsapp_churches')}</h3>
                  <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#92400e' }}>{t('comingSoon')}</span>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>{t('sa_whatsapp_churches_hint')}</p>
              </div>

              {/* Campaign log, read back from the audit trail. */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📜 {t('sa_email_log')}</h3>
                </div>
                {emailCampaigns.length === 0 ? (
                  <p style={{ margin: 0, padding: '40px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('nothingSentYet')}</p>
                ) : (
                  <div className="cs-table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('date')}</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('subject')}</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_recipients')}</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_sent_by')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailCampaigns.map(entry => (
                          <tr key={entry.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatWhen(entry.created_at)}</td>
                            <td style={{ padding: '12px 16px', fontSize: '14px' }}>{entry.details?.subject || '—'}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>{entry.details?.recipient_count ?? '—'}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{entry.admin_email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ ACTIVITY LOG ═══════════ */}
          {activeTab === 'log' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={logFilter.admin} onChange={(e) => setLogFilter({ ...logFilter, admin: e.target.value })}
                  style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }}>
                  <option value="all">{t('sa_all_admins')}</option>
                  {auditAdmins.map(email => <option key={email} value={email}>{email}</option>)}
                </select>
                <select value={logFilter.action} onChange={(e) => setLogFilter({ ...logFilter, action: e.target.value })}
                  style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }}>
                  <option value="all">{t('sa_all_actions')}</option>
                  {auditActions.map(action => <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="date" value={logFilter.from} onChange={(e) => setLogFilter({ ...logFilter, from: e.target.value })}
                  style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }} />
                <input type="date" value={logFilter.to} onChange={(e) => setLogFilter({ ...logFilter, to: e.target.value })}
                  style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', minHeight: '40px' }} />
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{filteredLog.length} / {auditLog.length}</span>
              </div>

              {filteredLog.length === 0 ? (
                <p style={{ margin: 0, padding: '48px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('noRecords')}</p>
              ) : (
                <div className="cs-table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('date')}</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_admin')}</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_action')}</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('description')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLog.map(entry => {
                        const open = expandedLog === entry.id;
                        return (
                          <React.Fragment key={entry.id}>
                            <tr onClick={() => setExpandedLog(open ? null : entry.id)} style={{ borderTop: '1px solid #e5e7eb', cursor: entry.details ? 'pointer' : 'default' }}>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatWhen(entry.created_at)}</td>
                              <td style={{ padding: '12px 16px', fontSize: '13px' }}>{entry.admin_email}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#eef2ff', color: '#4338ca', whiteSpace: 'nowrap' }}>
                                  {entry.action.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '12px', color: '#9ca3af' }}>
                                {entry.details ? (open ? t('sa_hide_details') : t('sa_show_details')) : '—'}
                              </td>
                            </tr>
                            {open && entry.details && (
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <td colSpan="4" style={{ padding: '12px 16px' }}>
                                  <pre style={{ margin: 0, fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                                    {JSON.stringify(entry.details, null, 2)}
                                  </pre>
                                  {entry.ip_address && <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>IP: {entry.ip_address}</p>}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ TEAM ═══════════ */}
          {activeTab === 'team' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>👤 {t('sa_team')}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{t('sa_team_hint')}</p>
                </div>
                <Button onClick={() => setShowInvite(true)}>➕ {t('sa_invite')}</Button>
              </div>

              {/* The hardcoded platform owners, for context: they are not rows
                  in sub_admins and cannot be edited here. */}
              <div style={{ padding: '14px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9ca3af', fontWeight: '600' }}>{t('sa_owners')}</p>
                {SUPER_ADMIN_EMAILS.map(email => (
                  <p key={email} style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>🛡️ {email}</p>
                ))}
              </div>

              <div className="cs-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('name')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_role')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('sa_last_login')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('status')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subAdmins.map(member => {
                      const state = !member.is_active ? 'deactivated' : (member.accepted_at ? 'active' : 'invited');
                      const stateStyle = {
                        active: { bg: '#dcfce7', fg: '#166534', label: t('active') },
                        invited: { bg: '#fef3c7', fg: '#92400e', label: t('sa_invited') },
                        deactivated: { bg: '#f3f4f6', fg: '#6b7280', label: t('inactive') }
                      }[state];
                      return (
                        <tr key={member.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <InitialsAvatar name={member.name || member.email} size={32} />
                              <div>
                                <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{member.name || '—'}</p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {can('manage_sub_admins') ? (
                              <select value={member.role} onChange={(e) => updateSubAdmin(member.id, { role: e.target.value })}
                                style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}>
                                {ADMIN_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: '13px' }}>{roleLabel(member.role)}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{member.last_login ? formatWhen(member.last_login) : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: stateStyle.bg, color: stateStyle.fg }}>
                              {stateStyle.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {can('manage_sub_admins') && (
                              <button type="button" onClick={() => updateSubAdmin(member.id, { is_active: !member.is_active })}
                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                  border: '1px solid', borderColor: member.is_active ? '#dc2626' : '#16a34a',
                                  backgroundColor: member.is_active ? '#fef2f2' : '#dcfce7',
                                  color: member.is_active ? '#991b1b' : '#166534' }}>
                                {member.is_active ? t('sa_deactivate') : t('sa_activate')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {subAdmins.length === 0 && (
                      <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>{t('sa_no_team')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite modal */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title={`➕ ${t('sa_invite')}`} width="420px">
        <FormInput label={`${t('email')} *`} type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required placeholder="teammate@example.com" />
        <FormInput label={t('name')} value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Jane Doe" />
        <FormInput label={t('sa_role')} type="select" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
          options={['support', 'finance', 'viewer'].map(r => ({ value: r, label: roleLabel(r) }))} />
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6b7280' }}>{t('sa_invite_hint')}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowInvite(false)}>{t('cancel')}</Button>
          <Button onClick={sendInvite} disabled={inviting || !inviteForm.email.trim()}>{inviting ? '⏳' : `📤 ${t('sa_send_invite')}`}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={sendComms}
        title={`📤 ${t('sa_email_churches')}`}
        message={t('sa_confirm_send').replace('{n}', commsRecipientCount)}
      />
    </div>
  );
}

// ==========================================
// PLAN LIMITS & FEATURE GATING
// ==========================================
// Derived from lib/featureGating rather than a second hand-maintained table:
// the previous local copy had drifted (it still capped Growth at 1,000 members
// after the tier became unlimited).

export default SuperAdminPage;
