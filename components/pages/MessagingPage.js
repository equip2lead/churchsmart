"use client";
// MessagingPage — extracted from app/page.js for code splitting
// Enhanced with Option A: polished stats, variable insertion, message preview,
// cinematic data-table, daily-limit bar.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, safeGetSession, SUPABASE_URL, SUPABASE_KEY, WHATSAPP_MAX_CHARS } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits, getEmailLimit } from '../../lib/featureGating';
import { Modal, FormInput, Button, PageHeader, SearchBar, LoadingSpinner, exportToCSV, DataTable, StatusBadge, ConfirmDialog, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

// ── Shared style constants ──
const CARD = { backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f5', color: '#111827' };
const LABEL = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' };
const SELECT_BASE = { width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', backgroundColor: 'white', outline: 'none', transition: 'border-color 0.15s' };

// ── Variable insertion helpers ──
const VARIABLES = [
  { key: '{{name}}', label: 'Name', icon: '👤' },
  { key: '{{churchName}}', label: 'Church', icon: '⛪' },
  { key: '{{date}}', label: 'Date', icon: '📅' },
  { key: '{{phone}}', label: 'Phone', icon: '📱' },
];

function MessagingPage({ plan, onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const textareaRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  const [showPreview, setShowPreview] = useState(false);

  // Audience builder state
  const [audienceMode, setAudienceMode] = useState('segment'); // 'segment' | 'individual'
  const [segmentFilters, setSegmentFilters] = useState({
    category: 'ALL_MEMBERS',
    location: 'all',
    status: 'all',
    ministry: 'all',
    groupId: 'all'
  });
  const [selectedIndividuals, setSelectedIndividuals] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);

  // Email is the default channel: it is the one every paid plan has, and the
  // WhatsApp button stays hidden until the church activates WhatsApp.
  const [message, setMessage] = useState({
    type: 'EMAIL',
    subject: '',
    body: ''
  });

  // WhatsApp sending state. Recipients are picked from members that have a
  // phone number, or delegated to a group the API expands server-side.
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [waSelectedIds, setWaSelectedIds] = useState([]);
  const [waGroupId, setWaGroupId] = useState('');
  const [waResult, setWaResult] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersData, visitorsData, groupsData, volunteersData, messagesData, templatesData, locationsData, whatsappData] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('messages', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'sent_at.desc', limit: 50 }),
        supabaseQuery('message_templates', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('whatsapp_config', { select: 'id,is_active,provider,phone_number_id,messages_sent_today,daily_limit,api_token_last4', filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], single: true })
      ]);
      setMembers(membersData || []);
      setVisitors(visitorsData || []);
      setGroups(groupsData || []);
      setVolunteers(volunteersData || []);
      setMessageHistory(messagesData || []);
      setTemplates(templatesData || []);
      setLocations(locationsData || []);
      setWhatsappConfig(whatsappData || null);
    } catch (error) {
      console.error('Messaging fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locationId) => {
    const loc = locations.find(l => l.id === locationId);
    return loc ? loc.name : '—';
  };

  // ── Build unified contact list ──
  const allContacts = [
    ...members.filter(m => m.phone).map(m => ({
      id: m.id, name: `${m.first_name} ${m.last_name}`, phone: m.phone, email: m.email || '',
      type: 'Member', status: m.membership_status || 'ACTIVE', location_id: m.location_id, ministry: null, group_id: null
    })),
    ...visitors.filter(v => v.phone).map(v => ({
      id: v.id, name: v.full_name, phone: v.phone, email: v.email || '',
      type: 'Visitor', status: v.followup_status || 'NEW', location_id: v.location_id, ministry: null, group_id: null
    })),
    ...volunteers.filter(v => v.phone).map(v => ({
      id: v.id, name: v.full_name, phone: v.phone, email: v.email || '',
      type: 'Volunteer', status: v.status || 'ACTIVE', location_id: v.location_id, ministry: v.ministry || null, group_id: null
    }))
  ].filter((c, i, arr) => arr.findIndex(x => x.phone === c.phone) === i);

  // ── Segment-based recipients ──
  const getSegmentRecipients = () => {
    let pool = [];
    switch (segmentFilters.category) {
      case 'ALL_MEMBERS': pool = allContacts.filter(c => c.type === 'Member'); break;
      case 'ALL_VISITORS': pool = allContacts.filter(c => c.type === 'Visitor'); break;
      case 'ALL_VOLUNTEERS': pool = allContacts.filter(c => c.type === 'Volunteer'); break;
      case 'ALL_CONTACTS': pool = [...allContacts]; break;
      case 'GROUP': pool = allContacts.filter(c => c.type === 'Member'); break;
      case 'MINISTRY': pool = allContacts.filter(c => c.type === 'Volunteer'); break;
      default: pool = [...allContacts];
    }
    if (segmentFilters.location !== 'all') {
      pool = pool.filter(c => c.location_id === segmentFilters.location);
    }
    if (segmentFilters.status !== 'all') {
      pool = pool.filter(c => c.status === segmentFilters.status);
    }
    if (segmentFilters.category === 'MINISTRY' && segmentFilters.ministry !== 'all') {
      pool = pool.filter(c => c.ministry === segmentFilters.ministry);
    }
    return pool;
  };

  // ── Final recipient list ──
  const getFinalRecipients = () => {
    if (audienceMode === 'segment') return getSegmentRecipients();
    return selectedIndividuals;
  };

  const recipientCount = getFinalRecipients().length;

  // ── Individual contact search ──
  const searchResults = contactSearch.length >= 1
    ? allContacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.phone.includes(contactSearch) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
      ).slice(0, 15)
    : [];

  const addIndividual = (contact) => {
    if (!selectedIndividuals.find(s => s.phone === contact.phone)) {
      setSelectedIndividuals([...selectedIndividuals, contact]);
    }
    setContactSearch('');
  };

  const removeIndividual = (phone) => {
    setSelectedIndividuals(selectedIndividuals.filter(s => s.phone !== phone));
  };

  // ── Handle template ──
  const applyTemplate = (template) => {
    setMessage({ ...message, body: template.body, subject: template.name });
  };

  // ── Insert variable at cursor ──
  const insertVariable = (varKey) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage({ ...message, body: message.body + varKey });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = message.body.substring(0, start);
    const after = message.body.substring(end);
    const newBody = before + varKey + after;
    setMessage({ ...message, body: newBody });
    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 0);
  };

  // ── WhatsApp recipients ──
  const whatsappEnabled = !!whatsappConfig?.is_active
    && !!whatsappConfig?.api_token_last4
    && !!whatsappConfig?.phone_number_id
    && canAccessFeature(plan, 'messaging_whatsapp');
  const waMembers = members
    .filter(m => m.phone)
    .map(m => ({
      id: m.id,
      name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.phone,
      phone: m.phone
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const waAllSelected = waMembers.length > 0 && waSelectedIds.length === waMembers.length;
  const toggleWaMember = (id) => setWaSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleWaSelectAll = () => setWaSelectedIds(waAllSelected ? [] : waMembers.map(m => m.id));

  const waRecipientCount = waGroupId ? null : waSelectedIds.length;
  const waCharsRemaining = WHATSAPP_MAX_CHARS - message.body.length;

  // ── Delivery stats ──
  const totalSent = messageHistory.filter(m => m.status === 'SENT').length;
  const totalFailed = messageHistory.filter(m => m.status === 'FAILED').length;
  const deliveryRate = messageHistory.length > 0 ? Math.round((totalSent / messageHistory.length) * 100) : 0;
  const contactsWithEmail = allContacts.filter(c => c.email).length;
  const contactsWithPhone = allContacts.filter(c => c.phone).length;
  const waDailyUsed = whatsappConfig?.messages_sent_today || 0;
  const waDailyLimit = whatsappConfig?.daily_limit || 0;
  const waDailyPct = waDailyLimit > 0 ? Math.min(100, Math.round((waDailyUsed / waDailyLimit) * 100)) : 0;

  const handleSendWhatsapp = async () => {
    if (!message.body.trim()) { toast.warning('Please enter a message'); return; }
    if (!waGroupId && waSelectedIds.length === 0) { toast.warning(t('selectRecipients')); return; }

    const recipients = waMembers
      .filter(m => waSelectedIds.includes(m.id))
      .map(m => ({ phone: m.phone, name: m.name }));

    setSending(true);
    setWaResult(null);
    try {
      const { data: { session } } = await safeGetSession();
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          churchId: CHURCH_ID,
          message: message.body,
          recipients,
          groupId: waGroupId || undefined
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.code === 'DAILY_LIMIT_REACHED' ? t('dailyLimitReached') : (data.error || `HTTP ${response.status}`));
      } else {
        const sent = data.sent || 0;
        const failed = data.failed || 0;
        setWaResult({ sent, failed });
        const summary = t('whatsappSentSummary').replace('{sent}', sent).replace('{failed}', failed);
        if (sent > 0) {
          toast.success(summary);
          setMessage({ ...message, body: '' });
          setWaSelectedIds([]);
        } else {
          toast.warning(summary);
        }
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          console.warn('[whatsapp] send errors:', data.errors);
        }
      }
      invalidateCache('whatsapp_config');
      invalidateCache('messages');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
    setSending(false);
  };

  // ── Handle send ──
  const handleSend = async () => {
    if (!message.body) { toast.warning('Please enter a message'); return; }
    if (recipientCount === 0) { toast.warning('No recipients selected'); return; }

    const recipientType = audienceMode === 'segment' ? segmentFilters.category : 'INDIVIDUAL';

    if (message.type === 'EMAIL') {
      if (!message.subject?.trim()) { toast.warning('An email needs a subject'); return; }

      const emailRecipients = getFinalRecipients()
        .filter(c => c.email)
        .map(c => ({ email: c.email, name: c.name }));

      if (emailRecipients.length === 0) {
        toast.warning('None of the selected recipients have an email address');
        return;
      }

      setSending(true);
      try {
        const { data: { session } } = await safeGetSession();
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({
            churchId: CHURCH_ID,
            recipients: emailRecipients,
            subject: message.subject,
            body: message.body
          })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          toast.error(data.error || `Email send failed (${response.status})`);
          setSending(false);
          return;
        }

        const sent = data.sent || 0;
        const failed = data.failed || 0;

        await supabaseInsert('messages', {
          message_type: 'EMAIL',
          recipient_type: recipientType,
          recipient_count: sent,
          subject: message.subject,
          body: message.body,
          status: failed === 0 ? 'SENT' : (sent === 0 ? 'FAILED' : 'PARTIAL'),
          sent_by: user?.email || 'Admin'
        });

        if (sent > 0) {
          toast.success(`✉️ Email: ${sent} sent${failed ? `, ${failed} failed` : ''}`);
          setMessage({ ...message, body: '', subject: '' });
          if (audienceMode === 'individual') setSelectedIndividuals([]);
        } else {
          toast.error(`Email failed for all ${failed} recipient${failed !== 1 ? 's' : ''}`);
        }
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          console.warn('[send-email] errors:', data.errors);
        }
        fetchData();
      } catch (error) {
        toast.error(error.message);
      }
      setSending(false);
      return;
    }

    // ── SMS still only records the attempt ──
    setSending(true);
    try {
      await supabaseInsert('messages', {
        message_type: message.type,
        recipient_type: recipientType,
        recipient_count: recipientCount,
        subject: message.subject,
        body: message.body,
        status: 'SENT',
        sent_by: user?.email || 'Admin'
      });
      toast.info(`📝 ${message.type} logged for ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''} (no SMS provider connected yet)`);
      setMessage({ ...message, body: '', subject: '' });
      if (audienceMode === 'individual') setSelectedIndividuals([]);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
    setSending(false);
  };

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const ministries = ['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer', 'Outreach'];

  const smsSegments = message.body.length <= 160 ? 1 : Math.ceil(message.body.length / 153);

  const getStatusOptions = () => {
    switch (segmentFilters.category) {
      case 'ALL_MEMBERS': return ['ACTIVE', 'INACTIVE', 'NEW'];
      case 'ALL_VISITORS': return ['NEW', 'PENDING', 'CONTACTED', 'COMPLETED'];
      case 'ALL_VOLUNTEERS': return ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
      default: return ['ACTIVE', 'INACTIVE'];
    }
  };

  // ── Channel config ──
  const channels = [
    { id: 'EMAIL', icon: '📧', label: 'Email', color: '#6366f1', activeColor: '#4f46e5', feature: 'messaging_email' },
    ...(whatsappEnabled ? [{ id: 'WHATSAPP', icon: '💬', label: 'WhatsApp', color: '#25d366', activeColor: '#128c7e', feature: 'messaging_whatsapp' }] : []),
    { id: 'SMS', icon: '📱', label: 'SMS', color: '#10b981', activeColor: '#059669', feature: 'sms' },
  ];

  return (
    <div>
      <PageHeader
        title="💬 Messaging Center"
        subtitle={t('sendMessages')}
      />

      {/* ═══════════════ CINEMATIC STATS BAR ═══════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px', marginBottom: '28px'
      }}>
        {/* Total Contacts */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          borderRadius: '14px', padding: '18px 20px', color: 'white',
          boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
        }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85, fontWeight: '500', letterSpacing: '0.03em' }}>TOTAL CONTACTS</p>
          <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>{allContacts.length}</p>
          <p style={{ margin: '6px 0 0', fontSize: '11px', opacity: 0.75 }}>
            📧 {contactsWithEmail} email · 📱 {contactsWithPhone} phone
          </p>
        </div>

        {/* Messages Sent */}
        <div style={{
          ...CARD, padding: '18px 20px'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: '500', letterSpacing: '0.03em' }}>MESSAGES SENT</p>
          <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: '700', color: '#1f2937', lineHeight: 1 }}>{messageHistory.length}</p>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af' }}>
            ✅ {totalSent} delivered · ❌ {totalFailed} failed
          </p>
        </div>

        {/* Delivery Rate */}
        <div style={{
          ...CARD, padding: '18px 20px'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: '500', letterSpacing: '0.03em' }}>DELIVERY RATE</p>
          <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: '700', color: deliveryRate >= 90 ? '#059669' : deliveryRate >= 70 ? '#d97706' : '#ef4444', lineHeight: 1 }}>
            {deliveryRate}%
          </p>
          <div style={{ marginTop: '8px', height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${deliveryRate}%`, backgroundColor: deliveryRate >= 90 ? '#10b981' : deliveryRate >= 70 ? '#f59e0b' : '#ef4444', borderRadius: '2px', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* WhatsApp Daily Limit */}
        {whatsappEnabled && (
          <div style={{
            ...CARD, padding: '18px 20px'
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontWeight: '500', letterSpacing: '0.03em' }}>WA TODAY</p>
            <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: '700', color: waDailyPct >= 90 ? '#ef4444' : '#1f2937', lineHeight: 1 }}>
              {waDailyUsed}<span style={{ fontSize: '14px', fontWeight: '400', color: '#9ca3af' }}>/{waDailyLimit}</span>
            </p>
            <div style={{ marginTop: '8px', height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${waDailyPct}%`, backgroundColor: waDailyPct >= 90 ? '#ef4444' : waDailyPct >= 70 ? '#f59e0b' : '#25d366', borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ MAIN TABS ═══════════════ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #f3f4f6', paddingBottom: '0' }}>
        {[
          { id: 'compose', label: '✏️ Compose' },
          { id: 'history', label: '📜 History' },
          { id: 'templates', label: '📝 Templates' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 24px', border: 'none', borderBottom: activeTab === tab.id ? '3px solid #6366f1' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
            fontWeight: activeTab === tab.id ? '600' : '400', cursor: 'pointer', fontSize: '14px',
            marginBottom: '-2px', transition: 'all 0.15s'
          }}>{tab.label}</button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ═══════════════ COMPOSE TAB ═══════════════ */}
          {activeTab === 'compose' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>

              {/* ── LEFT: Message Composer ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

                {/* Channel Tabs */}
                <div style={{ ...CARD }}>
                  <p style={{ ...LABEL, marginBottom: '12px' }}>{t('selectChannel')}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {channels.map(ch => {
                      const locked = !canAccessFeature(plan, ch.feature);
                      const active = message.type === ch.id && !locked;
                      return (
                        <button key={ch.id} onClick={() => locked ? (onNavigate && onNavigate('settings')) : setMessage({ ...message, type: ch.id })} style={{
                          flex: 1, padding: '14px 12px', border: active ? `2px solid ${ch.color}` : '1.5px solid #e5e7eb',
                          borderRadius: '12px',
                          background: locked ? '#f9fafb' : (active ? `linear-gradient(135deg, ${ch.color}08, ${ch.color}18)` : 'white'),
                          cursor: locked ? 'default' : 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                          transition: 'all 0.2s', opacity: locked ? 0.5 : 1,
                          boxShadow: active ? `0 2px 8px ${ch.color}25` : 'none'
                        }}>
                          <span style={{ fontSize: '22px' }}>{locked ? '🔒' : ch.icon}</span>
                          <span style={{ fontWeight: active ? '700' : '500', color: locked ? '#9ca3af' : (active ? ch.activeColor : '#6b7280'), fontSize: '13px' }}>{ch.label}</span>
                          {active && <div style={{ width: '20px', height: '3px', borderRadius: '2px', backgroundColor: ch.color }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audience Builder (SMS/Email only) */}
                {message.type !== 'WHATSAPP' && (<>
                <div style={{ ...CARD }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <p style={{ ...LABEL, margin: 0 }}>Audience</p>
                    <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
                      {[
                        { id: 'segment', icon: '📊', label: 'Segment' },
                        { id: 'individual', icon: '👤', label: 'Individual' },
                      ].map(mode => (
                        <button key={mode.id} onClick={() => setAudienceMode(mode.id)} style={{
                          padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '13px', cursor: 'pointer',
                          backgroundColor: audienceMode === mode.id ? 'white' : 'transparent',
                          color: audienceMode === mode.id ? '#4f46e5' : '#6b7280',
                          fontWeight: audienceMode === mode.id ? '600' : '400',
                          boxShadow: audienceMode === mode.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s'
                        }}>{mode.icon} {mode.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* SEGMENT MODE */}
                  {audienceMode === 'segment' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={LABEL}>Category</label>
                          <select value={segmentFilters.category} onChange={(e) => setSegmentFilters({ ...segmentFilters, category: e.target.value, ministry: 'all', status: 'all' })} style={SELECT_BASE}>
                            <option value="ALL_CONTACTS">👥 All Contacts</option>
                            <option value="ALL_MEMBERS">📋 Members</option>
                            <option value="ALL_VISITORS">🚶 Visitors</option>
                            <option value="ALL_VOLUNTEERS">🙋 Volunteers</option>
                            <option value="MINISTRY">⛪ Ministry Team</option>
                          </select>
                        </div>
                        <div>
                          <label style={LABEL}>Location</label>
                          <select value={segmentFilters.location} onChange={(e) => setSegmentFilters({ ...segmentFilters, location: e.target.value })} style={SELECT_BASE}>
                            <option value="all">📍 All Locations</option>
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.is_main_campus ? `🏛️ ${loc.name}` : loc.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: segmentFilters.category === 'MINISTRY' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                        <div>
                          <label style={LABEL}>Status</label>
                          <select value={segmentFilters.status} onChange={(e) => setSegmentFilters({ ...segmentFilters, status: e.target.value })} style={SELECT_BASE}>
                            <option value="all">All Statuses</option>
                            {getStatusOptions().map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        {segmentFilters.category === 'MINISTRY' && (
                          <div>
                            <label style={LABEL}>Ministry</label>
                            <select value={segmentFilters.ministry} onChange={(e) => setSegmentFilters({ ...segmentFilters, ministry: e.target.value })} style={SELECT_BASE}>
                              <option value="all">All Ministries</option>
                              {ministries.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Audience Summary Chip */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 18px',
                        background: recipientCount > 0 ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' : '#fef2f2',
                        borderRadius: '12px', border: `1px solid ${recipientCount > 0 ? '#c7d2fe' : '#fecaca'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '26px', fontWeight: '700', color: recipientCount > 0 ? '#4f46e5' : '#ef4444' }}>{recipientCount}</span>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>recipient{recipientCount !== 1 ? 's' : ''} matched</span>
                        </div>
                        {recipientCount > 0 && (
                          <button onClick={() => setShowRecipientPreview(!showRecipientPreview)} style={{
                            padding: '6px 14px', border: '1px solid #c7d2fe', borderRadius: '8px', backgroundColor: 'white',
                            fontSize: '12px', color: '#6366f1', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s'
                          }}>{showRecipientPreview ? '▲ Hide' : '▼ Preview'}</button>
                        )}
                      </div>

                      {/* Recipient Preview */}
                      {showRecipientPreview && recipientCount > 0 && (
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '4px' }}>
                          {getSegmentRecipients().map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < recipientCount - 1 ? '1px solid #f3f4f6' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: r.type === 'Member' ? '#dbeafe' : r.type === 'Visitor' ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                  {r.type === 'Member' ? '📋' : r.type === 'Visitor' ? '🚶' : '🙋'}
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#1f2937' }}>{r.name}</p>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{r.phone} · {getLocationName(r.location_id)}</p>
                                </div>
                              </div>
                              <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: r.type === 'Member' ? '#dbeafe' : r.type === 'Visitor' ? '#fef3c7' : '#dcfce7', borderRadius: '6px', color: '#6b7280', fontWeight: '500' }}>{r.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* INDIVIDUAL MODE */}
                  {audienceMode === 'individual' && (
                    <div>
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input
                          type="text"
                          placeholder="🔍 Search by name, phone, or email..."
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                        {searchResults.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                            backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '250px', overflowY: 'auto', marginTop: '4px'
                          }}>
                            {searchResults.map((contact, i) => {
                              const alreadyAdded = selectedIndividuals.find(s => s.phone === contact.phone);
                              return (
                                <button key={i} onClick={() => !alreadyAdded && addIndividual(contact)} disabled={alreadyAdded} style={{
                                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
                                  border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                                  backgroundColor: alreadyAdded ? '#f9fafb' : 'white', cursor: alreadyAdded ? 'default' : 'pointer',
                                  textAlign: 'left', opacity: alreadyAdded ? 0.5 : 1
                                }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: contact.type === 'Member' ? '#dbeafe' : contact.type === 'Visitor' ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                                    {contact.type === 'Member' ? '📋' : contact.type === 'Visitor' ? '🚶' : '🙋'}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{contact.name}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{contact.phone} · {getLocationName(contact.location_id)}</p>
                                  </div>
                                  <span style={{ fontSize: '10px', padding: '3px 8px', backgroundColor: contact.type === 'Member' ? '#dbeafe' : contact.type === 'Visitor' ? '#fef3c7' : '#dcfce7', borderRadius: '6px', color: '#6b7280', fontWeight: '600', flexShrink: 0 }}>{contact.type}</span>
                                  {alreadyAdded && <span style={{ fontSize: '11px', color: '#10b981' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {selectedIndividuals.length > 0 ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{selectedIndividuals.length} recipient{selectedIndividuals.length !== 1 ? 's' : ''} selected</span>
                            <button onClick={() => setSelectedIndividuals([])} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                            {selectedIndividuals.map((person, i) => (
                              <span key={i} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '5px 10px 5px 12px', backgroundColor: 'white',
                                border: '1px solid #e5e7eb', borderRadius: '20px', fontSize: '13px'
                              }}>
                                <span style={{ fontWeight: '500' }}>{person.name}</span>
                                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{person.type}</span>
                                <button onClick={() => removeIndividual(person.phone)} style={{
                                  width: '18px', height: '18px', borderRadius: '50%', border: 'none',
                                  backgroundColor: '#fee2e2', color: '#ef4444', cursor: 'pointer',
                                  fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1
                                }}>×</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                          <span style={{ fontSize: '28px' }}>👤</span>
                          <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>Search and select individual recipients above</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </>)}

                {/* ══════════ WHATSAPP COMPOSER ══════════ */}
                {message.type === 'WHATSAPP' && (
                  <div style={{ ...CARD }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <p style={{ ...LABEL, margin: 0 }}>{t('selectRecipients')}</p>
                      {/* Daily limit inline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {t('messagesToday')}: <strong style={{ color: waDailyPct >= 90 ? '#ef4444' : '#1f2937' }}>{waDailyUsed}</strong>/{waDailyLimit}
                        </span>
                        <div style={{ width: '60px', height: '4px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${waDailyPct}%`, backgroundColor: waDailyPct >= 90 ? '#ef4444' : '#25d366', borderRadius: '2px' }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <select value={waGroupId} onChange={(e) => { setWaGroupId(e.target.value); setWaSelectedIds([]); }} style={{ flex: '1 1 200px', ...SELECT_BASE, minHeight: '44px' }}>
                        <option value="">👥 {t('membersWithPhone')} ({waMembers.length})</option>
                        {groups.map(g => <option key={g.id} value={g.id}>👪 {g.name}</option>)}
                      </select>
                      {!waGroupId && waMembers.length > 0 && (
                        <button type="button" onClick={toggleWaSelectAll} style={{ flexShrink: 0, padding: '0 16px', minHeight: '44px', border: '1px solid #25d366', borderRadius: '10px', backgroundColor: waAllSelected ? '#25d36618' : 'white', color: '#16a34a', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {waAllSelected ? '✖️' : '✔️'} {t('selectAll')}
                        </button>
                      )}
                    </div>

                    {waGroupId ? (
                      <div style={{ padding: '14px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#1e40af' }}>
                        ℹ️ Every member of this group with a phone number will receive the message. The list is resolved when you send.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px' }}>
                        {waMembers.map((m, i) => (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < waMembers.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}>
                            <input type="checkbox" checked={waSelectedIds.includes(m.id)} onChange={() => toggleWaMember(m.id)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#25d366' }} />
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{m.name}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{m.phone}</span>
                          </label>
                        ))}
                        {waMembers.length === 0 && (
                          <p style={{ margin: 0, padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>{t('noPhoneNumber')}</p>
                        )}
                      </div>
                    )}

                    {/* Variable Insertion Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#9ca3af', marginRight: '4px' }}>Insert:</span>
                      {VARIABLES.slice(0, 2).map(v => (
                        <button key={v.key} type="button" onClick={() => insertVariable(v.key)} style={{
                          padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb',
                          fontSize: '12px', color: '#6366f1', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>{v.icon} {v.key}</button>
                      ))}
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={message.body}
                      onChange={(e) => setMessage({ ...message, body: e.target.value.slice(0, WHATSAPP_MAX_CHARS) })}
                      maxLength={WHATSAPP_MAX_CHARS}
                      placeholder="Type your WhatsApp message here..."
                      style={{ width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', minHeight: '140px', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#9ca3af' }}>{message.body.length} / {WHATSAPP_MAX_CHARS}</span>
                      <span style={{ color: waCharsRemaining < 200 ? '#f59e0b' : '#9ca3af' }}>{waCharsRemaining} {t('charLimit')}</span>
                    </div>

                    {waResult && (
                      <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: waResult.failed > 0 ? '#fef3c7' : '#dcfce7', color: waResult.failed > 0 ? '#92400e' : '#166534' }}>
                        <span>{t('whatsappSentSummary').replace('{sent}', waResult.sent).replace('{failed}', waResult.failed)}</span>
                        <button type="button" onClick={() => onNavigate && onNavigate('whatsappLog')} style={{ border: 'none', background: 'none', padding: 0, color: 'inherit', fontSize: '14px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                          {t('viewLog')}
                        </button>
                      </div>
                    )}

                    {/* Send + Preview */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                      {message.body.trim() && (
                        <button type="button" onClick={() => setShowPreview(true)} style={{
                          padding: '14px 18px', border: '1px solid #e5e7eb', borderRadius: '10px',
                          backgroundColor: 'white', color: '#6b7280', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                        }}>👁 Preview</button>
                      )}
                      <button
                        onClick={handleSendWhatsapp}
                        disabled={sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)}
                        style={{
                          flex: 1, padding: '14px 24px', border: 'none', borderRadius: '10px',
                          background: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? '#e5e7eb' : 'linear-gradient(135deg, #25d366, #128c7e)',
                          color: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? '#9ca3af' : 'white',
                          fontSize: '15px', fontWeight: '600',
                          cursor: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                          boxShadow: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? 'none' : '0 4px 12px rgba(37,211,102,0.3)'
                        }}
                      >
                        {sending
                          ? `⏳ ${t('sendingMessages')}`
                          : `💬 ${t('sendViaWhatsApp')}${waRecipientCount !== null ? ` (${waRecipientCount})` : ''}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Composer (SMS/Email only) */}
                {message.type !== 'WHATSAPP' && (
                <div style={{ ...CARD }}>
                  <p style={{ ...LABEL, marginBottom: '12px' }}>Message</p>

                  {message.type === 'EMAIL' && (
                    <div style={{ marginBottom: '12px' }}>
                      <input type="text" placeholder="Subject line..." value={message.subject} onChange={(e) => setMessage({ ...message, subject: e.target.value })} style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  {/* Variable Insertion Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af', marginRight: '4px' }}>Insert:</span>
                    {VARIABLES.map(v => (
                      <button key={v.key} type="button" onClick={() => insertVariable(v.key)} style={{
                        padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb',
                        fontSize: '12px', color: '#6366f1', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px',
                        transition: 'all 0.15s'
                      }}>{v.icon} {v.key}</button>
                    ))}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={message.body}
                    onChange={(e) => setMessage({ ...message, body: e.target.value })}
                    placeholder={message.type === 'EMAIL' ? 'Compose your email...' : 'Type your message here...'}
                    style={{ width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', minHeight: message.type === 'EMAIL' ? '200px' : '120px', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }}
                  />

                  {/* Character Counter + SMS Segment Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                      <span>{message.body.length} characters</span>
                      {message.type === 'SMS' && <span style={{ color: smsSegments > 1 ? '#f59e0b' : '#9ca3af' }}>· {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}</span>}
                    </div>
                    {message.type === 'SMS' && message.body.length > 140 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
                        ⚠️ Multi-segment
                      </span>
                    )}
                  </div>

                  {/* Send + Preview Bar */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                    {message.body.trim() && (
                      <button type="button" onClick={() => setShowPreview(true)} style={{
                        padding: '14px 18px', border: '1px solid #e5e7eb', borderRadius: '10px',
                        backgroundColor: 'white', color: '#6b7280', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                      }}>👁 Preview</button>
                    )}
                    <button onClick={handleSend} disabled={sending || recipientCount === 0 || !message.body} style={{
                      flex: 1, padding: '14px 24px', border: 'none', borderRadius: '10px',
                      background: (sending || recipientCount === 0 || !message.body) ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: (sending || recipientCount === 0 || !message.body) ? '#9ca3af' : 'white',
                      fontSize: '15px', fontWeight: '600', cursor: (sending || recipientCount === 0 || !message.body) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                      boxShadow: (sending || recipientCount === 0 || !message.body) ? 'none' : '0 4px 12px rgba(79,70,229,0.3)'
                    }}>
                      {sending ? '⏳ Sending...' : `📤 Send ${message.type} to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
                )}
              </div>

              {/* ── RIGHT SIDEBAR ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Quick Segments */}
                <div style={{ ...CARD, padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', ...LABEL }}>Quick Audiences</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { label: 'All Members', cat: 'ALL_MEMBERS', status: 'all', icon: '📋' },
                      { label: 'Active Members', cat: 'ALL_MEMBERS', status: 'ACTIVE', icon: '✅' },
                      { label: 'All Visitors', cat: 'ALL_VISITORS', status: 'all', icon: '🚶' },
                      { label: 'New Visitors', cat: 'ALL_VISITORS', status: 'NEW', icon: '🆕' },
                      { label: 'All Volunteers', cat: 'ALL_VOLUNTEERS', status: 'all', icon: '🙋' },
                      { label: 'Everyone', cat: 'ALL_CONTACTS', status: 'all', icon: '🌍' },
                    ].map((preset, i) => {
                      const isActive = segmentFilters.category === preset.cat && segmentFilters.status === preset.status && audienceMode === 'segment';
                      return (
                        <button key={i} onClick={() => { setAudienceMode('segment'); setSegmentFilters({ ...segmentFilters, category: preset.cat, status: preset.status, location: 'all', ministry: 'all' }); }} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                          border: isActive ? '1px solid #c7d2fe' : '1px solid transparent',
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                          backgroundColor: isActive ? '#eef2ff' : 'transparent',
                          color: '#374151', fontWeight: isActive ? '600' : '400',
                          transition: 'all 0.15s'
                        }}>
                          <span>{preset.icon}</span>
                          <span style={{ flex: 1 }}>{preset.label}</span>
                          <span style={{ fontSize: '11px', color: isActive ? '#4f46e5' : '#9ca3af', fontWeight: isActive ? '700' : '400' }}>
                            {(() => {
                              let pool = preset.cat === 'ALL_CONTACTS' ? allContacts :
                                allContacts.filter(c => c.type === (preset.cat === 'ALL_MEMBERS' ? 'Member' : preset.cat === 'ALL_VISITORS' ? 'Visitor' : 'Volunteer'));
                              if (preset.status !== 'all') pool = pool.filter(c => c.status === preset.status);
                              return pool.length;
                            })()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Templates Quick Insert */}
                <div style={{ ...CARD, padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', ...LABEL }}>Quick Templates</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {templates.slice(0, 5).map((template, i) => (
                      <button key={i} onClick={() => applyTemplate(template)} style={{
                        padding: '10px 12px', border: '1px solid transparent', borderRadius: '8px',
                        backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s'
                      }}>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '13px', color: '#374151' }}>{template.name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.body?.slice(0, 50)}...</p>
                      </button>
                    ))}
                    {templates.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>No templates yet</p>}
                  </div>
                </div>

                {/* Tips */}
                <div style={{ backgroundColor: '#f0fdf4', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '600', color: '#166534' }}>💡 Tips</h4>
                  <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.8' }}>
                    <p style={{ margin: '0 0 4px 0' }}>• Use variables for personalization</p>
                    <p style={{ margin: '0 0 4px 0' }}>• SMS: Keep under 160 chars</p>
                    <p style={{ margin: '0 0 4px 0' }}>• Include church name</p>
                    <p style={{ margin: 0 }}>• Send during business hours</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ HISTORY TAB ═══════════════ */}
          {activeTab === 'history' && (
            <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Message History</h3>
                <span style={{ padding: '4px 12px', backgroundColor: '#f3f4f6', borderRadius: '20px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{messageHistory.length} messages</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0f0f5' }}>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Channel</th>
                      <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recipients</th>
                      <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messageHistory.map((msg, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f8', transition: 'background 0.1s' }}>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(msg.sent_at)}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            backgroundColor: msg.message_type === 'SMS' ? '#dbeafe' : msg.message_type === 'EMAIL' ? '#eef2ff' : '#dcfce7',
                            color: msg.message_type === 'SMS' ? '#1e40af' : msg.message_type === 'EMAIL' ? '#4338ca' : '#166534',
                            borderRadius: '6px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.02em'
                          }}>
                            {msg.message_type === 'SMS' ? '📱' : msg.message_type === 'EMAIL' ? '📧' : '💬'} {msg.message_type}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: '700', color: '#1f2937', fontSize: '15px' }}>{msg.recipient_count}</span>
                          <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>{msg.recipient_type?.replace('ALL_', '').replace('_', ' ')}</span>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '300px' }}>
                          {msg.subject && <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '600', color: '#6366f1' }}>{msg.subject}</p>}
                          <p style={{ margin: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4b5563' }}>{msg.body}</p>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px',
                            backgroundColor: msg.status === 'SENT' ? '#dcfce7' : msg.status === 'FAILED' ? '#fef2f2' : '#fef3c7',
                            color: msg.status === 'SENT' ? '#166534' : msg.status === 'FAILED' ? '#991b1b' : '#92400e',
                            borderRadius: '6px', fontSize: '11px', fontWeight: '600'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: msg.status === 'SENT' ? '#10b981' : msg.status === 'FAILED' ? '#ef4444' : '#f59e0b' }} />
                            {msg.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {messageHistory.length === 0 && (
                      <tr><td colSpan="5" style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
                        <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📭</span>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>No messages sent yet</p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Compose your first message to get started</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
          {activeTab === 'templates' && (
            <div style={{ ...CARD, padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Message Templates</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Manage in Settings → Automation</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {templates.map((template, i) => (
                  <div key={i} style={{ padding: '20px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #f0f0f5', transition: 'box-shadow 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>{template.name}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: template.category === 'BIRTHDAY' ? '#fef3c7' : template.category === 'WELCOME' ? '#dcfce7' : '#dbeafe', color: template.category === 'BIRTHDAY' ? '#92400e' : template.category === 'WELCOME' ? '#166534' : '#1e40af', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{template.category}</span>
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{template.body}</p>
                    <Button variant="secondary" onClick={() => { applyTemplate(template); setActiveTab('compose'); }}>
                      Use Template
                    </Button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                    <span style={{ fontSize: '48px' }}>📝</span>
                    <p>No templates yet. Create them in Settings.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ MESSAGE PREVIEW MODAL ═══════════════ */}
      {showPreview && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowPreview(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white', borderRadius: '20px', padding: '0', maxWidth: '480px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden'
          }}>
            {/* Preview Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>Message Preview</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  {message.type} · {message.type === 'WHATSAPP' ? (waRecipientCount ?? 'group') : recipientCount} recipient{(message.type === 'WHATSAPP' ? waRecipientCount : recipientCount) !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setShowPreview(false)} style={{
                width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#f3f4f6',
                color: '#6b7280', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>×</button>
            </div>

            {/* Preview Body */}
            <div style={{ padding: '24px' }}>
              {message.type === 'WHATSAPP' ? (
                /* WhatsApp-style bubble */
                <div style={{ backgroundColor: '#dcf8c6', borderRadius: '12px 12px 12px 0', padding: '14px 16px', maxWidth: '100%', fontSize: '14px', lineHeight: '1.6', color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {message.body.replace(/\{\{name\}\}/g, 'Jean Dupont').replace(/\{\{churchName\}\}/g, 'FIRE Church').replace(/\{\{date\}\}/g, new Date().toLocaleDateString()).replace(/\{\{phone\}\}/g, '+237 674 991 704')}
                </div>
              ) : message.type === 'EMAIL' ? (
                <div>
                  <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '10px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Subject</p>
                    <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>{message.subject || '(no subject)'}</p>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fafbfc', borderRadius: '10px', fontSize: '14px', lineHeight: '1.6', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #f0f0f5' }}>
                    {message.body.replace(/\{\{name\}\}/g, 'Jean Dupont').replace(/\{\{churchName\}\}/g, 'FIRE Church').replace(/\{\{date\}\}/g, new Date().toLocaleDateString()).replace(/\{\{phone\}\}/g, '+237 674 991 704')}
                  </div>
                </div>
              ) : (
                /* SMS bubble */
                <div style={{ backgroundColor: '#eef2ff', borderRadius: '12px 12px 0 12px', padding: '14px 16px', maxWidth: '100%', fontSize: '14px', lineHeight: '1.6', color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {message.body.replace(/\{\{name\}\}/g, 'Jean Dupont').replace(/\{\{churchName\}\}/g, 'FIRE Church').replace(/\{\{date\}\}/g, new Date().toLocaleDateString()).replace(/\{\{phone\}\}/g, '+237 674 991 704')}
                </div>
              )}

              <p style={{ margin: '16px 0 0', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                Variables like {'{{name}}'} will be replaced with each recipient's actual data
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagingPage;
