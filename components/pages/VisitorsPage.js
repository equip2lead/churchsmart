"use client";
// VisitorsPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject, isValidEmail, WHATSAPP_MAX_CHARS } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, SMSModal, exportToCSV, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';
import { seedDefaultTemplates } from '../../lib/messageDefaults';

function VisitorsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [visitors, setVisitors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', whatsapp: '',
    visit_date: new Date().toISOString().split('T')[0],
    is_first_time: true, how_heard_about_us: '', prayer_request: '',
    followup_status: 'NOT_STARTED', language_preference: 'FRENCH', location_id: ''
  });

  useEffect(() => { fetchVisitors(); }, []);

  const fetchVisitors = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, locationsData] = await Promise.all([
        supabaseQuery('visitors', {
          filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }],
          order: 'visit_date.desc'
        }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      setVisitors(data || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Visitors fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location ? location.name : '—';
  };

  const resetForm = () => {
    const mainCampus = locations.find(l => l.is_main_campus);
    setForm({
      full_name: '', email: '', phone: '', whatsapp: '',
      gender: '',
      town_city: '', quartier: '',
      best_time_to_call: '', best_time_to_visit: '',
      attendance_status: '', looking_for: '',
      faith_decision: false, wants_baptism: false, wants_next_step: false,
      visit_date: new Date().toISOString().split('T')[0],
      is_first_time: true, how_heard_about_us: '', prayer_request: '',
      followup_status: 'NOT_STARTED', language_preference: 'FRENCH',
      location_id: mainCampus?.id || ''
    });
    setEditingVisitor(null);
  };

  const openModal = (visitor = null) => {
    if (visitor) {
      setEditingVisitor(visitor);
      setForm({
        full_name: visitor.full_name || '',
        email: visitor.email || '',
        phone: visitor.phone || '',
        whatsapp: visitor.whatsapp || '',
        gender: visitor.gender || '',
        town_city: visitor.town_city || '',
        quartier: visitor.quartier || '',
        best_time_to_call: visitor.best_time_to_call || '',
        best_time_to_visit: visitor.best_time_to_visit || '',
        attendance_status: visitor.attendance_status || '',
        looking_for: visitor.looking_for || '',
        faith_decision: !!visitor.faith_decision,
        wants_baptism: !!visitor.wants_baptism,
        wants_next_step: !!visitor.wants_next_step,
        visit_date: visitor.visit_date || '',
        is_first_time: visitor.is_first_time ?? true,
        how_heard_about_us: visitor.how_heard_about_us || '',
        prayer_request: visitor.prayer_request || '',
        followup_status: visitor.followup_status || 'NOT_STARTED',
        language_preference: visitor.language_preference || 'FRENCH',
        location_id: visitor.location_id || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const openSMSModal = (visitor) => {
    setSelectedVisitor(visitor);
    setShowSMSModal(true);
  };

  const handleSave = async () => {
    // Required-field gating MUST run before the optimistic UI swap below so
    // that a blocked save does not flash a temp row into the list.
    if (!form.full_name) {
      toast.warning(t('nameRequired'));
      return;
    }
    if (!form.phone) {
      toast.warning(t('phoneRequired'));
      return;
    }
    if (!form.attendance_status) {
      toast.warning(t('attendanceStatusRequired'));
      return;
    }
    // Duplicate detection
    if (!editingVisitor) {
      const possibleDupe = visitors.find(v => 
        (v.phone && form.phone && v.phone === form.phone) ||
        (v.full_name && form.full_name && v.full_name.toLowerCase() === form.full_name.toLowerCase())
      );
      if (possibleDupe && !confirm(`⚠️ Possible duplicate visitor: ${possibleDupe.full_name} (${possibleDupe.phone || 'no phone'}). Add anyway?`)) return;
    }

    const isInsert = !editingVisitor;
    const formSnapshot = form;
    const editingSnapshot = editingVisitor;
    const listSnapshot = visitors;
    // gender is a Postgres enum (gender_type) — empty string is rejected by
    // the enum cast. Normalize '' to null per the Round 4 fix pattern (d5a6559).
    // The other varchar columns (town_city, quartier, best_time_*, looking_for)
    // accept empty strings and are left untouched.
    const cleanedForm = {
      ...form,
      gender: form.gender || null,
      location_id: form.location_id || null,
      visit_date: form.visit_date || null
    };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setVisitors([{ id: tempId, ...cleanedForm }, ...visitors]);
    } else {
      setVisitors(visitors.map(v => v.id === editingVisitor.id ? { ...v, ...cleanedForm } : v));
    }
    setShowModal(false);
    resetForm();
    toast.success(t('savedSuccessfully'));

    try {
      if (isInsert) {
        const result = await supabaseInsert('visitors', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setVisitors(prev => prev.map(v => v.id === tempId ? realRow : v));
        }
        logActivity({
          action: 'visitor_created',
          entity_type: 'visitor',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.full_name || null,
          details: null
        });
      } else {
        await supabaseUpdate('visitors', editingVisitor.id, cleanedForm);
        logActivity({
          action: 'visitor_updated',
          entity_type: 'visitor',
          entity_id: editingVisitor.id,
          entity_name: cleanedForm.full_name || null,
          details: null
        });
      }
      fetchVisitors(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setVisitors(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingVisitor(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };

  const handleConvertToMember = async (visitor) => {
    if (visitor.converted_to_member_id) { toast.info(t('alreadyConverted')); return; }
    setSaving(true);
    try {
      const nameParts = (visitor.full_name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const { data: newMember } = await supabase.from('members').insert({
        church_id: CHURCH_ID,
        first_name: firstName,
        last_name: lastName,
        email: visitor.email || null,
        phone: visitor.phone || null,
        whatsapp: visitor.whatsapp || null,
        gender: visitor.gender || null,
        // visitor.town_city is the canonical column on visitors. The old line
        // `visitor.city || null` here was a silent no-op — `visitor.city` never
        // existed on the visitors table; the field has been propagating null
        // since before the Commit 2 schema redesign.
        city: visitor.town_city || null,
        quartier: visitor.quartier || null,
        language_preference: visitor.language_preference || null,
        location_id: visitor.location_id || null,
        membership_status: 'ACTIVE',
        membership_date: new Date().toISOString().split('T')[0],
        notes: 'Converted from visitor'
      }).select().single();
      if (newMember) {
        await supabase.from('visitors').update({
          converted_to_member_id: newMember.id,
          converted_at: new Date().toISOString()
        }).eq('id', visitor.id);
        logActivity({
          action: 'visitor_converted_to_member',
          entity_type: 'member',
          entity_id: newMember.id,
          entity_name: `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || null,
          details: { from_visitor_id: visitor.id }
        });
        toast.success(`${visitor.full_name} converted to member`);
        fetchVisitors();
      }
    } catch (error) { toast.error('Conversion failed: ' + error.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const deletedId = deleteConfirm.id;
    const deletedName = deleteConfirm.full_name || null;
    await supabaseDelete('visitors', deletedId);
    logActivity({
      action: 'visitor_deleted',
      entity_type: 'visitor',
      entity_id: deletedId,
      entity_name: deletedName,
      details: null
    });
    setDeleteConfirm(null);
    fetchVisitors();
  };

  const sendAutoFollowUp = async (visitor, dayType) => {
    try {
      // Try custom template first
      const templates = await supabaseQuery('message_templates', {
        filters: [
          { column: 'church_id', operator: 'eq', value: CHURCH_ID },
          { column: 'category', operator: 'eq', value: 'VISITOR' },
          { column: 'is_active', operator: 'eq', value: true }
        ]
      });

      // Find template matching this day type
      const template = (templates || []).find(tmpl =>
        tmpl.name?.toLowerCase().includes(`day_${dayType}`) ||
        tmpl.name?.toLowerCase().includes(`day${dayType}`)
      );

      // Get church name for variable replacement
      const churchData = await supabaseQuery('churches', {
        select: 'name',
        filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }],
        single: true
      });
      const churchName = churchData?.name || '';

      let message;
      if (template?.body) {
        message = template.body
          .replace(/\{name\}/gi, visitor.full_name || '')
          .replace(/\{churchName\}/gi, churchName);
      } else {
        // No templates at all — seed defaults so they appear in Settings
        if (!templates || templates.length === 0) {
          seedDefaultTemplates(supabase, CHURCH_ID).catch(() => {});
        }
        message = t(`day${dayType}Message`).replace(/\{churchName\}/gi, churchName);
      }

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId: visitor.church_id || CHURCH_ID,
          recipients: [{ phone: visitor.phone, name: visitor.full_name }],
          message,
          purpose: `visitor_followup_day${dayType}`
        })
      });
      const result = await res.json();
      if (res.ok && result.sent > 0) {
        await supabaseUpdate('visitors', visitor.id, { followup_status: 'IN_PROGRESS' });
        fetchVisitors();
        toast.info(`✅ Day ${dayType} message sent to ${visitor.full_name}!`);
      } else {
        toast.info(`❌ Failed to send message: ${result.error || result.failures?.[0]?.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.info(`❌ Failed to send message: ${error.message}`);
    }
  };

  const getVisitorDays = (visitDate) => {
    const visit = new Date(visitDate);
    const today = new Date();
    const diffTime = Math.abs(today - visit);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredVisitors = visitors.filter(v => {
    if (filterLocation !== 'all' && v.location_id !== filterLocation) return false;
    return v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search);
  });

  // Pre-built status colour map and label resolver — pulled out of the column
  // render closures so we don't rebuild on every row paint.
  const ATTENDANCE_STATUS_COLORS = {
    '1ST_TIME': { bg: '#fef3c7', fg: '#92400e' },
    'RETURNING': { bg: '#dbeafe', fg: '#1e40af' },
    'REGULAR': { bg: '#dcfce7', fg: '#166534' }
  };
  const attendanceStatusLabel = (s) => {
    if (s === '1ST_TIME') return t('attendance1stTime');
    if (s === 'RETURNING') return t('attendanceReturning');
    if (s === 'REGULAR') return t('attendanceRegular');
    return s || '';
  };

  const columns = [
    { header: t('name'), key: 'full_name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: t('visitDate'), key: 'visit_date', render: (row) => new Date(row.visit_date).toLocaleDateString() },
    { header: t('phone'), key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone}</span> },
    { header: t('visitorAttendanceStatus'), key: 'attendance_status', render: (row) => {
        if (!row.attendance_status) return <span style={{ color: '#9ca3af' }}>—</span>;
        const c = ATTENDANCE_STATUS_COLORS[row.attendance_status] || { bg: '#f3f4f6', fg: '#374151' };
        return <span style={{ padding: '2px 10px', backgroundColor: c.bg, color: c.fg, borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{attendanceStatusLabel(row.attendance_status)}</span>;
      } },
    { header: `${t('visitorTownCity')} / ${t('visitorQuartier')}`, key: 'town_quartier', render: (row) => {
        const parts = [row.town_city, row.quartier].filter(Boolean);
        return parts.length === 0 ? <span style={{ color: '#9ca3af' }}>—</span> : <span style={{ color: '#6b7280', fontSize: '13px' }}>{parts.join(' · ')}</span>;
      } },
    { header: '📍 Location', key: 'location', render: (row) => <span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>{getLocationName(row.location_id)}</span> },
    { header: t('howHeard'), key: 'how_heard', render: (row) => <span style={{ color: '#6b7280' }}>{row.how_heard_about_us || '—'}</span> },
    { header: t('status'), key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
    { header: t('firstTime'), key: 'first_time', render: (row) => row.is_first_time ? '✅' : '🔄' },
    { header: t('convertToMember'), key: 'convert', render: (row) => row.converted_to_member_id ? <span style={{ padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{t('converted')}</span> : <button onClick={(e) => { e.stopPropagation(); handleConvertToMember(row); }} disabled={saving} style={{ padding: '4px 12px', border: '1px solid #6366f1', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#4f46e5', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>{t('convertToMember')}</button> },
  ];

  return (
    <div>
      <PageHeader
        title={`🚶 ${t('visitors')}`}
        subtitle={`${visitors.length} ${t('total')}`}
        actions={<div style={{ display: 'flex', gap: '10px' }}><Button variant="secondary" onClick={() => {
          const ok = exportToCSV(filteredVisitors, [
            { label: 'Full Name', key: 'full_name' },
            { label: 'Phone', key: 'phone' },
            { label: 'WhatsApp', key: 'whatsapp' },
            { label: 'Email', key: 'email' },
            { label: 'Visit Date', key: 'visit_date' },
            { label: 'How Heard', key: 'how_heard_about_us' },
            { label: 'Follow-up', key: 'followup_status' },
            { label: 'Town/City', key: 'town_city' },
            { label: 'Quartier', key: 'quartier' },
            { label: 'Gender', key: 'gender' },
            { label: 'Best Time to Call', key: 'best_time_to_call' },
            { label: 'Best Time to Visit', key: 'best_time_to_visit' },
            { label: 'Attendance Status', key: 'attendance_status' },
            { label: 'Looking For', key: 'looking_for' },
            { label: 'Faith Decision', accessor: r => r.faith_decision ? 'Yes' : 'No' },
            { label: 'Wants Baptism', accessor: r => r.wants_baptism ? 'Yes' : 'No' },
            { label: 'Wants Next Step', accessor: r => r.wants_next_step ? 'Yes' : 'No' },
          ], 'visitors');
          if (ok) toast.success(t('csvExportedSuccess')); else toast.warning(t('noRecordsToExport'));
        }}>📥 {t('exportCSV')}</Button><Button onClick={() => openModal()}>➕ {t('addVisitor')}</Button></div>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={visitors.length} icon="🚶" />
        <StatCard label={t('notStarted')} value={visitors.filter(v => v.followup_status === 'NOT_STARTED').length} icon="⏰" color="#f59e0b" />
        <StatCard label={t('inProgress')} value={visitors.filter(v => v.followup_status === 'IN_PROGRESS').length} icon="🔄" color="#3b82f6" />
        <StatCard label={t('becameMember')} value={visitors.filter(v => v.followup_status === 'BECAME_MEMBER').length} icon="✅" color="#10b981" />
      </div>

      {/* Auto Follow-up Section */}
      <div style={{ backgroundColor: '#f0fdf4', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #bbf7d0' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#166534' }}>📱 Auto Follow-up Queue</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {visitors.filter(v => v.followup_status === 'NOT_STARTED' || v.followup_status === 'IN_PROGRESS').slice(0, 5).map((visitor, i) => {
            const days = getVisitorDays(visitor.visit_date);
            return (
              <div key={i} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', minWidth: '200px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>{visitor.full_name}</p>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280' }}>Visited {days} day(s) ago</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {days >= 1 && (
                    <button onClick={() => sendAutoFollowUp(visitor, 1)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#dcfce7', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#166534' }}>
                      📱 Day 1
                    </button>
                  )}
                  {days >= 3 && (
                    <button onClick={() => sendAutoFollowUp(visitor, 3)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#dbeafe', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#1e40af' }}>
                      📱 Day 3
                    </button>
                  )}
                  {days >= 7 && (
                    <button onClick={() => sendAutoFollowUp(visitor, 7)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#fef3c7', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#92400e' }}>
                      📱 Day 7
                    </button>
                  )}
                  <button onClick={() => openSMSModal(visitor)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    ✉️ Custom
                  </button>
                </div>
              </div>
            );
          })}
          {visitors.filter(v => v.followup_status === 'NOT_STARTED' || v.followup_status === 'IN_PROGRESS').length === 0 && (
            <p style={{ color: '#6b7280' }}>No visitors pending follow-up 🎉</p>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <SearchBar value={search} onChange={setSearch} />
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Locations</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>
        {loading ? <LoadingSpinner /> : (
          <DataTable columns={columns} data={filteredVisitors} onEdit={openModal} onDelete={setDeleteConfirm} onSMS={openSMSModal} emptyMessage={t('emptyVisitors')} />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingVisitor ? `✏️ ${t('editVisitor')}` : `➕ ${t('addVisitor')}`}>
        {/* REQUIRED — full name, phone, attendance status. Validation in handleSave gates save before optimistic UI. */}
        <FormInput label={`${t('name')} *`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={`${t('phone')} *`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+237 6XX XXX XXX" />
          <FormInput label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+237 6XX XXX XXX" />
        </div>
        <FormInput label={`${t('visitorAttendanceStatus')} *`} type="select" value={form.attendance_status} onChange={(e) => setForm({ ...form, attendance_status: e.target.value })} required
          options={[{ value: '', label: '— Select —' }, { value: '1ST_TIME', label: t('attendance1stTime') }, { value: 'RETURNING', label: t('attendanceReturning') }, { value: 'REGULAR', label: t('attendanceRegular') }]} />

        {/* CONTACT — optional */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <FormInput label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput label={t('visitorTownCity')} value={form.town_city} onChange={(e) => setForm({ ...form, town_city: e.target.value })} placeholder="Yaoundé" />
            <FormInput label={t('visitorQuartier')} value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Bastos" />
          </div>
          <FormInput label={t('gender')} type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
            options={[{ value: '', label: '— Select —' }, { value: 'MALE', label: t('male') }, { value: 'FEMALE', label: t('female') }]} />
        </div>

        {/* BEST TIME — optional, both dropdowns share the same 4 enum values */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput label={t('visitorBestTimeCall')} type="select" value={form.best_time_to_call} onChange={(e) => setForm({ ...form, best_time_to_call: e.target.value })}
              options={[{ value: '', label: '— Select —' }, { value: 'MORNING', label: t('timeMorning') }, { value: 'AFTERNOON', label: t('timeAfternoon') }, { value: 'EVENING', label: t('timeEvening') }, { value: 'WEEKENDS_ONLY', label: t('timeWeekendsOnly') }]} />
            <FormInput label={t('visitorBestTimeVisit')} type="select" value={form.best_time_to_visit} onChange={(e) => setForm({ ...form, best_time_to_visit: e.target.value })}
              options={[{ value: '', label: '— Select —' }, { value: 'MORNING', label: t('timeMorning') }, { value: 'AFTERNOON', label: t('timeAfternoon') }, { value: 'EVENING', label: t('timeEvening') }, { value: 'WEEKENDS_ONLY', label: t('timeWeekendsOnly') }]} />
          </div>
        </div>

        {/* VISIT INFO — optional */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput label={t('visitDate')} type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
            <FormInput label="📍 Location" type="select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
          </div>
          <FormInput label={t('visitorLookingFor')} type="select" value={form.looking_for} onChange={(e) => setForm({ ...form, looking_for: e.target.value })}
            options={[{ value: '', label: '— Select —' }, { value: 'CHURCH_COMMUNITY', label: t('lookingForChurch') }, { value: 'JUST_VISITING', label: t('lookingForJustVisiting') }]} />
        </div>

        {/* SPIRITUAL DECISIONS — three independent booleans, in edit mode the existing checked state is restored from openModal */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>{t('visitorSpiritualDecisions')}</p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.faith_decision} onChange={(e) => setForm({ ...form, faith_decision: e.target.checked })} style={{ marginTop: '4px' }} />
            <span style={{ fontSize: '14px' }}>{t('visitorFaithDecision')}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.wants_baptism} onChange={(e) => setForm({ ...form, wants_baptism: e.target.checked })} style={{ marginTop: '4px' }} />
            <span style={{ fontSize: '14px' }}>{t('visitorWantsBaptism')}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.wants_next_step} onChange={(e) => setForm({ ...form, wants_next_step: e.target.checked })} style={{ marginTop: '4px' }} />
            <span style={{ fontSize: '14px' }}>{t('visitorWantsNextStep')}</span>
          </label>
        </div>

        {/* NOTES — how-heard, follow-up status, prayer request, first-time toggle */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <FormInput label={t('howHeard')} type="select" value={form.how_heard_about_us} onChange={(e) => setForm({ ...form, how_heard_about_us: e.target.value })}
            options={[{ value: '', label: '—' }, { value: 'Friend/Family', label: 'Friend/Family' }, { value: 'Social Media', label: 'Social Media' }, { value: 'Walk-in', label: 'Walk-in' }, { value: 'Flyer/Poster', label: 'Flyer/Poster' }, { value: 'Online Search', label: 'Online Search' }, { value: 'Event', label: 'Event' }]} />
          <FormInput label={t('followUpStatus')} type="select" value={form.followup_status} onChange={(e) => setForm({ ...form, followup_status: e.target.value })}
            options={[{ value: 'NOT_STARTED', label: t('notStarted') }, { value: 'IN_PROGRESS', label: t('inProgress') }, { value: 'COMPLETED', label: t('completed') }, { value: 'BECAME_MEMBER', label: t('becameMember') }]} />
          <FormInput label="Prayer Request" type="textarea" value={form.prayer_request} onChange={(e) => setForm({ ...form, prayer_request: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_first_time} onChange={(e) => setForm({ ...form, is_first_time: e.target.checked })} />
            <span style={{ fontSize: '14px' }}>{t('firstTime')}</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳...' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

      {/* SMS Modal */}
      <SMSModal 
        isOpen={showSMSModal} 
        onClose={() => setShowSMSModal(false)} 
        recipient={selectedVisitor}
        onSend={fetchVisitors}
      />

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete}
        title={`🗑️ ${t('delete')}`} message={`Are you sure you want to delete ${deleteConfirm?.full_name}?`} />
    </div>
  );
}
// ==========================================
// ATTENDANCE PAGE - With Charts, Filters & Multi-Location
// ==========================================

export default VisitorsPage;
