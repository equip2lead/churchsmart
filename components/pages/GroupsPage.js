"use client";
// GroupsPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatCard, StatusBadge } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function GroupsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');
  const [form, setForm] = useState({ name: '', description: '', group_type: 'CELL', meeting_day: 'WEDNESDAY', meeting_time: '18:00', is_active: true, location_id: '' });

  useEffect(() => { fetchGroups(); }, []);
  const fetchGroups = async (silent = false) => { if (!silent) setLoading(true); try { const [data, locData] = await Promise.all([supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }), supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })]); setGroups(data || []); setLocations(locData || []); } catch (error) { console.error('Groups fetch error:', error); } finally { if (!silent) setLoading(false); } };
  const getLocationName = (locationId) => { const loc = locations.find(l => l.id === locationId); return loc ? loc.name : '—'; };
  const resetForm = () => { const mainCampus = locations.find(l => l.is_main_campus); setForm({ name: '', description: '', group_type: 'CELL', meeting_day: 'WEDNESDAY', meeting_time: '18:00', is_active: true, location_id: mainCampus?.id || '' }); setEditingGroup(null); };
  const openModal = (group = null) => { if (group) { setEditingGroup(group); setForm({ name: group.name || '', description: group.description || '', group_type: group.group_type || 'CELL', meeting_day: group.meeting_day || 'WEDNESDAY', meeting_time: group.meeting_time || '18:00', is_active: group.is_active ?? true, location_id: group.location_id || '' }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => {
    if (!form.name) { toast.warning(t('nameRequired')); return; }
    const isInsert = !editingGroup;
    const formSnapshot = form;
    const editingSnapshot = editingGroup;
    const listSnapshot = groups;
    const cleanedForm = { ...form, location_id: form.location_id || null, meeting_time: form.meeting_time || null };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (isInsert) {
      setGroups([{ id: tempId, ...cleanedForm }, ...groups]);
    } else {
      setGroups(groups.map(g => g.id === editingGroup.id ? { ...g, ...cleanedForm } : g));
    }
    setShowModal(false);
    resetForm();
    toast.success(t('savedSuccessfully'));
    try {
      if (isInsert) {
        const result = await supabaseInsert('groups', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setGroups(prev => prev.map(g => g.id === tempId ? realRow : g));
        }
        logActivity({
          action: 'group_created',
          entity_type: 'group',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.name || null,
          details: null
        });
      } else {
        await supabaseUpdate('groups', editingGroup.id, cleanedForm);
        logActivity({
          action: 'group_updated',
          entity_type: 'group',
          entity_id: editingGroup.id,
          entity_name: cleanedForm.name || null,
          details: null
        });
      }
      fetchGroups(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setGroups(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingGroup(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    await supabaseDelete('groups', target.id);
    logActivity({
      action: 'group_deleted',
      entity_type: 'group',
      entity_id: target.id,
      entity_name: target.name || null,
      details: null
    });
    setDeleteConfirm(null);
    fetchGroups();
  };

  const filteredGroups = groups.filter(g => filterLocation === 'all' || g.location_id === filterLocation);

  return (
    <div>
      <PageHeader title={`👨‍👩‍👧‍👦 ${t('groups')}`} subtitle={`${groups.length} ${t('groups')}`} actions={<Button onClick={() => openModal()}>➕ {t('createGroup')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={filteredGroups.length} icon="👥" />
        <StatCard label={t('active')} value={filteredGroups.filter(g => g.is_active).length} icon="✅" color="#10b981" />
        <StatCard label={t('cellGroup')} value={filteredGroups.filter(g => g.group_type === 'CELL').length} icon="🏠" color="#6366f1" />
      </div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
          <option value="all">All Locations</option>
          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredGroups.map((group) => (
            <div key={group.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👥</div>
                <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => openModal(group)} style={{ padding: '8px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>✏️</button><button onClick={() => setDeleteConfirm(group)} style={{ padding: '8px', border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button></div>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>{group.name}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>{group.description || 'No description'}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><StatusBadge status={group.group_type} />{group.is_active && <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>{t('active')}</span>}{group.location_id && <span style={{ padding: '4px 12px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '9999px', fontSize: '12px' }}>📍 {getLocationName(group.location_id)}</span>}</div>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', fontSize: '14px', color: '#6b7280' }}>📅 {group.meeting_day} {group.meeting_time && `at ${group.meeting_time}`}</div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingGroup ? `✏️ ${t('edit')}` : `➕ ${t('createGroup')}`}>
        <FormInput label={t('groupName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <FormInput label={t('description')} type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('groupType')} type="select" value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value })} options={[{ value: 'CELL', label: t('cellGroup') }, { value: 'DEPARTMENT', label: t('department') }, { value: 'MINISTRY', label: t('ministry') }]} />
          <FormInput label={t('meetingDay')} type="select" value={form.meeting_day} onChange={(e) => setForm({ ...form, meeting_day: e.target.value })} options={[{ value: 'SUNDAY', label: t('sunday') }, { value: 'MONDAY', label: t('monday') }, { value: 'TUESDAY', label: t('tuesday') }, { value: 'WEDNESDAY', label: t('wednesday') }, { value: 'THURSDAY', label: t('thursday') }, { value: 'FRIDAY', label: t('friday') }, { value: 'SATURDAY', label: t('saturday') }]} />
        </div>
        <FormInput label={t('meetingTime')} type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} />
        <FormInput label="📍 Location" type="select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span>{t('active')}</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message={`Delete "${deleteConfirm?.name}"?`} />
    </div>
  );
}

// ==========================================
// VOLUNTEERS PAGE
// ==========================================

export default GroupsPage;
