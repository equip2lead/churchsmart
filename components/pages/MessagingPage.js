"use client";
// MessagingPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, SUPABASE_URL, SUPABASE_KEY, WHATSAPP_MAX_CHARS } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits, getEmailLimit } from '../../lib/featureGating';
import { Modal, FormInput, Button, PageHeader, SearchBar, LoadingSpinner, exportToCSV, DataTable, StatusBadge, ConfirmDialog, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function MessagingPage({ plan, onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
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
        // api_token is deliberately NOT selected: the secret must not reach the
        // browser. Settings only needs its last 4 characters, derived below.
        // api_token is deliberately excluded: the secret must not reach the
        // browser. api_token_last4 only says whether one is stored.
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
    // Apply location filter
    if (segmentFilters.location !== 'all') {
      pool = pool.filter(c => c.location_id === segmentFilters.location);
    }
    // Apply status filter
    if (segmentFilters.status !== 'all') {
      pool = pool.filter(c => c.status === segmentFilters.status);
    }
    // Apply ministry filter
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

  // ── WhatsApp recipients ──
  // WhatsApp can only reach a phone number, so members without one are left
  // out of the picker rather than silently failing at send time.
  // Requires an activated config AND stored credentials: without a token or
  // instance id the send route would reject every attempt.
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

  // With a group chosen the count is unknown client-side (group_members is not
  // readable from the browser under current RLS), so the API resolves it.
  const waRecipientCount = waGroupId ? null : waSelectedIds.length;
  const waCharsRemaining = WHATSAPP_MAX_CHARS - message.body.length;

  const handleSendWhatsapp = async () => {
    if (!message.body.trim()) { toast.warning('Please enter a message'); return; }
    if (!waGroupId && waSelectedIds.length === 0) { toast.warning(t('selectRecipients')); return; }

    const recipients = waMembers
      .filter(m => waSelectedIds.includes(m.id))
      .map(m => ({ phone: m.phone, name: m.name }));

    setSending(true);
    setWaResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        // Per-recipient reasons are too long for a toast but matter when
        // diagnosing a bad number or a revoked token.
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

    // ── Email actually goes out through Resend ──
    // This used to write a `messages` row and toast success without ever
    // dispatching anything, so nothing was delivered. The row is now written
    // from the real result, after the send.
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
        const { data: { session } } = await supabase.auth.getSession();
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

        // Recorded only now, reflecting what the provider actually accepted.
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
        // Per-recipient reasons are too long for a toast but matter when
        // diagnosing a bad address or a provider rejection.
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
    // No SMS provider is wired up, so this logs the message without sending
    // it. Left as-is: wiring SMS is a separate piece of work.
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

  // SMS segment info
  const smsSegments = message.body.length <= 160 ? 1 : Math.ceil(message.body.length / 153);
  const smsCharLimit = smsSegments === 1 ? 160 : smsSegments * 153;

  // Category-specific status options
  const getStatusOptions = () => {
    switch (segmentFilters.category) {
      case 'ALL_MEMBERS': return ['ACTIVE', 'INACTIVE', 'NEW'];
      case 'ALL_VISITORS': return ['NEW', 'PENDING', 'CONTACTED', 'COMPLETED'];
      case 'ALL_VOLUNTEERS': return ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
      default: return ['ACTIVE', 'INACTIVE'];
    }
  };

  return (
    <div>
      <PageHeader
        title="💬 Messaging Center"
        subtitle={t('sendMessages')}
      />

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total Contacts" value={allContacts.length} icon="👥" color="#6366f1" />
        <StatCard label="Members" value={allContacts.filter(c => c.type === 'Member').length} icon="📋" color="#10b981" />
        <StatCard label="Visitors" value={allContacts.filter(c => c.type === 'Visitor').length} icon="🚶" color="#f59e0b" />
        <StatCard label="Volunteers" value={allContacts.filter(c => c.type === 'Volunteer').length} icon="🙋" color="#8b5cf6" />
        <StatCard label="Messages Sent" value={messageHistory.length} icon="📤" color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { id: 'compose', label: '✏️ Compose', icon: '✏️' },
          { id: 'history', label: '📜 History', icon: '📜' },
          { id: 'templates', label: '📝 Templates', icon: '📝' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 24px', border: activeTab === tab.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
            borderRadius: '10px', backgroundColor: activeTab === tab.id ? '#eef2ff' : 'white',
            color: activeTab === tab.id ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === tab.id ? '600' : '400', cursor: 'pointer', fontSize: '14px'
          }}>{tab.label}</button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ═══════════════ COMPOSE TAB ═══════════════ */}
          {activeTab === 'compose' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

              {/* ── LEFT: Message Composer ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Channel Selector */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('selectChannel')}</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { id: 'SMS', icon: '📱', label: 'SMS', color: '#10b981', feature: 'sms' },
                      // WhatsApp only appears once the church has activated it in
                      // Settings; without a config row there is nothing to send with.
                      ...(whatsappEnabled ? [{ id: 'WHATSAPP', icon: '💬', label: t('whatsapp'), color: '#25d366', feature: 'messaging_whatsapp' }] : []),
                      { id: 'EMAIL', icon: '📧', label: 'Email', color: '#6366f1', feature: 'messaging_email' }
                    ].map(ch => {
                      const locked = !canAccessFeature(plan, ch.feature);
                      return (
                        <button key={ch.id} onClick={() => locked ? (onNavigate && onNavigate('settings')) : setMessage({ ...message, type: ch.id })} style={{
                          flex: 1, padding: '14px', border: message.type === ch.id && !locked ? `2px solid ${ch.color}` : '1px solid #e5e7eb',
                          borderRadius: '12px', backgroundColor: locked ? '#f9fafb' : (message.type === ch.id ? `${ch.color}15` : 'white'),
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                          opacity: locked ? 0.6 : 1
                        }}>
                          <span style={{ fontSize: '20px' }}>{locked ? '🔒' : ch.icon}</span>
                          <span style={{ fontWeight: message.type === ch.id && !locked ? '600' : '400', color: locked ? '#9ca3af' : (message.type === ch.id ? ch.color : '#6b7280'), fontSize: '14px' }}>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audience Builder (SMS/Email only) */}
                {message.type !== 'WHATSAPP' && (<>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audience</label>
                    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
                      <button onClick={() => setAudienceMode('segment')} style={{
                        padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '13px', cursor: 'pointer',
                        backgroundColor: audienceMode === 'segment' ? 'white' : 'transparent',
                        color: audienceMode === 'segment' ? '#6366f1' : '#6b7280',
                        fontWeight: audienceMode === 'segment' ? '600' : '400',
                        boxShadow: audienceMode === 'segment' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}>📊 Segment</button>
                      <button onClick={() => setAudienceMode('individual')} style={{
                        padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '13px', cursor: 'pointer',
                        backgroundColor: audienceMode === 'individual' ? 'white' : 'transparent',
                        color: audienceMode === 'individual' ? '#6366f1' : '#6b7280',
                        fontWeight: audienceMode === 'individual' ? '600' : '400',
                        boxShadow: audienceMode === 'individual' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}>👤 Individual</button>
                    </div>
                  </div>

                  {/* SEGMENT MODE */}
                  {audienceMode === 'segment' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Row 1: Category + Location */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Category</label>
                          <select value={segmentFilters.category} onChange={(e) => setSegmentFilters({ ...segmentFilters, category: e.target.value, ministry: 'all', status: 'all' })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white' }}>
                            <option value="ALL_CONTACTS">👥 All Contacts</option>
                            <option value="ALL_MEMBERS">📋 Members</option>
                            <option value="ALL_VISITORS">🚶 Visitors</option>
                            <option value="ALL_VOLUNTEERS">🙋 Volunteers</option>
                            <option value="MINISTRY">⛪ Ministry Team</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Location</label>
                          <select value={segmentFilters.location} onChange={(e) => setSegmentFilters({ ...segmentFilters, location: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white' }}>
                            <option value="all">📍 All Locations</option>
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.is_main_campus ? `🏛️ ${loc.name}` : loc.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Status + Ministry (conditional) */}
                      <div style={{ display: 'grid', gridTemplateColumns: segmentFilters.category === 'MINISTRY' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Status</label>
                          <select value={segmentFilters.status} onChange={(e) => setSegmentFilters({ ...segmentFilters, status: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white' }}>
                            <option value="all">All Statuses</option>
                            {getStatusOptions().map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        {segmentFilters.category === 'MINISTRY' && (
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Ministry</label>
                            <select value={segmentFilters.ministry} onChange={(e) => setSegmentFilters({ ...segmentFilters, ministry: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white' }}>
                              <option value="all">All Ministries</option>
                              {ministries.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Audience Summary Bar */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', backgroundColor: recipientCount > 0 ? '#eef2ff' : '#fef2f2',
                        borderRadius: '10px', border: `1px solid ${recipientCount > 0 ? '#c7d2fe' : '#fecaca'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '24px', fontWeight: '700', color: recipientCount > 0 ? '#4f46e5' : '#ef4444' }}>{recipientCount}</span>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>recipient{recipientCount !== 1 ? 's' : ''} matched</span>
                        </div>
                        {recipientCount > 0 && (
                          <button onClick={() => setShowRecipientPreview(!showRecipientPreview)} style={{
                            padding: '6px 12px', border: '1px solid #c7d2fe', borderRadius: '6px', backgroundColor: 'white',
                            fontSize: '12px', color: '#6366f1', cursor: 'pointer', fontWeight: '500'
                          }}>{showRecipientPreview ? 'Hide' : 'Preview'} List</button>
                        )}
                      </div>

                      {/* Recipient Preview */}
                      {showRecipientPreview && recipientCount > 0 && (
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px' }}>
                          {getSegmentRecipients().map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < recipientCount - 1 ? '1px solid #f3f4f6' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: r.type === 'Member' ? '#dbeafe' : r.type === 'Visitor' ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                  {r.type === 'Member' ? '📋' : r.type === 'Visitor' ? '🚶' : '🙋'}
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{r.name}</p>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{r.phone} · {getLocationName(r.location_id)}</p>
                                </div>
                              </div>
                              <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: r.type === 'Member' ? '#dbeafe' : r.type === 'Visitor' ? '#fef3c7' : '#dcfce7', borderRadius: '4px', color: '#6b7280', fontWeight: '500' }}>{r.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* INDIVIDUAL MODE */}
                  {audienceMode === 'individual' && (
                    <div>
                      {/* Search Box */}
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input
                          type="text"
                          placeholder="🔍 Search by name, phone, or email..."
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
                        />
                        {/* Search Results Dropdown */}
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

                      {/* Selected Individuals as Chips */}
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
                {/* WhatsApp uses its own recipient model (members with a phone,
                    or a group expanded server-side), so it replaces the generic
                    audience builder rather than layering onto it. */}
                {message.type === 'WHATSAPP' && (
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('selectRecipients')}</label>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {t('messagesToday')}: <strong>{whatsappConfig?.messages_sent_today || 0}</strong> / {whatsappConfig?.daily_limit || 0}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <select value={waGroupId} onChange={(e) => { setWaGroupId(e.target.value); setWaSelectedIds([]); }} style={{ flex: '1 1 200px', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}>
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
                      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px' }}>
                        {waMembers.map((m, i) => (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < waMembers.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}>
                            <input type="checkbox" checked={waSelectedIds.includes(m.id)} onChange={() => toggleWaMember(m.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{m.name}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{m.phone}</span>
                          </label>
                        ))}
                        {waMembers.length === 0 && (
                          <p style={{ margin: 0, padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>{t('noPhoneNumber')}</p>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>
                    <textarea
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

                    {/* Result of the last send */}
                    {waResult && (
                      <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: waResult.failed > 0 ? '#fef3c7' : '#dcfce7', color: waResult.failed > 0 ? '#92400e' : '#166534' }}>
                        <span>{t('whatsappSentSummary').replace('{sent}', waResult.sent).replace('{failed}', waResult.failed)}</span>
                        {/* Toast messages are plain strings in this app, so the
                            link through to the per-recipient log lives here. */}
                        <button type="button" onClick={() => onNavigate && onNavigate('whatsappLog')} style={{ border: 'none', background: 'none', padding: 0, color: 'inherit', fontSize: '14px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                          {t('viewLog')}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                      <button
                        onClick={handleSendWhatsapp}
                        disabled={sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)}
                        style={{
                          flex: 1, padding: '14px 24px', border: 'none', borderRadius: '10px',
                          backgroundColor: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? '#e5e7eb' : '#25d366',
                          color: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? '#9ca3af' : 'white',
                          fontSize: '15px', fontWeight: '600',
                          cursor: (sending || !message.body.trim() || (!waGroupId && waSelectedIds.length === 0)) ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                        }}
                      >
                        {sending
                          ? `⏳ ${t('sendingMessages')}`
                          : `📱 ${t('sendViaWhatsApp')}${waRecipientCount !== null ? ` (${waRecipientCount})` : ''}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Composer (SMS/Email only) */}
                {message.type !== 'WHATSAPP' && (
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>

                  {/* Subject (for Email) */}
                  {message.type === 'EMAIL' && (
                    <div style={{ marginBottom: '12px' }}>
                      <input type="text" placeholder="Subject line..." value={message.subject} onChange={(e) => setMessage({ ...message, subject: e.target.value })} style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }} />
                    </div>
                  )}

                  <textarea
                    value={message.body}
                    onChange={(e) => setMessage({ ...message, body: e.target.value })}
                    placeholder={message.type === 'EMAIL' ? 'Compose your email...' : 'Type your message here...\n\nUse {{name}} for personalization'}
                    style={{ width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', minHeight: message.type === 'EMAIL' ? '200px' : '120px', resize: 'vertical', lineHeight: '1.5' }}
                  />

                  {/* Character Counter + SMS Segment Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                      <span>{message.body.length} characters</span>
                      {message.type === 'SMS' && <span style={{ color: smsSegments > 1 ? '#f59e0b' : '#9ca3af' }}>· {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}</span>}
                    </div>
                    {message.type === 'SMS' && message.body.length > 140 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
                        ⚠️ Multi-segment SMS costs more
                      </span>
                    )}
                  </div>

                  {/* Send Bar */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                    <button onClick={handleSend} disabled={sending || recipientCount === 0 || !message.body} style={{
                      flex: 1, padding: '14px 24px', border: 'none', borderRadius: '10px',
                      backgroundColor: (sending || recipientCount === 0 || !message.body) ? '#e5e7eb' : '#6366f1',
                      color: (sending || recipientCount === 0 || !message.body) ? '#9ca3af' : 'white',
                      fontSize: '15px', fontWeight: '600', cursor: (sending || recipientCount === 0 || !message.body) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
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
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Audiences</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { label: 'All Members', cat: 'ALL_MEMBERS', status: 'all', icon: '📋' },
                      { label: 'Active Members', cat: 'ALL_MEMBERS', status: 'ACTIVE', icon: '✅' },
                      { label: 'All Visitors', cat: 'ALL_VISITORS', status: 'all', icon: '🚶' },
                      { label: 'New Visitors', cat: 'ALL_VISITORS', status: 'NEW', icon: '🆕' },
                      { label: 'All Volunteers', cat: 'ALL_VOLUNTEERS', status: 'all', icon: '🙋' },
                      { label: 'Everyone', cat: 'ALL_CONTACTS', status: 'all', icon: '🌍' },
                    ].map((preset, i) => (
                      <button key={i} onClick={() => { setAudienceMode('segment'); setSegmentFilters({ ...segmentFilters, category: preset.cat, status: preset.status, location: 'all', ministry: 'all' }); }} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                        border: (segmentFilters.category === preset.cat && segmentFilters.status === preset.status && audienceMode === 'segment') ? '1px solid #c7d2fe' : '1px solid #f3f4f6',
                        borderRadius: '8px', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                        backgroundColor: (segmentFilters.category === preset.cat && segmentFilters.status === preset.status && audienceMode === 'segment') ? '#eef2ff' : 'white',
                        color: '#374151', fontWeight: '400'
                      }}>
                        <span>{preset.icon}</span>
                        <span style={{ flex: 1 }}>{preset.label}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {(() => {
                            let pool = preset.cat === 'ALL_CONTACTS' ? allContacts :
                              allContacts.filter(c => c.type === (preset.cat === 'ALL_MEMBERS' ? 'Member' : preset.cat === 'ALL_VISITORS' ? 'Visitor' : 'Volunteer'));
                            if (preset.status !== 'all') pool = pool.filter(c => c.status === preset.status);
                            return pool.length;
                          })()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Templates */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Templates</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {templates.slice(0, 5).map((template, i) => (
                      <button key={i} onClick={() => applyTemplate(template)} style={{
                        padding: '10px 12px', border: '1px solid #f3f4f6', borderRadius: '8px',
                        backgroundColor: 'white', cursor: 'pointer', textAlign: 'left'
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
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '600', color: '#166534' }}>💡 Best Practices</h4>
                  <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.8' }}>
                    <p style={{ margin: '0 0 4px 0' }}>• SMS: Keep under 160 chars (1 segment)</p>
                    <p style={{ margin: '0 0 4px 0' }}>• Use {"{{name}}"} to personalize</p>
                    <p style={{ margin: '0 0 4px 0' }}>• Include church name for recognition</p>
                    <p style={{ margin: '0 0 4px 0' }}>• Add a clear call to action</p>
                    <p style={{ margin: 0 }}>• Send during business hours</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ HISTORY TAB ═══════════════ */}
          {activeTab === 'history' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📜 Message History</h3>
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>{messageHistory.length} messages</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Channel</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Audience</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {messageHistory.map((msg, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{formatDate(msg.sent_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: msg.message_type === 'SMS' ? '#dbeafe' : msg.message_type === 'EMAIL' ? '#eef2ff' : '#dcfce7', color: msg.message_type === 'SMS' ? '#1e40af' : msg.message_type === 'EMAIL' ? '#4338ca' : '#166534', borderRadius: '9999px', fontSize: '11px', fontWeight: '500' }}>
                          {msg.message_type === 'SMS' ? '📱' : msg.message_type === 'EMAIL' ? '📧' : '💬'} {msg.message_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>{msg.recipient_count}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>{msg.recipient_type?.replace('ALL_', '').replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <p style={{ margin: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{msg.body}</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: msg.status === 'SENT' ? '#dcfce7' : msg.status === 'FAILED' ? '#fef2f2' : '#fef3c7', color: msg.status === 'SENT' ? '#166534' : msg.status === 'FAILED' ? '#991b1b' : '#92400e', borderRadius: '9999px', fontSize: '11px', fontWeight: '500' }}>
                          {msg.status === 'SENT' ? '✅' : msg.status === 'FAILED' ? '❌' : '⏳'} {msg.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {messageHistory.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                      <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
                      No messages sent yet
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
          {activeTab === 'templates' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📝 Message Templates</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Manage templates in Settings → Automation</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {templates.map((template, i) => (
                  <div key={i} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>{template.name}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: template.category === 'BIRTHDAY' ? '#fef3c7' : '#dbeafe', color: template.category === 'BIRTHDAY' ? '#92400e' : '#1e40af', borderRadius: '6px', fontSize: '11px' }}>{template.category}</span>
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
    </div>
  );
}
// ==========================================
// REPORTS PAGE
// ==========================================

export default MessagingPage;
