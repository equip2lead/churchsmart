"use client";
// ChurchSmart shared UI components — extracted from app/page.js
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject, isValidEmail, uploadPhoto, SUPABASE_URL, SUPABASE_KEY, WHATSAPP_MAX_CHARS } from '../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions, ROLE_ACCESS } from '../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../lib/featureGating';
import Papa from 'papaparse';

function MemberProfile({ member, onClose, churchId, onNavigate, onAfterUndo }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceVisitor, setSourceVisitor] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  useEffect(() => { (async () => { setLoading(true); try { const d = await supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: churchId }, { column: 'member_id', operator: 'eq', value: member.id }], order: 'donation_date.desc', limit: 20 }); setDonations(d || []); } catch (error) { console.error('MemberProfile donations fetch error:', error); } finally { setLoading(false); } })(); }, [member.id]);
  // Detect whether this member came from a visitor conversion. Used to render
  // the "Converted from visitor" banner and enable the undo flow.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('visitors')
          .select('id, converted_at, full_name')
          .eq('converted_to_member_id', member.id)
          .maybeSingle();
        setSourceVisitor(data || null);
      } catch (error) {
        console.error('MemberProfile source-visitor fetch error:', error);
      }
    })();
  }, [member.id]);
  // Performs the undo. Triggered by the ConfirmDialog's confirm button — the
  // dialog itself handles the safety prompt so we can't be silenced by browser
  // dialog suppression (the window.confirm version was per-tab-killed once any
  // prior confirm in the session had been dismissed with "block more dialogs").
  const performUndoConversion = async () => {
    if (!sourceVisitor) return;
    setUndoing(true);
    try {
      // Strict safety gate — any donation attributed to this member blocks the
      // undo. Counts via HEAD-only request, no row data shipped.
      const { count, error: countError } = await supabase
        .from('donations')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id);
      if (countError) {
        console.error('Undo donation-count check failed:', countError.message);
        toast.error(t('saveFailed'));
        setUndoing(false);
        return;
      }
      if ((count || 0) > 0) {
        toast.warning(t('undoBlockedDonations').replace('{count}', String(count)));
        setUndoing(false);
        return;
      }
      // Capture the member's display name BEFORE the delete for the audit log.
      const capturedName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || null;
      // Restore the visitor row first: clear conversion fields and re-activate
      // follow-up. Doing this before the member delete means a mid-flow failure
      // leaves "visitor exists, member also exists" (recoverable) rather than
      // an orphaned visitor pointing at a deleted member.
      await supabase.from('visitors').update({
        converted_to_member_id: null,
        converted_at: null,
        followup_status: 'IN_PROGRESS'
      }).eq('id', sourceVisitor.id);
      await supabase.from('members').delete().eq('id', member.id);
      logActivity({
        action: 'member_unconverted',
        entity_type: 'member',
        entity_id: member.id,
        entity_name: capturedName,
        details: { reverted_member_id: member.id, visitor_id: sourceVisitor.id }
      });
      toast.success(t('unconvertedSuccess'));
      if (onAfterUndo) onAfterUndo();
      else onClose();
    } catch (err) {
      console.error('Undo conversion failed:', err);
      toast.error(t('saveFailed'));
    } finally {
      setUndoing(false);
    }
  };
  const totalGiving = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`;
  const genStatement = () => { if (!donations.length) { toast.warning(t('noRecords')); return; } exportToCSV(donations, [{ label: 'Date', key: 'donation_date' },{ label: 'Amount', key: 'amount' },{ label: 'Category', key: 'category' },{ label: 'Method', key: 'payment_method' }], `giving-${member.first_name}-${member.last_name}`); toast.success(t('givingStatement') + ' exported!'); };
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ width: '80px', height: '80px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '700', fontSize: '24px', overflow: 'hidden', flexShrink: 0 }}>{member.photo_url ? <img src={member.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>{member.first_name} {member.last_name}</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{member.email || ''}{member.email && member.phone ? ' • ' : ''}{member.phone || ''}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', backgroundColor: member.membership_status === 'ACTIVE' ? '#dcfce7' : '#fef3c7', color: member.membership_status === 'ACTIVE' ? '#166534' : '#92400e', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>{member.membership_status}</span>
            <span style={{ padding: '4px 12px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '9999px', fontSize: '12px' }}>{member.gender}</span>
            {member.date_of_birth && <span style={{ padding: '4px 12px', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '9999px', fontSize: '12px' }}>🎂 {member.date_of_birth}</span>}
          </div>
        </div>
      </div>
      {sourceVisitor && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#166534', fontWeight: '500' }}>
            ✓ {t('convertedFromVisitorOn').replace('{date}', sourceVisitor.converted_at ? new Date(sourceVisitor.converted_at).toLocaleDateString() : '—')}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => { if (onNavigate) { onClose(); onNavigate('visitors'); } }} style={{ padding: '6px 14px', border: '1px solid #6366f1', borderRadius: '8px', backgroundColor: 'white', color: '#4f46e5', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
              ✏️ {t('editVisitorInfo')}
            </button>
            <button onClick={() => setShowUndoConfirm(true)} disabled={undoing} style={{ padding: '6px 14px', border: '1px solid #dc2626', borderRadius: '8px', backgroundColor: 'white', color: '#dc2626', fontSize: '13px', fontWeight: '500', cursor: undoing ? 'not-allowed' : 'pointer', opacity: undoing ? 0.6 : 1 }}>
              ↩️ {t('undoConversion')}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#166534' }}>{donations.length}</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Donations</p></div>
        <div style={{ backgroundColor: '#eef2ff', borderRadius: '12px', padding: '16px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#4338ca' }}>{totalGiving.toLocaleString()}</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{t('totalGiving')}</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px', backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px' }}>
        <div><span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t('address')}</span><p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '500' }}>{member.address || '—'}{member.city ? `, ${member.city}` : ''}</p></div>
        <div><span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t('membershipDate')}</span><p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '500' }}>{member.membership_date || '—'}</p></div>
        <div><span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Emergency</span><p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '500' }}>{member.emergency_contact_name || '—'}</p></div>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>💰 {t('givingHistory')}</h3>
          <button onClick={genStatement} style={{ padding: '6px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', color: '#4b5563' }}>📥 {t('givingStatement')}</button>
        </div>
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Loading...</p> : donations.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px' }}>{t('noData')}</p> : (
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>{donations.slice(0, 10).map((d, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}><div><span style={{ fontSize: '14px', fontWeight: '500' }}>{d.category || 'Donation'}</span><span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>{d.donation_date}</span></div><span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>{(parseFloat(d.amount) || 0).toLocaleString()}</span></div>))}</div>
        )}
      </div>
      {member.notes && <div style={{ backgroundColor: '#fffbeb', borderRadius: '12px', padding: '16px', border: '1px solid #fde68a' }}><h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: '#92400e' }}>📝 Notes</h4><p style={{ margin: 0, fontSize: '14px', color: '#78716c', lineHeight: '1.6' }}>{member.notes}</p></div>}
      <ConfirmDialog
        isOpen={showUndoConfirm}
        onClose={() => setShowUndoConfirm(false)}
        onConfirm={() => { setShowUndoConfirm(false); performUndoConversion(); }}
        title={`↩️ ${t('undoConversion')}`}
        message={t('undoConversionConfirm')}
      />
    </div>
  );
}

// ==========================================
// CSV EXPORT UTILITY
// ==========================================
// Returns true on successful download, false on empty data or unexpected error.
// Callers gate their success toast on the return so users only see "Exported!"
// when a file actually landed in Downloads.

function exportToCSV(data, columns, filename) {
  if (!data || data.length === 0) {
    console.warn('exportToCSV: No data to export');
    return false;
  }
  try {
    const BOM = '\uFEFF';
    const header = columns.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row => columns.map(c => {
      let val = c.accessor ? c.accessor(row) : (row[c.key] ?? '');
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','));
    const csv = BOM + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (err) {
    console.error('exportToCSV failed:', err);
    return false;
  }
}

// ==========================================
// SEARCH INPUT COMPONENT
// ==========================================

function SearchInput({ value, onChange, placeholder }) {
  return React.createElement('input', {
    type: 'text',
    value: value,
    onChange: (e) => onChange(e.target.value),
    placeholder: placeholder || 'Search...',
    style: {
      padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px',
      fontSize: '14px', width: '100%', maxWidth: '320px', outline: 'none',
      backgroundColor: '#f9fafb'
    }
  });
}

// ==========================================
// PAGINATION COMPONENT
// ==========================================
function PaginatedList({ items, pageSize = 50, renderItem, emptyMessage }) {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(startIdx, startIdx + pageSize);
  
  useEffect(() => { setCurrentPage(1); }, [items.length]);
  
  if (items.length === 0) return React.createElement('div', { style: { textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '15px' } }, emptyMessage || t('noResults'));
  
  return React.createElement('div', null,
    renderItem(paginatedItems),
    items.length > pageSize && React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', marginTop: '16px' }
    },
      React.createElement('button', {
        onClick: () => setCurrentPage(p => Math.max(1, p - 1)),
        disabled: currentPage === 1,
        style: { padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: currentPage === 1 ? '#f9fafb' : 'white', color: currentPage === 1 ? '#d1d5db' : '#4b5563', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '14px' }
      }, '← ' + t('previous')),
      React.createElement('span', { style: { fontSize: '14px', color: '#6b7280' } },
        `${t('showing')} ${startIdx + 1}-${Math.min(startIdx + pageSize, items.length)} ${t('of')} ${items.length}`
      ),
      React.createElement('button', {
        onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)),
        disabled: currentPage === totalPages,
        style: { padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white', color: currentPage === totalPages ? '#d1d5db' : '#4b5563', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: '14px' }
      }, t('next') + ' →')
    )
  );
}

// ==========================================
// PUBLIC JOIN PAGE - Self-Service Member Registration
// ==========================================

function StatCard({ label, value, icon, color = '#6366f1', trend }) {
  const [display, setDisplay] = useState(0);
  const isNumber = typeof value === 'number';
  useEffect(() => {
    if (!isNumber) { setDisplay(value); return; }
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.floor(value / 20));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value, isNumber]);
  return (
    <div
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
      style={{ backgroundColor: 'white', borderRadius: '16px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f5', color: '#111827', transition: 'all 0.2s ease', cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>{label}</p>
          <p style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#111827', letterSpacing: '-0.02em' }}>{isNumber ? display : value}</p>
          {trend && <p style={{ fontSize: '12px', color: typeof trend === 'string' && trend.startsWith('+') ? '#10b981' : '#ef4444', margin: '8px 0 0 0', fontWeight: '600' }}>{trend}</p>}
        </div>
        <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${color}12, ${color}20)`, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    'ACTIVE': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    'INACTIVE': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    'NOT_STARTED': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
    'IN_PROGRESS': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'COMPLETED': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    'BECAME_MEMBER': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    'PENDING': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
    'NEW': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'TITHE': { bg: '#e0e7ff', text: '#4338ca', dot: '#6366f1' },
    'OFFERING': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'MISSIONS': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    'CELL': { bg: '#e0e7ff', text: '#4338ca', dot: '#6366f1' },
    'DEPARTMENT': { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
  };
  const color = colors[status] || { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' };

  return (
    <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: color.bg, color: color.text, display: 'inline-flex', alignItems: 'center', gap: '6px', letterSpacing: '0.02em' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color.dot, flexShrink: 0 }} />
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', animation: 'cs-fade-in 0.15s ease' }}>
      <div className="cs-modal-body" style={{ backgroundColor: 'white', borderRadius: '20px', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)', animation: 'cs-modal-enter 0.2s ease' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fafbff 0%, #f8f9fc 100%)' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', letterSpacing: '-0.01em' }}>{title}</h3>
          <button
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', borderRadius: '8px', transition: 'all 0.15s ease', lineHeight: 1 }}
          >✕</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes cs-modal-enter{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}' }} />
    </div>
  );
}

