"use client";
// MembersPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject, isValidEmail, uploadPhoto } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, MemberProfile, exportToCSV, SearchInput, PaginatedList, StatCard } from '../cs-ui';
import Papa from 'papaparse';
import UpgradePrompt from '../UpgradePrompt';

function MembersPage({ plan, onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [members, setMembers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [viewingMember, setViewingMember] = useState(null);
  const [memberPage, setMemberPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // upload | mapping | importing | done
  const [importData, setImportData] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importResult, setImportResult] = useState(null);

  const MEMBER_FIELDS = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'gender', label: 'Gender' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'city', label: 'City' },
    { key: 'address', label: 'Address' },
    { key: 'membership_status', label: 'Membership Status' },
    { key: 'membership_date', label: 'Membership Date' },
  ];

  const autoMapHeaders = (headers) => {
    const mapping = {};
    const aliases = {
      first_name: ['first_name', 'firstname', 'first name', 'prenom', 'prénom'],
      last_name: ['last_name', 'lastname', 'last name', 'nom', 'surname'],
      email: ['email', 'e-mail', 'mail', 'courriel'],
      phone: ['phone', 'telephone', 'tel', 'mobile', 'téléphone'],
      gender: ['gender', 'sex', 'sexe', 'genre'],
      date_of_birth: ['date_of_birth', 'dob', 'birthday', 'birth_date', 'date de naissance'],
      city: ['city', 'ville', 'town'],
      address: ['address', 'adresse'],
      membership_status: ['membership_status', 'status', 'statut'],
      membership_date: ['membership_date', 'join_date', 'joined', 'date adhésion'],
    };
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      for (const [field, names] of Object.entries(aliases)) {
        if (names.includes(lower) && !mapping[field]) { mapping[field] = h; break; }
      }
    });
    return mapping;
  };

  const handleFileUpload = (file) => {
    if (!file || !file.name.endsWith('.csv')) { toast.warning(t('pleaseUploadCsv')); return; }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data || result.data.length === 0) { toast.warning(t('csvEmpty')); return; }
        setImportHeaders(result.meta.fields || []);
        setImportData(result.data);
        setImportMapping(autoMapHeaders(result.meta.fields || []));
        setImportStep('mapping');
      },
      error: (err) => toast.error('Failed to parse CSV: ' + err.message)
    });
  };

  const runImport = async () => {
    setImportStep('importing');
    let imported = 0, skipped = 0, errors = 0;
    const existingEmails = new Set(members.filter(m => m.email).map(m => m.email.toLowerCase()));

    for (const row of importData) {
      const mapped = {};
      for (const [field, csvCol] of Object.entries(importMapping)) {
        if (csvCol) mapped[field] = (row[csvCol] || '').trim();
      }
      if (!mapped.first_name && !mapped.last_name) { skipped++; continue; }
      if (mapped.email && existingEmails.has(mapped.email.toLowerCase())) { skipped++; continue; }
      try {
        const insertRow = {
          church_id: CHURCH_ID,
          first_name: mapped.first_name || '',
          last_name: mapped.last_name || '',
          email: mapped.email || null,
          phone: mapped.phone || null,
          gender: (mapped.gender || '').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
          date_of_birth: mapped.date_of_birth || null,
          city: mapped.city || null,
          address: mapped.address || null,
          membership_status: ['ACTIVE','INACTIVE','DECEASED','TRANSFERRED'].includes((mapped.membership_status || '').toUpperCase()) ? mapped.membership_status.toUpperCase() : 'ACTIVE',
          membership_date: mapped.membership_date || new Date().toISOString().split('T')[0],
        };
        await supabase.from('members').insert(insertRow);
        if (mapped.email) existingEmails.add(mapped.email.toLowerCase());
        imported++;
      } catch { errors++; }
    }
    setImportResult({ imported, skipped, errors });
    setImportStep('done');
    fetchData();
  };

  const downloadTemplate = () => {
    const csv = '\uFEFF' + 'first_name,last_name,email,phone,gender,date_of_birth,city,address,membership_status,membership_date\nJohn,Doe,john@example.com,+237600000000,MALE,1990-05-15,Douala,123 Main St,ACTIVE,2024-01-01\nJane,Smith,jane@example.com,+237611111111,FEMALE,1985-08-20,Yaoundé,,ACTIVE,2024-03-15\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'churchsmart-member-import-template.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
    gender: 'MALE', address: '', city: '', membership_status: 'ACTIVE', membership_date: '',
    location_id: '', notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [membersData, locationsData] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc' }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      setMembers(membersData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Members fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const resetForm = () => {
    const mainCampus = locations.find(l => l.is_main_campus);
    setForm({
      first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
      gender: 'MALE', address: '', city: '', membership_status: 'ACTIVE', membership_date: new Date().toISOString().split('T')[0],
      location_id: mainCampus?.id || '', notes: '', photo_url: ''
    });
    setEditingMember(null);
  };

  const exportMembersCSV = () => {
    const data = (members || []).filter(m => {
      const matchesLocation = filterLocation === 'all' || m.location_id === filterLocation;
      const matchesStatus = filterStatus === 'all' || m.membership_status === filterStatus;
      const matchesSearch = !searchTerm || (m.first_name + ' ' + m.last_name).toLowerCase().includes(searchTerm.toLowerCase()) || (m.phone || '').includes(searchTerm) || (m.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLocation && matchesStatus && matchesSearch;
    });
    const ok = exportToCSV(data, [
      { label: 'First Name', key: 'first_name' },
      { label: 'Last Name', key: 'last_name' },
      { label: 'Phone', key: 'phone' },
      { label: 'Email', key: 'email' },
      { label: 'Gender', key: 'gender' },
      { label: 'Status', key: 'membership_status' },
      { label: 'Membership Date', key: 'membership_date' },
      { label: 'Date of Birth', key: 'date_of_birth' },
      { label: 'Address', key: 'address' },
      { label: 'City', key: 'city' },
    ], 'members');
    if (ok) toast.success(t('csvExportedSuccess')); else toast.warning(t('noRecordsToExport'));
  };

  const openModal = (member = null) => {
    if (member) {
      setEditingMember(member);
      setForm({
        first_name: member.first_name || '', last_name: member.last_name || '',
        email: member.email || '', phone: member.phone || '', date_of_birth: member.date_of_birth || '',
        gender: member.gender || 'MALE', address: member.address || '', city: member.city || '',
        membership_status: member.membership_status || 'ACTIVE', membership_date: member.membership_date || '',
        location_id: member.location_id || '', notes: member.notes || '', photo_url: member.photo_url || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      toast.warning(t('firstLastRequired'));
      return;
    }
    // Duplicate detection
    if (!editingMember) {
      const possibleDupe = members.find(m => 
        (m.phone && form.phone && m.phone === form.phone) ||
        (m.email && form.email && m.email.toLowerCase() === form.email.toLowerCase()) ||
        (m.first_name.toLowerCase() === form.first_name.toLowerCase() && m.last_name.toLowerCase() === form.last_name.toLowerCase())
      );
      if (possibleDupe && !confirm(`⚠️ Possible duplicate: ${possibleDupe.first_name} ${possibleDupe.last_name} (${possibleDupe.phone || possibleDupe.email || 'no contact'}). Add anyway?`)) return;
    }

    const isInsert = !editingMember;
    const formSnapshot = form;
    const editingSnapshot = editingMember;
    const listSnapshot = members;
    const data = { ...form, location_id: form.location_id || null, date_of_birth: form.date_of_birth || null, membership_date: form.membership_date || null, baptism_date: form.baptism_date || null };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setMembers([{ id: tempId, ...data }, ...members]);
    } else {
      setMembers(members.map(m => m.id === editingMember.id ? { ...m, ...data } : m));
    }
    setShowModal(false);
    resetForm();
    toast.success(isInsert ? `🎉 ${t('memberAdded')}` : t('savedSuccessfully'));

    try {
      if (isInsert) {
        const result = await supabaseInsert('members', data);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setMembers(prev => prev.map(m => m.id === tempId ? realRow : m));
        }
        logActivity({
          action: 'member_created',
          entity_type: 'member',
          entity_id: realRow?.id || null,
          entity_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || null,
          details: null
        });
      } else {
        await supabaseUpdate('members', editingMember.id, data);
        logActivity({
          action: 'member_updated',
          entity_type: 'member',
          entity_id: editingMember.id,
          entity_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || null,
          details: null
        });
      }
      fetchData(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setMembers(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingMember(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const deletedId = deleteConfirm.id;
    const deletedName = `${deleteConfirm.first_name || ''} ${deleteConfirm.last_name || ''}`.trim() || null;
    await supabaseDelete('members', deletedId);
    logActivity({
      action: 'member_deleted',
      entity_type: 'member',
      entity_id: deletedId,
      entity_name: deletedName,
      details: null
    });
    setDeleteConfirm(null);
    fetchData();
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location ? location.name : '—';
  };

  const getLocationColor = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return '#6b7280';
    if (location.is_main_campus) return '#6366f1';
    const colors = ['#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#3b82f6'];
    const index = locations.filter(l => !l.is_main_campus).findIndex(l => l.id === locationId);
    return colors[index % colors.length];
  };

  // Filter members
  const filteredMembers = members.filter(m => {
    if (filterStatus !== 'all' && m.membership_status !== filterStatus) return false;
    if (filterLocation !== 'all' && m.location_id !== filterLocation) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      if (!fullName.includes(search) && !m.email?.toLowerCase().includes(search) && !m.phone?.includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Stats
  const totalActive = members.filter(m => m.membership_status === 'ACTIVE').length;
  const locationStats = locations.map(loc => ({
    ...loc,
    count: members.filter(m => m.location_id === loc.id).length
  }));

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  // ── Invite Link ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [churchSlug, setChurchSlug] = useState('');

  // Fetch church slug for clean invite URL
  useEffect(() => {
    const fetchSlug = async () => {
      if (!CHURCH_ID) return;
      const ch = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true });
      if (ch?.slug) setChurchSlug(ch.slug);
    };
    fetchSlug();
  }, [CHURCH_ID]);

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const inviteLink = churchSlug ? `${baseUrl}?connect=${churchSlug}` : `${baseUrl}?join=${CHURCH_ID}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    });
  };

  return (
    <div>
      <PageHeader
        title={`👥 ${t('members')}`}
        subtitle={`${members.length} ${t('manageMembersSubtitle')} ${locations.length} ${t('locations')}`}
        actions={
          <div className="cs-btn-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {canAccessFeature(plan, 'data_import_export') ? <Button variant="secondary" onClick={exportMembersCSV}>📥 {t('exportCSV')}</Button> : <Button variant="secondary" onClick={() => toast.info(t('exportCsvUpgradeRequired'))} style={{ opacity: 0.6 }}>🔒 {t('exportCSV')}</Button>}
            {canAccessFeature(plan, 'data_import_export') ? <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportStep('upload'); setImportData([]); setImportResult(null); }}>📤 {t('importCSV')}</Button> : <Button variant="secondary" onClick={() => toast.info(t('importCsvUpgradeRequired'))} style={{ opacity: 0.6 }}>🔒 {t('importCSV')}</Button>}
            <Button variant="secondary" onClick={() => setShowInviteModal(true)}>🔗 Invite Link</Button>
            <Button onClick={() => openModal()}>➕ {t('addMember')}</Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Members" value={members.length} icon="👥" color="#6366f1" />
        <StatCard label="Active" value={totalActive} icon="✅" color="#10b981" />
        <StatCard label="Inactive" value={members.filter(m => m.membership_status === 'INACTIVE').length} icon="⏸️" color="#f59e0b" />
        <StatCard label="Locations" value={locations.length} icon="📍" color="#8b5cf6" />
      </div>

      {/* Members by Location */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>📍 Members by Location</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {locationStats.map((loc, i) => (
            <div key={i} onClick={() => setFilterLocation(filterLocation === loc.id ? 'all' : loc.id)} style={{ padding: '16px 24px', backgroundColor: filterLocation === loc.id ? `${getLocationColor(loc.id)}20` : '#f9fafb', borderRadius: '12px', cursor: 'pointer', borderLeft: `4px solid ${getLocationColor(loc.id)}`, transition: 'all 0.2s', border: filterLocation === loc.id ? `2px solid ${getLocationColor(loc.id)}` : '2px solid transparent' }}>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: getLocationColor(loc.id) }}>{loc.count}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>{loc.name}</p>
              {loc.is_main_campus && <span style={{ fontSize: '10px', color: '#6366f1' }}>Main Campus</span>}
            </div>
          ))}
          {members.filter(m => !m.location_id).length > 0 && (
            <div style={{ padding: '16px 24px', backgroundColor: '#f9fafb', borderRadius: '12px', borderLeft: '4px solid #9ca3af' }}>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#9ca3af' }}>{members.filter(m => !m.location_id).length}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Unassigned</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#111827', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            />
          </div>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Locations</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {(filterLocation !== 'all' || filterStatus !== 'all' || searchTerm) && (
            <button onClick={() => { setFilterLocation('all'); setFilterStatus('all'); setSearchTerm(''); }} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}>
              🔄 Reset
            </button>
          )}
        </div>
      </div>

      {/* Members Table */}
      {loading ? <LoadingSpinner /> : (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{t('showing')} {Math.min(memberPage*50, filteredMembers.length)} {t('of')} {filteredMembers.length} {t('members').toLowerCase()}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Member</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Joined</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.slice((memberPage-1)*50, memberPage*50).map((member, index) => (
                  <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600', overflow: 'hidden', flexShrink: 0 }}>
                          {member.photo_url ? (
                            <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <>{member.first_name?.[0]}{member.last_name?.[0]}</>
                          )}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: '500', cursor: 'pointer', color: '#4338ca' }} onClick={() => setViewingMember(member)}>{member.first_name} {member.last_name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{member.gender === 'MALE' ? '👨' : '👩'} {member.gender}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ margin: 0, fontSize: '14px' }}>{member.email || '—'}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{member.phone || '—'}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {member.location_id ? (
                        <span style={{ padding: '4px 12px', backgroundColor: `${getLocationColor(member.location_id)}15`, color: getLocationColor(member.location_id), borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                          📍 {getLocationName(member.location_id)}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '13px' }}>Not assigned</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={member.membership_status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>
                      {formatDate(member.membership_date || member.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => openModal(member)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', marginRight: '8px', fontSize: '12px' }}>✏️ Edit</button>
                      <button onClick={() => setDeleteConfirm(member)} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                      <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>👥</span>
                      <p style={{ fontSize: '16px', fontWeight: '500', color: '#374151', margin: '0 0 8px' }}>{members.length === 0 ? t('emptyMembers') : t('noResults')}</p>
                      {members.length === 0 && <button onClick={() => openModal()} style={{ marginTop: '12px', padding: '10px 24px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>➕ {t('addMember')}</button>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredMembers.length > 50 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px' }}>
              <button onClick={() => setMemberPage(p => Math.max(1, p-1))} disabled={memberPage===1} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: memberPage===1 ? '#f9fafb' : 'white', color: memberPage===1 ? '#d1d5db' : '#4b5563', cursor: memberPage===1 ? 'default' : 'pointer', fontSize: '14px' }}>{'← '+t('previous')}</button>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>{t('page')} {memberPage} {t('of')} {Math.ceil(filteredMembers.length/50)}</span>
              <button onClick={() => setMemberPage(p => Math.min(Math.ceil(filteredMembers.length/50), p+1))} disabled={memberPage>=Math.ceil(filteredMembers.length/50)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: memberPage>=Math.ceil(filteredMembers.length/50) ? '#f9fafb' : 'white', color: memberPage>=Math.ceil(filteredMembers.length/50) ? '#d1d5db' : '#4b5563', cursor: memberPage>=Math.ceil(filteredMembers.length/50) ? 'default' : 'pointer', fontSize: '14px' }}>{t('next')+' →'}</button>
            </div>
          )}
        </div>
      )}

      {/* Member Profile Modal */}
      <Modal isOpen={!!viewingMember} onClose={() => setViewingMember(null)} title={'👤 '+t('memberProfile')} width="700px">
        {viewingMember && <MemberProfile member={viewingMember} onClose={() => setViewingMember(null)} churchId={CHURCH_ID} onNavigate={onNavigate} onAfterUndo={() => { setViewingMember(null); fetchData(); }} />}
      </Modal>

      {/* Invite Link Modal */}
      <Modal isOpen={showInviteModal} onClose={() => { setShowInviteModal(false); setLinkCopied(false); }} title="🔗 Member Self-Registration Link" width="560px">
        <div style={{ padding: '8px 0' }}>
          {/* Explanation */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#eef2ff', borderRadius: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '24px' }}>💡</span>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#4338ca' }}>How it works</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#6366f1', lineHeight: '1.5' }}>
                Share this link with your congregation. They fill in their own details on a simple form — no login needed. 
                New entries appear in your Members list with status <strong style={{ backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px', color: '#92400e' }}>NEW</strong> for your review.
              </p>
            </div>
          </div>

          {/* Link Display + Copy */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration URL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" readOnly value={inviteLink} style={{ flex: 1, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', backgroundColor: '#f9fafb', color: '#374151', outline: 'none', fontFamily: 'monospace' }} onClick={(e) => e.target.select()} />
              <button onClick={copyInviteLink} style={{
                padding: '12px 20px', border: 'none', borderRadius: '10px',
                backgroundColor: linkCopied ? '#dcfce7' : '#6366f1',
                color: linkCopied ? '#166534' : 'white',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                minWidth: '100px'
              }}>
                {linkCopied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          <div style={{ textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#374151' }}>📱 QR Code — Display on screen during service</p>
            <div style={{ display: 'inline-block', padding: '12px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}&color=4338ca`} 
                alt="QR Code" 
                style={{ width: '180px', height: '180px', display: 'block' }} 
              />
            </div>
            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Members can scan this with their phone camera</p>
          </div>

          {/* Share Options */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Share via</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`Join our church community! Register your details here: ${inviteLink}`)}`, '_blank'); }} style={{ padding: '12px', border: '1px solid #25d366', borderRadius: '10px', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                💬 WhatsApp
              </button>
              <button onClick={() => { window.open(`sms:?body=${encodeURIComponent(`Join our church! Register here: ${inviteLink}`)}`, '_blank'); }} style={{ padding: '12px', border: '1px solid #6366f1', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                📱 SMS
              </button>
              <button onClick={() => { window.open(`mailto:?subject=${encodeURIComponent('Join Our Church')}&body=${encodeURIComponent(`We'd love to have you! Register your details here: ${inviteLink}`)}`, '_blank'); }} style={{ padding: '12px', border: '1px solid #f59e0b', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                📧 Email
              </button>
            </div>
          </div>

          {/* Pro Tips */}
          <div style={{ padding: '14px 16px', backgroundColor: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#0369a1' }}>💡 Pro Tips</p>
            <div style={{ fontSize: '12px', color: '#0369a1', lineHeight: '1.7' }}>
              <p style={{ margin: 0 }}>• Display the QR code on projector during announcements</p>
              <p style={{ margin: 0 }}>• Send the link in your church WhatsApp group</p>
              <p style={{ margin: 0 }}>• Print it on your Sunday bulletin or connection card</p>
              <p style={{ margin: 0 }}>• New members appear with status "NEW" for follow-up</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Member Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingMember ? '✏️ Edit Member' : '➕ Add Member'} width="600px">
        {/* Photo Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e0e7ff', flexShrink: 0 }}>
            {form.photo_url ? (
              <img src={form.photo_url} alt="Member" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: '600', color: '#6366f1' }}>
                {form.first_name?.[0] || '?'}{form.last_name?.[0] || ''}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500', color: '#374151' }}>📷 Member Photo</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', backgroundColor: '#6366f1', color: 'white',
                borderRadius: '8px', fontSize: '13px', fontWeight: '500',
                cursor: 'pointer'
              }}>
                📤 Upload
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { toast.info('Max file size is 2MB'); return; }
                    setSaving(true);
                    try {
                      const url = await uploadPhoto(file, 'member-photos');
                      if (url) {
                        setForm({ ...form, photo_url: url });
                      } else {
                        const fallback = await uploadPhoto(file, 'avatars');
                        if (fallback) setForm({ ...form, photo_url: fallback });
                        else toast.error('Upload failed. Create a "member-photos" bucket in Supabase Storage (public).');
                      }
                    } catch (err) { toast.info('Upload error: ' + err.message); }
                    setSaving(false);
                    e.target.value = '';
                  }}
                />
              </label>
              {form.photo_url && (
                <button onClick={() => setForm({ ...form, photo_url: '' })} style={{ padding: '7px 14px', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '13px', cursor: 'pointer' }}>
                  ✕ Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="First Name *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <FormInput label="Last Name *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          <FormInput label="Gender" type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'MALE', label: '👨 Male' }, { value: 'FEMALE', label: '👩 Female' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="📍 Location *" type="select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
          <FormInput label="Status" type="select" value={form.membership_status} onChange={(e) => setForm({ ...form, membership_status: e.target.value })} options={[{ value: 'ACTIVE', label: '✅ Active' }, { value: 'INACTIVE', label: '⏸️ Inactive' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <FormInput label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <FormInput label="Membership Date" type="date" value={form.membership_date} onChange={(e) => setForm({ ...form, membership_date: e.target.value })} />
        <FormInput label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Import CSV Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title={`📤 ${t('importCSV')}`}>
        {importStep === 'upload' && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#4f46e5'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#d1d5db'; handleFileUpload(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('csv-file-input').click()}
              style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '40px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f9fafb', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '32px' }}>📁</p>
              <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#374151' }}>{t('dragDropCSV')}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{t('orClickBrowse')}</p>
              <input id="csv-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e.target.files[0])} />
            </div>
            <button onClick={downloadTemplate} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', color: '#4f46e5', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>📋 {t('downloadTemplate')}</button>
          </div>
        )}
        {importStep === 'mapping' && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7280' }}>{t('foundRows')} {importData.length} {t('rows')}. {t('columnMapping')}:</p>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {MEMBER_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '140px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>{f.label}{f.required ? ' *' : ''}</span>
                  <select value={importMapping[f.key] || ''} onChange={(e) => setImportMapping({ ...importMapping, [f.key]: e.target.value })} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}>
                    <option value="">{t('skipColumn')}</option>
                    {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>{t('previewRows')}:</p>
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr style={{ backgroundColor: '#f9fafb' }}>{MEMBER_FIELDS.filter(f => importMapping[f.key]).map(f => <th key={f.key} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#6b7280' }}>{f.label}</th>)}</tr></thead>
                <tbody>{importData.slice(0, 5).map((row, i) => <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>{MEMBER_FIELDS.filter(f => importMapping[f.key]).map(f => <td key={f.key} style={{ padding: '6px 8px', color: '#374151' }}>{row[importMapping[f.key]] || '—'}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setImportStep('upload')}>Back</Button>
              <Button onClick={runImport} disabled={!importMapping.first_name && !importMapping.last_name}>{t('importMembers')} {importData.length} {t('members')}</Button>
            </div>
          </div>
        )}
        {importStep === 'importing' && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #4f46e5', borderRadius: '50%', animation: 'cs-spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontWeight: '500', color: '#374151' }}>{t('importing')}</p>
          </div>
        )}
        {importStep === 'done' && importResult && (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ fontSize: '48px', margin: '0 0 12px' }}>✅</p>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>{t('importComplete')}</h3>
            <p style={{ margin: '0 0 4px', fontSize: '15px', color: '#10b981', fontWeight: '600' }}>{importResult.imported} {t('membersImported')}</p>
            {importResult.skipped > 0 && <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#f59e0b' }}>{importResult.skipped} {t('rowsSkipped')}</p>}
            {importResult.errors > 0 && <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#ef4444' }}>{importResult.errors} {t('rowsFailed')}</p>}
            <Button onClick={() => setShowImportModal(false)} style={{ marginTop: '16px' }}>Close</Button>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete Member" message={`Are you sure you want to delete "${deleteConfirm?.first_name} ${deleteConfirm?.last_name}"?`} />
    </div>
  );
}

// ==========================================
// VISITORS PAGE - With SMS Integration (Continued)
// ==========================================

export default MembersPage;
