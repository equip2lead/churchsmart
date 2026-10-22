"use client";
// VolunteersPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, exportToCSV, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function VolunteersPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [volunteers, setVolunteers] = useState([]);
  const [members, setMembers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterMinistry, setFilterMinistry] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const ministries = ['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer', 'Outreach', 'Discipleship', 'Admin', 'Other'];
  const statuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
  const availabilities = ['Sundays', 'Weekends', 'Weekdays', 'All Services', 'Fridays & Sundays', 'Daily', 'As Needed'];

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', ministry: 'Worship', role: '',
    status: 'ACTIVE', availability: 'Sundays', start_date: '', skills: '',
    notes: '', emergency_contact: '', emergency_phone: '', is_team_leader: false, member_id: '', location_id: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [volunteersData, membersData, locData] = await Promise.all([
        supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      setVolunteers(volunteersData || []);
      setMembers(membersData || []);
      setLocations(locData || []);
    } catch (error) {
      console.error('Volunteers fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getLocationName = (locationId) => { const loc = locations.find(l => l.id === locationId); return loc ? loc.name : '—'; };

  const resetForm = () => {
    const mainCampus = locations.find(l => l.is_main_campus);
    setForm({
      full_name: '', email: '', phone: '', ministry: 'Worship', role: '',
      status: 'ACTIVE', availability: 'Sundays', start_date: '', skills: '',
      notes: '', emergency_contact: '', emergency_phone: '', is_team_leader: false, member_id: '',
      location_id: mainCampus?.id || ''
    });
    setEditingVolunteer(null);
  };

  const openModal = (volunteer = null) => {
    if (volunteer) {
      setEditingVolunteer(volunteer);
      setForm({
        full_name: volunteer.full_name || '',
        email: volunteer.email || '',
        phone: volunteer.phone || '',
        ministry: volunteer.ministry || 'Worship',
        role: volunteer.role || '',
        status: volunteer.status || 'ACTIVE',
        availability: volunteer.availability || 'Sundays',
        start_date: volunteer.start_date || '',
        skills: volunteer.skills || '',
        notes: volunteer.notes || '',
        emergency_contact: volunteer.emergency_contact || '',
        emergency_phone: volunteer.emergency_phone || '',
        is_team_leader: volunteer.is_team_leader || false,
        member_id: volunteer.member_id || '',
        location_id: volunteer.location_id || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.ministry) {
      toast.warning('Name and ministry are required');
      return;
    }

    const isInsert = !editingVolunteer;
    const formSnapshot = form;
    const editingSnapshot = editingVolunteer;
    const listSnapshot = volunteers;
    const cleanedForm = { ...form, member_id: form.member_id || null, location_id: form.location_id || null, start_date: form.start_date || null };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setVolunteers([{ id: tempId, ...cleanedForm }, ...volunteers]);
    } else {
      setVolunteers(volunteers.map(v => v.id === editingVolunteer.id ? { ...v, ...cleanedForm } : v));
    }
    setShowModal(false);
    resetForm();
    toast.success(t('savedSuccessfully'));

    try {
      if (isInsert) {
        const result = await supabaseInsert('volunteers', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setVolunteers(prev => prev.map(v => v.id === tempId ? realRow : v));
        }
        logActivity({
          action: 'volunteer_created',
          entity_type: 'volunteer',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.full_name || null,
          details: { ministry: cleanedForm.ministry || null }
        });
      } else {
        await supabaseUpdate('volunteers', editingVolunteer.id, cleanedForm);
        logActivity({
          action: 'volunteer_updated',
          entity_type: 'volunteer',
          entity_id: editingVolunteer.id,
          entity_name: cleanedForm.full_name || null,
          details: { ministry: cleanedForm.ministry || null }
        });
      }
      fetchData(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setVolunteers(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingVolunteer(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    await supabaseDelete('volunteers', target.id);
    logActivity({
      action: 'volunteer_deleted',
      entity_type: 'volunteer',
      entity_id: target.id,
      entity_name: target.full_name || null,
      details: { ministry: target.ministry || null }
    });
    setDeleteConfirm(null);
    fetchData();
  };

  const handleLinkMember = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setForm({
        ...form,
        member_id: memberId,
        full_name: `${member.first_name} ${member.last_name}`,
        email: member.email || form.email,
        phone: member.phone || form.phone
      });
    }
  };

  // Filter volunteers
  const filteredVolunteers = volunteers.filter(v => {
    if (filterMinistry !== 'all' && v.ministry !== filterMinistry) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterLocation !== 'all' && v.location_id !== filterLocation) return false;
    if (searchTerm && !v.full_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalActive = volunteers.filter(v => v.status === 'ACTIVE').length;
  const totalLeaders = volunteers.filter(v => v.is_team_leader).length;
  const ministryStats = ministries.map(m => ({
    ministry: m,
    count: volunteers.filter(v => v.ministry === m).length
  })).filter(m => m.count > 0).sort((a, b) => b.count - a.count);

  const statusColors = {
    'ACTIVE': { bg: '#dcfce7', color: '#166534' },
    'INACTIVE': { bg: '#fee2e2', color: '#991b1b' },
    'ON_LEAVE': { bg: '#fef3c7', color: '#92400e' }
  };

  const ministryColors = {
    'Worship': '#6366f1', 'Children': '#f59e0b', 'Youth': '#8b5cf6', 'Ushers': '#10b981',
    'Media': '#3b82f6', 'Security': '#ef4444', 'Hospitality': '#ec4899', 'Prayer': '#14b8a6',
    'Outreach': '#f97316', 'Discipleship': '#6366f1', 'Admin': '#6b7280', 'Other': '#9ca3af'
  };

  return (
    <div>
      <PageHeader
        title="🙋‍♂️ Volunteers"
        subtitle={`${volunteers.length} ${t('manageVolunteersSubtitle')} ${ministryStats.length} ${t('ministries')}`}
        actions={<Button onClick={() => openModal()}>➕ Add Volunteer</Button>}
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Volunteers" value={volunteers.length} icon="🙋‍♂️" color="#6366f1" />
        <StatCard label="Active" value={totalActive} icon="✅" color="#10b981" />
        <StatCard label="Team Leaders" value={totalLeaders} icon="⭐" color="#f59e0b" />
        <StatCard label="Ministries" value={ministryStats.length} icon="⛪" color="#8b5cf6" />
      </div>

      {/* Ministry Breakdown */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>📊 Volunteers by Ministry</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {ministryStats.map((m, i) => (
            <div key={i} style={{ padding: '12px 20px', backgroundColor: `${ministryColors[m.ministry] || '#6b7280'}15`, borderRadius: '10px', borderLeft: `4px solid ${ministryColors[m.ministry] || '#6b7280'}` }}>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: ministryColors[m.ministry] || '#6b7280' }}>{m.count}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>{m.ministry}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Search volunteers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            />
          </div>
          <select value={filterMinistry} onChange={(e) => setFilterMinistry(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Ministries</option>
            {ministries.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Locations</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>
      </div>

      {/* Volunteers Table */}
      {loading ? <LoadingSpinner /> : (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Volunteer</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Ministry</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Availability</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                  <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((volunteer, index) => (
                  <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: `${ministryColors[volunteer.ministry] || '#6b7280'}20`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ministryColors[volunteer.ministry] || '#6b7280', fontWeight: '600', fontSize: '14px' }}>
                          {volunteer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {volunteer.full_name}
                            {volunteer.is_team_leader && <span style={{ fontSize: '14px' }}>⭐</span>}
                          </p>
                          {volunteer.email && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{volunteer.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 12px', backgroundColor: `${ministryColors[volunteer.ministry] || '#6b7280'}20`, color: ministryColors[volunteer.ministry] || '#6b7280', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                        {volunteer.ministry}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: '#374151' }}>{volunteer.role || '—'}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 12px', backgroundColor: statusColors[volunteer.status]?.bg || '#f3f4f6', color: statusColors[volunteer.status]?.color || '#6b7280', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                        {volunteer.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: '#6b7280', fontSize: '14px' }}>{volunteer.availability || '—'}</td>
                    <td style={{ padding: '16px' }}><span style={{ padding: '2px 8px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '6px', fontSize: '12px' }}>📍 {getLocationName(volunteer.location_id)}</span></td>
                    <td style={{ padding: '16px' }}>
                      {volunteer.phone && <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>📱 {volunteer.phone}</p>}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => openModal(volunteer)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                        <button onClick={() => setDeleteConfirm(volunteer)} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVolunteers.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                      <span style={{ fontSize: '48px' }}>🙋‍♂️</span>
                      <p>No volunteers found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingVolunteer ? '✏️ Edit Volunteer' : '➕ Add Volunteer'} width="600px">
        {/* Link to Member */}
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <label style={{ fontSize: '13px', color: '#166534', display: 'block', marginBottom: '8px' }}>🔗 Link to existing member (optional)</label>
          <select
            value={form.member_id}
            onChange={(e) => handleLinkMember(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '14px' }}
          >
            <option value="">Select a member...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Full Name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required placeholder="Jean-Pierre Mbeki" />
          <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" />
        </div>

        <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Ministry *" type="select" value={form.ministry} onChange={(e) => setForm({ ...form, ministry: e.target.value })} options={ministries.map(m => ({ value: m, label: m }))} />
          <FormInput label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g., Lead Singer, Teacher" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statuses.map(s => ({ value: s, label: s }))} />
          <FormInput label="Availability" type="select" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} options={availabilities.map(a => ({ value: a, label: a }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
            <input type="checkbox" id="teamLeader" checked={form.is_team_leader} onChange={(e) => setForm({ ...form, is_team_leader: e.target.checked })} />
            <label htmlFor="teamLeader" style={{ fontSize: '14px', cursor: 'pointer' }}>⭐ Team Leader</label>
          </div>
        </div>

        <FormInput label="Skills" type="textarea" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="List any relevant skills..." />

        <FormInput label="📍 Location" type="select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />

        <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#92400e' }}>🚨 Emergency Contact</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input type="text" placeholder="Contact Name" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '14px' }} />
            <input type="text" placeholder="Phone Number" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '14px' }} />
          </div>
        </div>

        <FormInput label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete Volunteer" message={`Are you sure you want to remove "${deleteConfirm?.full_name}" from volunteers?`} />
    </div>
  );
}
// ==========================================
// MESSAGING PAGE
// ==========================================

export default VolunteersPage;
