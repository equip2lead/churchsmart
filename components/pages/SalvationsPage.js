"use client";
// SalvationsPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, exportToCSV, StatCard, StatusBadge } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function SalvationsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [salvations, setSalvations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', gender: '', age_group: '', salvation_date: new Date().toISOString().split('T')[0], followup_status: 'PENDING', followup_notes: '', location_id: '' });

  useEffect(() => { fetchSalvations(); }, []);
  const fetchSalvations = async (silent = false) => { if (!silent) setLoading(true); try { const [data, locData] = await Promise.all([supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'salvation_date.desc' }), supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })]); setSalvations(data || []); setLocations(locData || []); } catch (error) { console.error('Salvations fetch error:', error); } finally { if (!silent) setLoading(false); } };
  const getLocationName = (locationId) => { const loc = locations.find(l => l.id === locationId); return loc ? loc.name : '—'; };
  const resetForm = () => { const mainCampus = locations.find(l => l.is_main_campus); setForm({ full_name: '', phone: '', email: '', gender: '', age_group: '', salvation_date: new Date().toISOString().split('T')[0], followup_status: 'PENDING', followup_notes: '', location_id: mainCampus?.id || '' }); setEditingRecord(null); };
  const openModal = (record = null) => { if (record) { setEditingRecord(record); setForm({ full_name: record.full_name || '', phone: record.phone || '', email: record.email || '', gender: record.gender || '', age_group: record.age_group || '', salvation_date: record.salvation_date || '', followup_status: record.followup_status || 'PENDING', followup_notes: record.followup_notes || '', location_id: record.location_id || '' }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => {
    if (!form.full_name) { toast.warning(t('nameRequired')); return; }
    const isInsert = !editingRecord;
    const formSnapshot = form;
    const editingSnapshot = editingRecord;
    const listSnapshot = salvations;
    const cleanedForm = { ...form, location_id: form.location_id || null, salvation_date: form.salvation_date || null };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (isInsert) {
      setSalvations([{ id: tempId, ...cleanedForm }, ...salvations]);
    } else {
      setSalvations(salvations.map(s => s.id === editingRecord.id ? { ...s, ...cleanedForm } : s));
    }
    setShowModal(false);
    resetForm();
    toast.success(t('savedSuccessfully'));
    try {
      if (isInsert) {
        const result = await supabaseInsert('salvations', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setSalvations(prev => prev.map(s => s.id === tempId ? realRow : s));
        }
        logActivity({
          action: 'salvation_created',
          entity_type: 'salvation',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.full_name || null,
          details: null
        });
      } else {
        await supabaseUpdate('salvations', editingRecord.id, cleanedForm);
        logActivity({
          action: 'salvation_updated',
          entity_type: 'salvation',
          entity_id: editingRecord.id,
          entity_name: cleanedForm.full_name || null,
          details: null
        });
      }
      fetchSalvations(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setSalvations(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingRecord(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    await supabaseDelete('salvations', target.id);
    logActivity({
      action: 'salvation_deleted',
      entity_type: 'salvation',
      entity_id: target.id,
      entity_name: target.full_name || null,
      details: null
    });
    setDeleteConfirm(null);
    fetchSalvations();
  };

  const filteredSalvations = salvations.filter(function(s) { var loc = filterLocation === 'all' || s.location_id === filterLocation; var search = !searchTerm || (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone || '').includes(searchTerm) || (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()); return loc && search; });

  const columns = [
    { header: t('name'), key: 'name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: t('date'), key: 'date', render: (row) => new Date(row.salvation_date).toLocaleDateString() },
    { header: t('phone'), key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone || '—'}</span> },
    { header: '📍 Location', key: 'location', render: (row) => <span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>{getLocationName(row.location_id)}</span> },
    { header: t('status'), key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
  ];

  return (
    <div>
      <PageHeader title={`❤️ ${t('salvations')}`} subtitle={`${salvations.length} ${t('soulsWon')}`} actions={<Button onClick={() => openModal()}>➕ {t('recordSalvation')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={filteredSalvations.length} icon="❤️" color="#ef4444" />
        <StatCard label="This Month" value={filteredSalvations.filter(s => new Date(s.salvation_date) > new Date(Date.now() - 30*24*60*60*1000)).length} icon="📅" color="#6366f1" />
        <StatCard label="Pending" value={filteredSalvations.filter(s => s.followup_status === 'PENDING').length} icon="⏰" color="#f59e0b" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Showing {filteredSalvations.length} of {salvations.length}</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
              <input value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} placeholder="Search salvations..." style={{ padding: '8px 12px 8px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', width: '220px', backgroundColor: '#f9fafb' }} />
            </div>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Locations</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          </div>
        </div>
        {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={filteredSalvations} onEdit={openModal} onDelete={setDeleteConfirm} />}</div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? `✏️ ${t('edit')}` : `➕ ${t('recordSalvation')}`}>
        <FormInput label={t('name')} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <FormInput label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('gender')} type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'MALE', label: t('male') }, { value: 'FEMALE', label: t('female') }]} />
          <FormInput label={t('ageGroup')} type="select" value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })} options={[{ value: 'CHILD', label: t('child') }, { value: 'YOUTH', label: t('youth') }, { value: 'ADULT', label: t('adult') }, { value: 'SENIOR', label: t('senior') }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('date')} type="date" value={form.salvation_date} onChange={(e) => setForm({ ...form, salvation_date: e.target.value })} required />
          <FormInput label={t('status')} type="select" value={form.followup_status} onChange={(e) => setForm({ ...form, followup_status: e.target.value })} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'IN_PROGRESS', label: t('inProgress') }, { value: 'COMPLETED', label: t('completed') }]} />
        </div>
        <FormInput label="📍 Location" type="select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
        <FormInput label={t('followUpNotes')} type="textarea" value={form.followup_notes} onChange={(e) => setForm({ ...form, followup_notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message={`Delete ${deleteConfirm?.full_name}?`} />
    </div>
  );
}

// ==========================================
// GROUPS PAGE
// ==========================================

export default SalvationsPage;