function FormInput({ label, type = 'text', value, onChange, placeholder, required, options }) {
  const [focused, setFocused] = useState(false);
  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: focused ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
    borderRadius: '12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', minHeight: '44px',
    backgroundColor: focused ? '#fafbff' : 'white',
    boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
    transition: 'all 0.2s ease', color: '#111827'
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', letterSpacing: '0.01em' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {type === 'select' ? (
        <select value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputStyle}>
          <option value="">Select...</option>
          {options?.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} rows={4} style={inputStyle} />
      ) : type === 'file' ? (
        <input type="file" onChange={onChange} accept="image/*" style={inputStyle} />
      ) : (
        <input type={type} value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

// ==========================================
// PERMISSION GATE COMPONENT
// ==========================================
function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = usePermissions();
  if (!permission || hasPermission(permission)) return children;
  return fallback;
}

function AccessDenied({ onNavigate }) {
  const { t } = useLanguage();
  const goDashboard = () => {
    if (onNavigate) { onNavigate('dashboard'); return; }
    const el = typeof document !== 'undefined' ? document.querySelector('[data-tab="dashboard"]') : null;
    if (el) el.click();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '36px' }}>🔒</span>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '800', color: '#1f2937', letterSpacing: '-0.02em' }}>{t('accessDenied')}</h2>
      <p style={{ margin: 0, fontSize: '15px', color: '#6b7280', maxWidth: '440px', lineHeight: '1.5' }}>{t('noPermission')}</p>
      <p style={{ margin: '8px 0 24px', fontSize: '13px', color: '#9ca3af', maxWidth: '440px' }}>{t('contactAdmin')}</p>
      <button
        onClick={goDashboard}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.25)'; }}
        style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.25)', transition: 'all 0.15s ease' }}
      >
        {t('goToDashboard')}
      </button>
    </div>
  );
}

