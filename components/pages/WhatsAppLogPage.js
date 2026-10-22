"use client";
// WhatsAppLogPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, timeAgoShort } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { PageHeader, LoadingSpinner, StatusBadge, DataTable, Button, exportToCSV } from '../cs-ui';

function WhatsAppLogPage({ onNavigate }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [entries, setEntries] = useState([]);
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchLog(); }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const [logData, configData] = await Promise.all([
        supabaseQuery('whatsapp_send_log', {
          filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }],
          order: 'created_at.desc',
          limit: 200
        }),
        // api_token is never selected into the client.
        supabaseQuery('whatsapp_config', {
          select: 'id,is_active,provider,phone_number_id,api_token_last4',
          filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }],
          single: true
        })
      ]);
      setEntries(logData || []);
      setWhatsappConfig(configData || null);
    } catch (error) {
      console.error('WhatsApp log fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Matches the Settings rule: active without credentials cannot send.
  const isSetUp = !!whatsappConfig?.is_active
    && !!whatsappConfig?.api_token_last4
    && !!whatsappConfig?.phone_number_id;

  const filtered = entries.filter(e => {
    if (filter === 'sent') return e.status === 'sent';
    if (filter === 'failed') return e.status === 'failed';
    return true;
  });

  const formatWhen = (iso) => {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '\u2014';
    try {
      return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  };

  const tabs = [
    { id: 'all', label: t('all') || 'All', count: entries.length },
    { id: 'sent', label: '\u2705 Sent', count: entries.filter(e => e.status === 'sent').length },
    { id: 'failed', label: '\u274c Failed', count: entries.filter(e => e.status === 'failed').length }
  ];

  return (
    <div>
      <PageHeader title={`\U0001f4ac ${t('whatsappLog')}`} subtitle={t('everyMessageTried')} />

      {!isSetUp && (
        <div style={{ padding: '14px 18px', marginBottom: '20px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span>\u2139\ufe0f {t('whatsappNotSetUp')}</span>
          <button type="button" onClick={() => onNavigate && onNavigate('settings')} style={{ border: 'none', background: 'none', padding: 0, color: '#1d4ed8', fontWeight: '600', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}>
            {t('settings')}
          </button>
        </div>
      )}

      {/* Status filters */}
      <div className="cs-tab-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '10px 20px',
              border: filter === tab.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius: '10px',
              backgroundColor: filter === tab.id ? '#eef2ff' : 'white',
              color: filter === tab.id ? '#6366f1' : '#6b7280',
              fontWeight: filter === tab.id ? '600' : '400',
              cursor: 'pointer', fontSize: '14px'
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>\U0001f4ac</div>
              <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>{t('nothingSentYet')}</p>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>{t('messagesAppearHere')}</p>
              <a
                href={WHATSAPP_SETUP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#6366f1', textDecoration: 'underline' }}
              >
                📄 {t('setupGuide')}
              </a>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('date')}</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('phone')}</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, i) => (
                    <tr key={entry.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatWhen(entry.created_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace' }}>{entry.phone}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', maxWidth: '420px' }}>
                        {entry.message_preview || '\u2014'}
                        {/* The reason a send failed is the point of the log. */}
                        {entry.status === 'failed' && entry.error_message && (
                          <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{entry.error_message}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500', backgroundColor: entry.status === 'sent' ? '#dcfce7' : '#fef2f2', color: entry.status === 'sent' ? '#166534' : '#991b1b' }}>
                          {entry.status === 'sent' ? '\u2705 Sent' : '\u274c Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// SETTINGS PAGE - Complete with All Features
// ==========================================
// Default role names seeded by the invitation-flow migration. Case-sensitive
// match — a church that renamed any of these (e.g. 'Staff' → 'Team Member')
// no longer fits the auto-pick path and gets the explicit Custom Role dropdown.
const DEFAULT_ROLE_NAMES = ['Admin', 'Staff', 'Volunteer'];
const BASE_ROLE_TO_NAME = { ADMIN: 'Admin', STAFF: 'Staff', VOLUNTEER: 'Volunteer' };

// Sort priority for role-assignment list. Pending surfaces first (admin actionable),
// then active (current team), then expired. Revoked rows are filtered out entirely.
const ASSIGNMENT_STATUS_PRIORITY = { pending: 0, active: 1, expired: 2 };


export default WhatsAppLogPage;