// Legacy alias — kept so existing PermissionGate call sites continue to work.
const NoAccessPage = AccessDenied;

// ==========================================
// UI COMPONENTS
// ==========================================
function Button({ children, onClick, variant = 'primary', disabled, type = 'button', fullWidth }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
    secondary: { background: 'white', color: '#374151', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    danger: { background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', color: '#dc2626', border: '1px solid #fecaca', boxShadow: 'none' },
    success: { background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', color: '#166534', border: '1px solid #bbf7d0', boxShadow: 'none' },
    sms: { background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', color: '#166534', border: '1px solid #bbf7d0', boxShadow: 'none' },
    whatsapp: { background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', color: '#166534', border: '1px solid #22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.2)' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.05)'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'brightness(1)'; }}
      style={{
        ...styles[variant],
        padding: '11px 22px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.15s ease',
        letterSpacing: '0.01em'
      }}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  const { t } = useLanguage();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="420px">
      <div style={{ padding: '4px 0 20px' }}>
        <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #f0f0f5' }}>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="danger" onClick={onConfirm}>{t('delete')}</Button>
      </div>
    </Modal>
  );
}

function DataTable({ columns, data, onEdit, onDelete, onSMS, emptyMessage = 'No data found', pageSize = 50 }) {
  const [dtPage, setDtPage] = useState(1);
  const [hoveredRow, setHoveredRow] = useState(null);
  const dtTotal = Math.ceil((data || []).length / pageSize);
  const dtPaged = (data || []).slice((dtPage - 1) * pageSize, dtPage * pageSize);
  useEffect(function() { setDtPage(1); }, [data]);
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📭</div>
        <p style={{ fontSize: '15px', fontWeight: '500', color: '#374151', margin: '0 0 4px' }}>{emptyMessage}</p>
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Records will appear here once added</p>
      </div>
    );
  }

  return (
    <>
    <div className="cs-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '12px', border: '1px solid #f0f0f5' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead>
          <tr style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f0f8 100%)' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '14px 16px', fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', borderBottom: '2px solid #e0e7ff' }}>
                {col.header}
              </th>
            ))}
            {(onEdit || onDelete || onSMS) && (
              <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid #e0e7ff' }}>
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {dtPaged.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onMouseEnter={() => setHoveredRow(rowIndex)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                borderTop: '1px solid #f3f4f6',
                backgroundColor: hoveredRow === rowIndex ? '#f8faff' : 'white',
                transition: 'background-color 0.15s ease'
              }}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} style={{ padding: '14px 16px', fontSize: '14px', color: '#374151' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              {(onEdit || onDelete || onSMS) && (
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    {onSMS && (
                      <button
                        onClick={() => onSMS(row)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(34,197,94,0.25)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        style={{ padding: '7px 10px', border: '1px solid #bbf7d0', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '14px' }}
                        title="Send SMS"
                      >📱</button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        style={{ padding: '7px 10px', border: '1px solid #e0e7ff', background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '14px' }}
                      >✏️</button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(row)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(239,68,68,0.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        style={{ padding: '7px 10px', border: '1px solid #fecaca', background: 'linear-gradient(135deg, #fff5f5, #fef2f2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '14px' }}
                      >🗑️</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {dtTotal > 1 && (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '20px 16px' }}>
        <button
          onClick={function(){setDtPage(function(p){return Math.max(1,p-1)})}}
          disabled={dtPage===1}
          style={{ padding: '8px 18px', border: '1px solid #e0e7ff', borderRadius: '10px', backgroundColor: dtPage===1 ? '#f9fafb' : 'white', color: dtPage===1 ? '#d1d5db' : '#4f46e5', cursor: dtPage===1 ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s ease' }}
        >← Prev</button>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: Math.min(dtTotal, 5) }, (_, i) => {
            let pg;
            if (dtTotal <= 5) pg = i + 1;
            else if (dtPage <= 3) pg = i + 1;
            else if (dtPage >= dtTotal - 2) pg = dtTotal - 4 + i;
            else pg = dtPage - 2 + i;
            return (
              <button key={pg} onClick={() => setDtPage(pg)} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '10px', backgroundColor: pg === dtPage ? '#6366f1' : 'transparent', color: pg === dtPage ? 'white' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: pg === dtPage ? '700' : '500', transition: 'all 0.15s ease' }}>{pg}</button>
            );
          })}
        </div>
        <button
          onClick={function(){setDtPage(function(p){return Math.min(dtTotal,p+1)})}}
          disabled={dtPage>=dtTotal}
          style={{ padding: '8px 18px', border: '1px solid #e0e7ff', borderRadius: '10px', backgroundColor: dtPage>=dtTotal ? '#f9fafb' : 'white', color: dtPage>=dtTotal ? '#d1d5db' : '#4f46e5', cursor: dtPage>=dtTotal ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s ease' }}
        >Next →</button>
      </div>
    )}
    </>
  );
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em', lineHeight: '1.2' }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: '15px', lineHeight: '1.5' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: focused ? '#6366f1' : '#9ca3af', transition: 'color 0.15s ease', fontSize: '14px' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || t('search')}
        style={{
          padding: '10px 16px 10px 42px',
          border: focused ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
          borderRadius: '12px',
          fontSize: '14px',
          width: '280px',
          outline: 'none',
          backgroundColor: focused ? '#fafbff' : '#f9fafb',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
          transition: 'all 0.2s ease'
        }}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', gap: '12px' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e0e7ff', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cs-spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '500' }}>Loading...</span>
    </div>
  );
}

// ==========================================
// SMS MODAL COMPONENT
// ==========================================
function SMSModal({ isOpen, onClose, recipient, onSend }) {
  const { t } = useLanguage();
  const [messageType, setMessageType] = useState('day1');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const messageTemplates = {
    day1: t('day1Message'),
    day3: t('day3Message'),
    day7: t('day7Message'),
    custom: customMessage
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);

    const message = messageType === 'custom' ? customMessage : messageTemplates[messageType];
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId: recipient.church_id,
          recipients: [{ phone: recipient.phone || recipient.whatsapp, name: recipient.full_name || recipient.first_name }],
          message,
          purpose: 'visitor_followup'
        })
      });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setResult({ success: true });
        if (recipient.id) {
          await supabaseUpdate('visitors', recipient.id, { followup_status: 'IN_PROGRESS' });
        }
        setTimeout(() => {
          onClose();
          if (onSend) onSend();
        }, 2000);
      } else {
        setResult({ success: false, error: data.error || data.failures?.[0]?.error || 'Failed to send' });
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    }
    setSending(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`📱 ${t('sendSMS')} - ${recipient?.full_name || recipient?.first_name || ''}`}>
      {result && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: result.success ? '#dcfce7' : '#fef2f2', 
          border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`, 
          borderRadius: '8px', 
          marginBottom: '16px',
          color: result.success ? '#166534' : '#dc2626'
        }}>
          {result.success ? `✅ ${t('messageSent')}` : `❌ ${result.error}`}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>{t('messageTemplate')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['day1', 'day3', 'day7', 'custom'].map((type) => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="messageType"
                checked={messageType === type}
                onChange={() => setMessageType(type)}
              />
              <span style={{ fontSize: '14px' }}>
                {type === 'day1' ? 'Day 1 - Welcome' : 
                 type === 'day3' ? 'Day 3 - Follow-up' : 
                 type === 'day7' ? 'Day 7 - Reminder' : t('customMessage')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {messageType === 'custom' ? (
        <FormInput
          label={t('customMessage')}
          type="textarea"
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Type your message..."
        />
      ) : (
        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
            {messageTemplates[messageType]}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="whatsapp" onClick={() => handleSend()} disabled={sending}>
          {sending ? '⏳...' : '💬 WhatsApp'}
        </Button>
      </div>
    </Modal>
  );
}

// ==========================================
// DASHBOARD PAGE - With Charts
// ==========================================
// ==========================================
// DASHBOARD BUILDING BLOCKS
// ==========================================

/**
 * Animate a number from 0 to `target` on mount and whenever it changes.
 * Uses requestAnimationFrame rather than an interval so it stays in step with
 * the browser's paint, and honours prefers-reduced-motion by jumping straight
 * to the value.
 */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const end = Number(target) || 0;

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // A reduced-motion preference collapses the duration to zero rather than
    // taking a separate code path, so every update still happens inside the
    // animation frame — never synchronously in the effect body.
    const span = reduceMotion ? 0 : duration;
    const start = performance.now();

    const step = (now) => {
      const progress = span <= 0 ? 1 : Math.min(1, (now - start) / span);
      // easeOutCubic: fast at first, settling at the end.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(progress < 1 ? end * eased : end);
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target, duration]);

  return value;
}

/** Grey placeholder with the shimmer from globals.css. */
function Skeleton({ width = '100%', height = '14px', radius = '6px', style = {} }) {
  return <div className="cs-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

function DashStatSkeleton() {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f5' }}>
      <Skeleton width="40px" height="40px" radius="12px" />
      <Skeleton width="60%" height="28px" style={{ marginTop: '16px' }} />
      <Skeleton width="40%" height="12px" style={{ marginTop: '10px' }} />
    </div>
  );
}

function DashPanelSkeleton({ height = '240px' }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f5' }}>
      <Skeleton width="40%" height="16px" />
      <Skeleton width="100%" height={height} style={{ marginTop: '16px' }} />
    </div>
  );
}

/**
 * One headline metric. `trend` is a percentage change vs the previous period;
 * null means there is nothing to compare against yet, in which case no
 * indicator is drawn rather than showing a misleading 0%.
 */
function DashStatCard({ icon, label, value, display, sublabel, trend, trendLabel, color = '#6366f1' }) {
  const animated = useCountUp(value);
  const shown = display ? display(animated) : Math.round(animated).toLocaleString();
  const up = trend != null && trend >= 0;

  return (
    <div
      className="cs-dash-card"
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
      style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f5', transition: 'all 0.2s ease', cursor: 'default' }}
    >
      {/* Colored accent stripe */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: `linear-gradient(135deg, ${color}18, ${color}30)`, boxShadow: `0 2px 8px ${color}15` }}>
            {icon}
          </span>
          {trend != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: up ? '#dcfce7' : '#fef2f2', color: up ? '#166534' : '#991b1b' }}>
              {up ? '↑' : '↓'} {Math.abs(Math.round(trend))}%
            </span>
          )}
        </div>
        <p style={{ margin: '14px 0 0 0', fontSize: '28px', fontWeight: '800', color: '#111827', lineHeight: '1.15', wordBreak: 'break-word', letterSpacing: '-0.02em' }}>{shown}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{label}</p>
        {sublabel && <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>{sublabel}</p>}
        {trend != null && trendLabel && (
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>{trendLabel}</p>
        )}
      </div>
    </div>
  );
}

// Charts are hand-rolled SVG: the only shapes needed are a polyline and some
// rects, which is not worth a charting dependency. A viewBox plus width:100%
// makes them scale; per-point invisible hit areas carry the hover handlers so
// no mouse-coordinate maths is required.
const CHART_W = 520;
const CHART_H = 200;
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

/** Shared y-axis gridlines and labels. */
function ChartGrid({ max, formatValue }) {
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const ticks = [0, 0.5, 1];
  return (
    <g>
      {ticks.map((frac, i) => {
        const y = PAD.top + innerH * (1 - frac);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {formatValue(max * frac)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ChartTooltip({ x, y, lines }) {
  const w = Math.max(72, ...lines.map(l => l.length * 6.2));
  const h = 16 * lines.length + 10;
  // Keep the box inside the viewBox when hovering near an edge.
  const bx = Math.min(Math.max(x - w / 2, 2), CHART_W - w - 2);
  const by = Math.max(y - h - 10, 2);
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={w} height={h} rx="6" fill="#111827" opacity="0.92" />
      {lines.map((line, i) => (
        <text key={i} x={bx + w / 2} y={by + 16 + i * 16} textAnchor="middle" fontSize="11" fill="#ffffff" fontWeight={i === 0 ? '600' : '400'}>
          {line}
        </text>
      ))}
    </g>
  );
}

/** Line chart over an ordered series of { label, value }. */
function DashLineChart({ points, formatValue = (v) => String(Math.round(v)), color = '#6366f1', emptyLabel }) {
  const [hover, setHover] = useState(null);

  if (!points || points.length < 2) {
    return <p style={{ margin: 0, padding: '48px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{emptyLabel}</p>;
  }

  const max = Math.max(...points.map(p => p.value), 1);
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const stepX = innerW / (points.length - 1);
  const coords = points.map((p, i) => ({
    ...p,
    x: PAD.left + stepX * i,
    y: PAD.top + innerH * (1 - p.value / max)
  }));

  // Label every other tick when the series is dense, so they cannot collide.
  const labelEvery = points.length > 7 ? 2 : 1;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img">
      <defs>
        <linearGradient id={`area-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <ChartGrid max={max} formatValue={formatValue} />

      {/* Gradient fill under the line */}
      <polygon
        points={`${coords.map(c => `${c.x},${c.y}`).join(' ')} ${coords[coords.length - 1].x},${PAD.top + innerH} ${coords[0].x},${PAD.top + innerH}`}
        fill={`url(#area-${color.replace('#','')})`}
      />
      <polyline
        points={coords.map(c => `${c.x},${c.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={hover === i ? 5 : 3} fill="#ffffff" stroke={color} strokeWidth="2" />
          {i % labelEvery === 0 && (
            <text x={c.x} y={CHART_H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{c.label}</text>
          )}
          {/* Invisible hit area so hovering anywhere in the column works. */}
          <rect
            x={c.x - stepX / 2} y={PAD.top} width={stepX} height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      ))}

      {hover != null && (
        <>
          <line x1={coords[hover].x} y1={PAD.top} x2={coords[hover].x} y2={PAD.top + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <ChartTooltip x={coords[hover].x} y={coords[hover].y} lines={[formatValue(coords[hover].value), coords[hover].fullLabel || coords[hover].label]} />
        </>
      )}
    </svg>
  );
}

/** Bar chart over an ordered series of { label, value }. */
function DashBarChart({ bars, formatValue = (v) => String(Math.round(v)), color = '#6366f1', emptyLabel }) {
  const [hover, setHover] = useState(null);

  if (!bars || bars.length === 0) {
    return <p style={{ margin: 0, padding: '48px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{emptyLabel}</p>;
  }

  const max = Math.max(...bars.map(b => b.value), 1);
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const slot = innerW / bars.length;
  const barW = Math.min(44, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img">
      <defs>
        <linearGradient id={`bar-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <ChartGrid max={max} formatValue={formatValue} />

      {bars.map((b, i) => {
        const h = (b.value / max) * innerH;
        const x = PAD.left + slot * i + (slot - barW) / 2;
        const y = PAD.top + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={Math.max(h, b.value > 0 ? 2 : 0)} rx="6"
              fill={`url(#bar-${color.replace('#','')})`}
              opacity={hover == null || hover === i ? 1 : 0.4}
            />
            <text x={x + barW / 2} y={CHART_H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{b.label}</text>
            <rect
              x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        );
      })}

      {hover != null && (
        <ChartTooltip
          x={PAD.left + slot * hover + slot / 2}
          y={PAD.top + innerH - (bars[hover].value / max) * innerH}
          lines={[formatValue(bars[hover].value), bars[hover].fullLabel || bars[hover].label]}
        />
      )}
    </svg>
  );
}

/** 1234 -> "1.2k". Keeps chart axis labels narrow enough to not collide. */
function compactNumber(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/**
 * Turn an activity_logs row into an icon, a colour and a one-line summary.
 *
 * `action` is a stored code such as 'member_created', so the summary is built
 * from the code rather than translated: the values in the table are English
 * and are not localised at write time.
 */
function activityMeta(log) {
  const entity = String(log?.entity_type || '').toLowerCase();
  const action = String(log?.action || '');

  const byEntity = {
    member: { icon: '\u{1F465}', color: '#6366f1' },
    visitor: { icon: '\u{1F6B6}', color: '#f59e0b' },
    donation: { icon: '\u{1F4B0}', color: '#10b981' },
    expense: { icon: '\u{1F4E4}', color: '#ef4444' },
    attendance: { icon: '\u{1F4C5}', color: '#0ea5e9' },
    salvation: { icon: '❤️', color: '#ec4899' },
    expense_category: { icon: '\u{1F3F7}️', color: '#8b5cf6' },
    whatsapp_config: { icon: '\u{1F4AC}', color: '#25d366' },
    template: { icon: '\u{1F4DD}', color: '#6b7280' },
    location: { icon: '\u{1F4CD}', color: '#14b8a6' },
    custom_role: { icon: '\u{1F512}', color: '#f97316' }
  };
  const look = byEntity[entity] || { icon: '•', color: '#6b7280' };

  // 'member_created' -> 'member created'
  const phrase = action.replace(/_/g, ' ').trim() || 'activity';
  const name = log?.entity_name;
  const text = name ? `${name} — ${phrase}` : phrase.charAt(0).toUpperCase() + phrase.slice(1);

  return { ...look, text };
}

/** Initials bubble used by the birthday strip. */
function InitialsAvatar({ name, color = '#6366f1', size = 44 }) {
  const initials = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || '?';
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${color}18, ${color}28)`, color, fontWeight: '700', fontSize: `${Math.round(size / 2.9)}px`, letterSpacing: '0.02em' }}>
      {initials}
    </div>
  );
}



export { MemberProfile, exportToCSV, SearchInput, PaginatedList };
export { StatCard, StatusBadge, Modal, FormInput, PermissionGate, AccessDenied };
export { Button, ConfirmDialog, DataTable, PageHeader, SearchBar, LoadingSpinner, SMSModal };
export { useCountUp, Skeleton, DashStatSkeleton, DashPanelSkeleton, DashStatCard };
export { ChartGrid, ChartTooltip, DashLineChart, DashBarChart };
export { compactNumber, activityMeta, InitialsAvatar };
