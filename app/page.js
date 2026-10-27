"use client";

import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import dynamic from 'next/dynamic';
import { supabase, supabaseQuery, sanitizeInput, sanitizeObject, isValidEmail, SUPABASE_URL, SUPABASE_KEY } from '../lib/cs-shared';
import { LanguageProvider, useLanguage, AuthProvider, useAuth, PermissionsProvider, usePermissions, ToastProvider, useToast } from '../lib/cs-contexts';
import { PermissionGate, AccessDenied, LoadingSpinner } from '../components/cs-ui';
import { canAccessFeature, getRequiredPlan } from '../lib/featureGating';
import { isHardcodedSuperAdmin } from '../lib/superAdmin';
import UpgradePrompt from '../components/UpgradePrompt';
// LoginPage is defined at the bottom of this file

// ==========================================
// DYNAMIC IMPORTS — each page loads only when needed
// ==========================================
const DashboardPage = dynamic(() => import('../components/pages/DashboardPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const MembersPage = dynamic(() => import('../components/pages/MembersPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const VisitorsPage = dynamic(() => import('../components/pages/VisitorsPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const AttendancePage = dynamic(() => import('../components/pages/AttendancePage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const GivingPage = dynamic(() => import('../components/pages/GivingPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const SalvationsPage = dynamic(() => import('../components/pages/SalvationsPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const GroupsPage = dynamic(() => import('../components/pages/GroupsPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const VolunteersPage = dynamic(() => import('../components/pages/VolunteersPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const MessagingPage = dynamic(() => import('../components/pages/MessagingPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const ReportsPage = dynamic(() => import('../components/pages/ReportsPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const CalendarPage = dynamic(() => import('../components/pages/CalendarPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const ServicesPage = dynamic(() => import('../components/pages/ServicesPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const SuperAdminPage = dynamic(() => import('../components/pages/SuperAdminPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const WhatsAppLogPage = dynamic(() => import('../components/pages/WhatsAppLogPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});
const SettingsPage = dynamic(() => import('../components/pages/SettingsPage'), {
  loading: () => <PageLoadingFallback />,
  ssr: false
});

// Loading fallback for dynamic page imports
function PageLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cs-spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>Loading...</p>
      </div>
    </div>
  );
}

// ==========================================
// SHELL COMPONENTS (loaded with initial bundle)
// ==========================================
function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setShowOnline(true);
      setTimeout(() => setShowOnline(false), 3000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  if (!offline && !showOnline) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998, textAlign: 'center',
      padding: '8px 16px', fontSize: '13px', fontWeight: '500',
      backgroundColor: offline ? '#fef3c7' : '#dcfce7',
      color: offline ? '#92400e' : '#166534',
      transition: 'all 0.3s'
    }}>
      {offline ? '📡 You\'re offline. Some features may be limited.' : '✅ You\'re back online!'}
    </div>
  );
}

function CookieConsentBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setVisible(true);
    } else if (consent === 'accepted') {
      loadGA();
    }
  }, []);

  const loadGA = () => {
    const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (!GA_ID || typeof window === 'undefined') return;
    if (document.getElementById('ga-script')) return;
    const s = document.createElement('script');
    s.id = 'ga-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA_ID);
  };

  const accept = () => { localStorage.setItem('cookie_consent', 'accepted'); setVisible(false); loadGA(); };
  const decline = () => { localStorage.setItem('cookie_consent', 'declined'); setVisible(false); };

  if (!visible) return null;
  return (
    <div className="cs-cookie-banner" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1f2937', color: '#e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', zIndex: 9999, fontSize: '14px', boxShadow: '0 -2px 8px rgba(0,0,0,0.15)' }}>
      <p style={{ margin: 0, flex: '1 1 300px' }}>{t('cookieText')}</p>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={decline} style={{ padding: '8px 20px', border: '1px solid #6b7280', borderRadius: '8px', backgroundColor: 'transparent', color: '#d1d5db', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>{t('decline')}</button>
        <button onClick={accept} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{t('accept')}</button>
      </div>
    </div>
  );
}

export default function ChurchSmartApp() {
  return (
    <ToastProvider>
    <LanguageProvider>
      <AuthProvider>
      <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes cs-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                                                                                                                                                                                                                                                          @media (max-width: 768px) {
            .sidebar { position: fixed !important; left: -280px !important; top: 0 !important; bottom: 0 !important; width: 260px !important; z-index: 50 !important; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
            .sidebar.open { left: 0 !important; }
            .mobile-overlay { display: block !important; }
            .header-title { display: none !important; }
            .desktop-only { display: none !important; }
            .main-page { padding: 12px !important; }
            .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
            .table-wrap table { min-width: 600px !important; }
            .form-grid { grid-template-columns: 1fr !important; }
            .modal-content { width: 95% !important; padding: 16px !important; }
            .login-container { flex-direction: column !important; }
            .login-branding { display: none !important; }
            .login-form-side { width: 100% !important; min-width: unset !important; padding: 20px !important; }
            .login-form-box { max-width: 100% !important; }
            .login-logo { text-align: center; margin-bottom: 16px; }
          }
        `}} />
        <PermissionsProvider>
        <NetworkStatus />
        <AppContent />
        <CookieConsentBanner />
        </PermissionsProvider>
      </AuthProvider>
    </LanguageProvider>
    </ToastProvider>
  );
}

function AppContent() {
  const { user, loading, passwordRecovery } = useAuth();

  // Dismiss splash screen once auth state resolves
  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && window.__dismissSplash) {
      window.__dismissSplash();
    }
  }, [loading]);

    // ── Public Join Page: detect ?join=CHURCH_ID or ?connect=SLUG ──
  const [joinChurchId, setJoinChurchId] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Store pre-selected plan from landing page (?plan=starter, etc.)
      const planParam = params.get('plan');
      if (planParam && ['starter', 'growth', 'pro'].includes(planParam.toLowerCase())) {
        localStorage.setItem('selected_plan', planParam.toLowerCase());
      }
      // Store billing period from landing page (?billing=annual|monthly)
      const billingParam = params.get('billing');
      if (billingParam && ['monthly', 'annual'].includes(billingParam.toLowerCase())) {
        localStorage.setItem('selected_billing', billingParam.toLowerCase());
      }
      const joinId = params.get('join');
      const connectSlug = params.get('connect');
      if (joinId) {
        setJoinChurchId(joinId);
      } else if (connectSlug) {
        // Resolve slug to church ID
        (async () => {
          try {
            const { data } = await supabase.from('churches').select('id').ilike('slug', connectSlug).limit(1);
            if (data?.length > 0) setJoinChurchId(data[0].id);
          } catch (err) { console.error('Error resolving slug:', err); }
        })();
      }
    }
  }, []);

  // Render public join form (no auth required)
  if (joinChurchId) {
    return <PublicJoinPage churchId={joinChurchId} />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cs-spin 0.7s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || passwordRecovery) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

function PublicJoinPage({ churchId }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', whatsapp: '', date_of_birth: '',
    gender: 'MALE', address: '', city: '', emergency_contact: '', emergency_phone: '', photo_url: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchLogo, setChurchLogo] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Fetch church info + locations
  useEffect(() => {
    const fetchChurchInfo = async () => {
      try {
        const churchData = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: churchId }] });
        if (churchData && churchData.length > 0) {
          setChurchName(churchData[0].name || 'Our Church');
          setChurchLogo(churchData[0].logo_url || '');
        }
        const locsData = await supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: churchId }] });
        if (locsData && locsData.length > 0) {
          setLocations(locsData);
          const mainCampus = locsData.find(l => l.is_main_campus);
          setSelectedLocation(mainCampus?.id || locsData[0]?.id || '');
        }
      } catch (err) { console.error('Error fetching church info:', err); }
    };
    fetchChurchInfo();
  }, [churchId]);

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      setError('First name and last name are required.');
      return;
    }
    if (!form.phone && !form.email) {
      setError('Please provide at least a phone number or email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/public/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          emergency_contact: form.emergency_contact.trim() || null,
          emergency_phone: form.emergency_phone.trim() || null,
          photo_url: form.photo_url || null,
          location_id: selectedLocation || null
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        setError(result.error || 'Submission failed. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError('Submission failed. Please check your connection and try again.');
    }
    setSubmitting(false);
  };

  // Success screen
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '48px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>✅</div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '28px', fontWeight: '700', color: '#166534' }}>Welcome!</h1>
          <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#374151' }}>Thank you, <strong>{form.first_name}</strong>!</p>
          <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#6b7280', lineHeight: '1.6' }}>
            Your information has been submitted to <strong>{churchName || 'the church'}</strong>. 
            A church leader will be in touch with you soon.
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {churchLogo ? (
            <img src={churchLogo} alt={churchName} style={{ height: '60px', marginBottom: '16px', objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>⛪</div>
          )}
          <h1 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: '700', color: '#1f2937' }}>{churchName || 'Welcome'}</h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#6b7280' }}>Please fill in your details to join our community</p>
        </div>

        {/* Form Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '20px', fontSize: '14px', color: '#991b1b' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Photo Upload (optional) */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f3f4f6', margin: '0 auto 10px' }}>
              {form.photo_url ? (
                <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '28px' }}>📷</span>
              )}
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: form.photo_url ? '#dcfce7' : '#f3f4f6',
              border: '1px solid #e5e7eb', borderRadius: '20px', fontSize: '13px',
              color: form.photo_url ? '#166534' : '#6b7280', cursor: 'pointer', fontWeight: '500'
            }}>
              {form.photo_url ? '✅ Photo added' : '📷 Add Photo (optional)'}
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB'); return; }
                  try {
                    const url = await uploadPhoto(file, 'member-photos');
                    if (url) setForm({ ...form, photo_url: url });
                    else {
                      const fallback = await uploadPhoto(file, 'avatars');
                      if (fallback) setForm({ ...form, photo_url: fallback });
                    }
                  } catch (err) { /* silently fail for optional field */ }
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Name Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>First Name *</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="John" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Last Name *</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
          </div>

          {/* Phone + WhatsApp Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>📱 Phone Number *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>💬 WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="Same or different number" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
          </div>

          {/* Gender + DOB Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', backgroundColor: 'white' }}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px' }} />
            </div>
          </div>

          {/* Address + City Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>City</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Yaoundé" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
          </div>

          {/* Emergency Contact Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>🆘 Emergency Contact</label>
              <input type="text" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Contact name" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>📞 Emergency Phone</label>
              <input type="tel" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} placeholder="+237 6XX XXX XXX" style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none' }} />
            </div>
          </div>

          {/* Location (if multiple) */}
          {locations.length > 1 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>📍 Campus / Location</label>
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', backgroundColor: 'white' }}>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.is_main_campus ? `${loc.name} (Main Campus)` : loc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
            backgroundColor: submitting ? '#a5b4fc' : '#6366f1', color: 'white',
            fontSize: '16px', fontWeight: '600', cursor: submitting ? 'wait' : 'pointer',
            transition: 'all 0.2s', marginTop: '4px'
          }}>
            {submitting ? '⏳ Submitting...' : '✅ Submit My Information'}
          </button>

          <p style={{ margin: '16px 0 0 0', fontSize: '12px', color: '#9ca3af', textAlign: 'center', lineHeight: '1.5' }}>
            Your information is securely stored and only accessible to church leadership.
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>Powered by <span style={{ fontWeight: '600', color: '#6366f1' }}>ChurchSmart</span></p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// LOGIN PAGE - Split Screen Bilingual + Registration with Church Info
// ==========================================
// ==========================================
// GOOGLE CHURCH SETUP (for new Google users with no church)
// ==========================================

function DashboardWelcomeCard({ userName, onOpenSetup }) {
  const { t } = useLanguage();
  const firstName = userName?.split(' ')[0] || userName || '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' }}>
      <div style={{ maxWidth: '560px', width: '100%', textAlign: 'center', padding: '48px 32px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #eef2ff' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⛪</div>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>
          {t('welcomeCardTitle').replace('{name}', firstName)}
        </h1>
        <p style={{ margin: '0 0 28px 0', color: '#6b7280', fontSize: '16px', lineHeight: '1.6' }}>
          {t('welcomeCardBody')}
        </p>
        <button onClick={onOpenSetup} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}>
          {t('welcomeCardCta')}
        </button>
      </div>
    </div>
  );
}

function ChurchSetupRequired({ pageKey, onOpenSetup }) {
  const { t } = useLanguage();
  const featureLabel = t(pageKey).toLowerCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⛪</div>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', fontWeight: '600', color: '#1f2937' }}>
          {t('setupRequiredTitle')}
        </h2>
        <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
          {t('setupRequiredBody').replace('{feature}', featureLabel)}
        </p>
        <button onClick={onOpenSetup} style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}>
          {t('setupRequiredCta')}
        </button>
      </div>
    </div>
  );
}

function GoogleChurchSetup({ user, onClose }) {
  const { loadUserProfile } = useAuth();
  const toast = useToast();
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    church_name: '', church_city: '', church_denomination: '',
    church_pastor: '', church_phone: '', church_email: '',
    church_currency: 'XAF'
  });

  const txt = {
    en: {
      title: 'Set Up Your Church',
      desc: 'Tell us about your church to unlock all features.',
      churchName: 'Church Name *', city: 'City', denomination: 'Denomination',
      pastor: 'Senior Pastor', phone: 'Church Phone', email: 'Church Email',
      currency: 'Currency', create: 'Create My Church →', creating: 'Creating...',
      cancel: 'Cancel', close: 'Close', required: 'Church name is required',
      failedCreateChurch: 'Failed to create church. Please try again.',
      failedLinkAccount: 'Failed to link account. Please try again.',
      churchCreated: '🎉 Church created successfully!',
      timeoutError: 'Network timeout — please try again.',
      unexpectedError: 'Unexpected error — please try again.',
      sessionExpired: 'Your session has expired. Please sign in again.',
      profileNotFound: 'User profile not found. Please contact support.',
      churchAlreadyExists: 'A church already exists for your account.'
    },
    fr: {
      title: 'Configurer Votre Église',
      desc: 'Parlez-nous de votre église pour débloquer toutes les fonctionnalités.',
      churchName: 'Nom de l\'Église *', city: 'Ville', denomination: 'Dénomination',
      pastor: 'Pasteur Principal', phone: 'Téléphone', email: 'Email de l\'Église',
      currency: 'Devise', create: 'Créer Mon Église →', creating: 'Création...',
      cancel: 'Annuler', close: 'Fermer', required: 'Le nom de l\'église est requis',
      failedCreateChurch: 'Échec de la création de l\'église. Veuillez réessayer.',
      failedLinkAccount: 'Échec de la liaison du compte. Veuillez réessayer.',
      churchCreated: '🎉 Église créée avec succès !',
      timeoutError: 'Délai de connexion dépassé — veuillez réessayer.',
      unexpectedError: 'Erreur inattendue — veuillez réessayer.',
      sessionExpired: 'Votre session a expiré. Veuillez vous reconnecter.',
      profileNotFound: 'Profil utilisateur introuvable. Veuillez contacter le support.',
      churchAlreadyExists: 'Une église existe déjà pour votre compte.'
    }
  };
  const t = txt[lang];

  const inputStyle = { width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };

  const handleCreate = async () => {
    if (!form.church_name.trim()) { toast.warning(t.required); return; }
    setLoading(true);

    // 20s timeout safety net for the server round-trip. Server-side path is fast,
    // but defense-in-depth against a stuck Vercel cold start or flaky last-mile network.
    const withTimeout = (factory, ms = 20000) => {
      const controller = new AbortController();
      const timeout = new Promise((_, reject) => setTimeout(() => {
        controller.abort();
        const err = new Error('TIMEOUT');
        err.name = 'TimeoutError';
        reject(err);
      }, ms));
      return Promise.race([factory(controller.signal), timeout]);
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t.sessionExpired);
        return;
      }

      const response = await withTimeout((signal) => fetch('/api/onboarding/create-church', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: form.church_name,
          city: form.church_city || null,
          denomination: form.church_denomination || null,
          senior_pastor: form.church_pastor || null,
          currency: form.church_currency || 'XAF',
          church_phone: form.church_phone || null,
          church_email: form.church_email || null,
          // Pastor's UI-language toggle is the most authentic signal of
          // their language preference; persist it so future emails
          // (invitations, notifications) are sent in the right language.
          default_language: lang === 'fr' ? 'FRENCH' : 'ENGLISH'
        }),
        signal
      }));

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        const code = result?.code;
        if (code === 'NO_AUTH' || code === 'INVALID_AUTH') toast.error(t.sessionExpired);
        else if (code === 'USER_NOT_FOUND') toast.error(t.profileNotFound);
        else if (code === 'CHURCH_EXISTS') toast.error(t.churchAlreadyExists);
        else toast.error(t.failedCreateChurch);
        return;
      }

      const newChurch = result.church;

      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, churchName: form.church_name, adminName: user.name })
      }).then(() => supabase.from('churches').update({ welcome_email_sent: true }).eq('id', newChurch.id)).catch(() => {});

      toast.success(t.churchCreated);
      await loadUserProfile(user.email);
      if (onClose) onClose();
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        toast.error(t.timeoutError);
      } else {
        toast.error(err?.message || t.unexpectedError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', zIndex: 1000, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '40px', position: 'relative', marginTop: '40px', marginBottom: '40px' }}>
        <button type="button" onClick={onClose} aria-label={t.close} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer', color: '#6b7280', width: '32px', height: '32px', borderRadius: '50%' }}>×</button>
        {/* Language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '4px' }}>
          <button onClick={() => setLang('en')} style={{ padding: '4px 10px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'en' ? '#eef2ff' : 'transparent', color: lang === 'en' ? '#4f46e5' : '#9ca3af', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>EN</button>
          <button onClick={() => setLang('fr')} style={{ padding: '4px 10px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'fr' ? '#eef2ff' : 'transparent', color: lang === 'fr' ? '#4f46e5' : '#9ca3af', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>FR</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⛪</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{t.title}</h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{t.desc}</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t.churchName}</label>
          <input type="text" value={form.church_name} onChange={(e) => setForm({...form, church_name: e.target.value})} placeholder="e.g., Fire of God Ministry" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>{t.city}</label>
            <input type="text" value={form.church_city} onChange={(e) => setForm({...form, church_city: e.target.value})} placeholder="Douala" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.denomination}</label>
            <input type="text" value={form.church_denomination} onChange={(e) => setForm({...form, church_denomination: e.target.value})} placeholder="Pentecostal" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>{t.pastor}</label>
            <input type="text" value={form.church_pastor} onChange={(e) => setForm({...form, church_pastor: e.target.value})} placeholder="Pastor John" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.currency}</label>
            <select value={form.church_currency} onChange={(e) => setForm({...form, church_currency: e.target.value})} style={inputStyle}>
              <option value="XAF">XAF (CFA Franc)</option>
              <option value="NGN">NGN (Naira)</option>
              <option value="GHS">GHS (Cedi)</option>
              <option value="KES">KES (Shilling)</option>
              <option value="USD">USD (Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="GBP">GBP (Pound)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>{t.phone}</label>
            <input type="tel" value={form.church_phone} onChange={(e) => setForm({...form, church_phone: e.target.value})} placeholder="+237..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.email}</label>
            <input type="email" value={form.church_email} onChange={(e) => setForm({...form, church_email: e.target.value})} placeholder="info@church.com" style={inputStyle} />
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading}
          style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)', marginBottom: '12px' }}>
          {loading ? `⏳ ${t.creating}` : t.create}
        </button>

        <button onClick={onClose}
          style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}


function LoginPage() {
  const { login, register, forgotPassword, passwordRecovery, setPasswordRecovery } = useAuth();
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(passwordRecovery || false);
  const [showOTP, setShowOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true' || window.location.hash?.includes('type=recovery')) {
      setShowResetForm(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', confirm_password: '',
    church_name: '', church_address: '', church_city: '', church_phone: '', church_email: '',
    church_pastor: '', church_denomination: '', church_currency: 'XAF'
  });

  const txt = {
    en: {
      welcome: 'Welcome back', signInDesc: 'Sign in to manage your church',
      createAccount: 'Create account', getStarted: 'Start your free 30-day trial',
      signIn: 'Sign In', register: 'Register', email: 'Email', password: 'Password',
      fullName: 'Full Name', phone: 'Phone', confirmPassword: 'Confirm Password',
      rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
      signingIn: 'Signing in...', signInBtn: 'Sign In', createBtn: 'Continue',
      secure: 'Secure · Encrypted · GDPR Compliant',
      orContinueWith: 'or',
      googleSignIn: 'Continue with Google',
      googleLinkNeeded: 'Google account not linked to any church. Please register first or contact your administrator.',
      forgotTitle: 'Reset Password', forgotDesc: 'We’ll send a reset link to your email',
      sendResetLink: 'Send Reset Link', backToLogin: '← Back to Sign In',
      resetSent: 'Reset link sent! Check your inbox.',
      newPasswordTitle: 'New Password', newPasswordDesc: 'Choose a strong password for your account',
      newPassword: 'New Password', confirmNewPassword: 'Confirm Password',
      updatePassword: 'Update Password', passwordUpdated: 'Password updated! Redirecting...',
      otpTitle: 'Check your email', otpDesc: 'Enter the 8-digit code sent to',
      otpPlaceholder: '00000000', verifyCode: 'Verify', verifying: 'Verifying...',
      resendCode: 'Resend code', codeSent: 'New code sent!', invalidCode: 'Invalid code. Please try again.',
      tagline: 'The all-in-one platform built for African churches',
      subtitle: 'Track members, manage finances, send messages, and grow your ministry — all from one place.',
      churches: 'Churches', membersManaged: 'Members', countries: 'Countries',
      memberMgmt: 'Member Management', memberDesc: 'Track members, visitors & groups across all locations',
      finance: 'Financial Tracking', financeDesc: 'Tithes, offerings, expenses & reports',
      reports: 'Smart Reports', reportsDesc: 'Real-time analytics for growth',
      messaging: 'Email & WhatsApp', messagingDesc: 'Automated messages & bulk comms',
      volunteers: 'Volunteer Scheduling', volunteersDesc: 'Ministries, rosters & team leads',
      multiLoc: 'Multi-Location', multiLocDesc: 'Multiple campuses, one dashboard',
      footer: '© 2026 ChurchSmart by DigiSmart Africa. All rights reserved.',
      churchInfo: 'Church Information', churchInfoDesc: 'Tell us about your church',
      churchName: 'Church Name *', churchAddress: 'Address', churchCity: 'City',
      churchPhone: 'Church Phone', churchEmail: 'Church Email', pastorName: 'Senior Pastor',
      denomination: 'Denomination', currency: 'Currency',
      back: '← Back', finishBtn: 'Send Verification Code', creating: 'Sending...',
      step1: 'Sign Up', step2: 'Verify',
      visitSite: 'Learn more at churchsmartnow.com'
    },
    fr: {
      welcome: 'Bienvenue', signInDesc: 'Connectez-vous pour gérer votre église',
      createAccount: 'Créer un compte', getStarted: 'Essai gratuit de 30 jours',
      signIn: 'Connexion', register: 'S’inscrire', email: 'Email', password: 'Mot de passe',
      fullName: 'Nom complet', phone: 'Téléphone', confirmPassword: 'Confirmer',
      rememberMe: 'Se souvenir', forgotPassword: 'Mot de passe oublié ?',
      signingIn: 'Connexion...', signInBtn: 'Connexion', createBtn: 'Continuer',
      secure: 'Sécurisé · Chiffré · Conforme RGPD',
      orContinueWith: 'ou',
      googleSignIn: 'Continuer avec Google',
      googleLinkNeeded: 'Compte Google non lié. Inscrivez-vous d’abord.',
      forgotTitle: 'Réinitialiser', forgotDesc: 'Nous enverrons un lien à votre email',
      sendResetLink: 'Envoyer le lien', backToLogin: '← Retour',
      resetSent: 'Lien envoyé ! Vérifiez votre boîte.',
      newPasswordTitle: 'Nouveau mot de passe', newPasswordDesc: 'Choisissez un mot de passe fort',
      newPassword: 'Nouveau mot de passe', confirmNewPassword: 'Confirmer',
      updatePassword: 'Mettre à jour', passwordUpdated: 'Mis à jour ! Redirection...',
      otpTitle: 'Vérifiez votre email', otpDesc: 'Entrez le code à 8 chiffres envoyé à',
      otpPlaceholder: '00000000', verifyCode: 'Vérifier', verifying: 'Vérification...',
      resendCode: 'Renvoyer', codeSent: 'Code renvoyé !', invalidCode: 'Code invalide.',
      tagline: 'La plateforme tout-en-un pour les églises africaines',
      subtitle: 'Suivez vos membres, gérez les finances, envoyez des messages et développez votre ministère.',
      churches: 'Églises', membersManaged: 'Membres', countries: 'Pays',
      memberMgmt: 'Gestion des Membres', memberDesc: 'Membres, visiteurs et groupes',
      finance: 'Suivi Financier', financeDesc: 'Dîmes, offrandes et rapports',
      reports: 'Rapports', reportsDesc: 'Analyses en temps réel',
      messaging: 'Email & WhatsApp', messagingDesc: 'Messages automatisés',
      volunteers: 'Bénévoles', volunteersDesc: 'Ministères et plannings',
      multiLoc: 'Multi-Sites', multiLocDesc: 'Plusieurs campus, un tableau de bord',
      footer: '© 2026 ChurchSmart par DigiSmart Africa. Tous droits réservés.',
      churchInfo: 'Informations', churchInfoDesc: 'Parlez-nous de votre église',
      churchName: 'Nom *', churchAddress: 'Adresse', churchCity: 'Ville',
      churchPhone: 'Téléphone', churchEmail: 'Email', pastorName: 'Pasteur',
      denomination: 'Dénomination', currency: 'Devise',
      back: '← Retour', finishBtn: 'Envoyer le code', creating: 'Envoi...',
      step1: 'Inscription', step2: 'Vérifier',
      visitSite: 'En savoir plus sur churchsmartnow.com'
    }
  };
  const t = txt[lang];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (isLogin) {
      setLoading(true);
      const result = await login(form.email, form.password);
      if (!result || !result.success) { setError(result?.error || 'Login failed'); }
      setLoading(false);
    } else {
      if (step === 1) {
        if (!form.full_name || !form.email || !form.password) { setError(lang === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill in all required fields'); return; }
        if (!isValidEmail(form.email)) { setError(lang === 'fr' ? 'Email invalide' : 'Invalid email format'); return; }
        if (form.password !== form.confirm_password) { setError(lang === 'fr' ? 'Mots de passe différents' : 'Passwords do not match'); return; }
        if (form.password.length < 8) { setError(lang === 'fr' ? 'Min. 8 caractères' : 'Password must be at least 8 characters'); return; }
        if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError(lang === 'fr' ? 'Majuscule + chiffre requis' : 'Must include uppercase + number'); return; }
        setLoading(true);
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.email.trim().toLowerCase(),
            password: form.password,
            options: { data: { full_name: form.full_name }, emailRedirectTo: undefined }
          });
          if (authError) {
            setError(authError.message?.includes('already registered')
              ? (lang === 'fr' ? 'Email déjà utilisé. Connectez-vous.' : 'Email already registered. Please sign in.')
              : authError.message);
            setLoading(false); return;
          }
          setOtpEmail(form.email.trim().toLowerCase());
          setStep(2);
        } catch (err) { setError('Failed to send verification code'); }
        setLoading(false);
      } else if (step === 2) {
        if (!otpCode || otpCode.length !== 8) { setError(lang === 'fr' ? 'Code à 8 chiffres requis' : 'Enter the 8-digit code'); return; }
        setLoading(true);
        try {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode, type: 'signup' });
          if (verifyError) { setError(t.invalidCode); setLoading(false); return; }
          if (verifyData?.session) { await supabase.auth.setSession(verifyData.session); }
          window.location.reload(); return;
        } catch (err) { setError(err.message || 'Verification failed'); }
        setLoading(false);
      }
    }
  };

  const handleResendOTP = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: otpEmail });
      if (error) { setError(error.message); } else { setSuccess(t.codeSent); }
    } catch (err) { setError('Failed to resend code'); }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) { setError(error.message); setLoading(false); }
    } catch (err) { setError('Google sign-in failed'); setLoading(false); }
  };

  const features = [
    { icon: '👥', title: t.memberMgmt, desc: t.memberDesc },
    { icon: '💰', title: t.finance, desc: t.financeDesc },
    { icon: '📊', title: t.reports, desc: t.reportsDesc },
    { icon: '💬', title: t.messaging, desc: t.messagingDesc },
    { icon: '🙋', title: t.volunteers, desc: t.volunteersDesc },
    { icon: '🌍', title: t.multiLoc, desc: t.multiLocDesc }
  ];

  const inputStyle = {
    width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px',
    fontSize: '15px', transition: 'all 0.2s ease', outline: 'none', backgroundColor: '#f8fafc',
    boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', letterSpacing: '0.01em' };
  const btnPrimary = {
    width: '100%', padding: '14px', background: '#4f46e5', color: 'white', border: 'none',
    borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.2s ease', fontFamily: 'inherit'
  };

  return (
    <div className="cs-login-page" style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f8fafc' }}>
      {/* LEFT PANEL — Branding */}
      <div className="cs-login-branding" style={{
        width: '48%', minHeight: '100vh', background: 'linear-gradient(160deg, #312e81 0%, #4f46e5 40%, #6366f1 70%, #818cf8 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 48px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-120px', right: '-80px', width: '320px', height: '320px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '-60px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '50%', right: '10%', width: '200px', height: '200px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '50%', transform: 'translateY(-50%)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ marginBottom: '48px' }}>
            <img src="/churchsmart-logo.svg" alt="ChurchSmart" style={{ height: '38px', width: 'auto', filter: 'brightness(10)' }} />
          </div>

          {/* Headline */}
          <h1 style={{ margin: '0 0 16px 0', fontSize: '36px', fontWeight: '800', color: 'white', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
            {t.tagline}
          </h1>
          <p style={{ margin: '0 0 48px 0', fontSize: '16px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.7', maxWidth: '400px' }}>
            {t.subtitle}
          </p>

          {/* Feature pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '48px' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease'
              }}>
                <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>{f.icon}</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'white' }}>{f.title}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.4' }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[{ num: '500+', label: t.churches }, { num: '50K+', label: t.membersManaged }, { num: '10+', label: t.countries }].map((s, i) => (
              <div key={i}>
                <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: 'white', letterSpacing: '-0.02em' }}>{s.num}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: '40px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{t.footer}</p>
        </div>
      </div>

      {/* RIGHT PANEL — Form */}
      <div className="cs-login-form-panel" style={{
        width: '52%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px', position: 'relative', backgroundColor: '#ffffff'
      }}>
        {/* Language toggle */}
        <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '2px', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
          <button onClick={() => setLang('en')} style={{
            padding: '7px 14px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
            backgroundColor: lang === 'en' ? 'white' : 'transparent', color: lang === 'en' ? '#4f46e5' : '#94a3b8',
            boxShadow: lang === 'en' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s'
          }}>EN</button>
          <button onClick={() => setLang('fr')} style={{
            padding: '7px 14px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
            backgroundColor: lang === 'fr' ? 'white' : 'transparent', color: lang === 'fr' ? '#4f46e5' : '#94a3b8',
            boxShadow: lang === 'fr' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s'
          }}>FR</button>
        </div>

        {/* Visit main site link */}
        <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
          <a href="https://churchsmartnow.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'none', fontWeight: '500', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#4f46e5'}
            onMouseLeave={(e) => e.target.style.color = '#94a3b8'}>
            {t.visitSite} ↗
          </a>
        </div>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {isLogin ? t.welcome : t.createAccount}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px', lineHeight: '1.5' }}>
              {isLogin ? t.signInDesc : t.getStarted}
            </p>
          </div>

          {/* Tab toggle */}
          <div style={{ display: 'flex', marginBottom: '28px', backgroundColor: '#f1f5f9', borderRadius: '14px', padding: '4px' }}>
            <button onClick={() => { setIsLogin(true); setError(''); setSuccess(''); setStep(1); }}
              style={{
                flex: 1, padding: '11px', border: 'none', borderRadius: '11px', fontSize: '14px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.25s ease', fontFamily: 'inherit',
                backgroundColor: isLogin ? 'white' : 'transparent', color: isLogin ? '#4f46e5' : '#94a3b8',
                boxShadow: isLogin ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
              }}>{t.signIn}</button>
            <button onClick={() => { setIsLogin(false); setError(''); setSuccess(''); setStep(1); }}
              style={{
                flex: 1, padding: '11px', border: 'none', borderRadius: '11px', fontSize: '14px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.25s ease', fontFamily: 'inherit',
                backgroundColor: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#4f46e5' : '#94a3b8',
                boxShadow: !isLogin ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
              }}>{t.register}</button>
          </div>

          {/* Step indicator for register */}
          {!isLogin && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>1</span>
                <span style={{ fontSize: '13px', color: step === 1 ? '#4f46e5' : '#94a3b8', fontWeight: step === 1 ? '600' : '400' }}>{t.step1}</span>
              </div>
              <div style={{ flex: 1, height: '2px', backgroundColor: step >= 2 ? '#4f46e5' : '#e2e8f0', borderRadius: '1px', transition: 'background-color 0.3s' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: step >= 2 ? '#4f46e5' : '#e2e8f0', color: step >= 2 ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', transition: 'all 0.3s' }}>2</span>
                <span style={{ fontSize: '13px', color: step === 2 ? '#4f46e5' : '#94a3b8', fontWeight: step === 2 ? '600' : '400' }}>{t.step2}</span>
              </div>
            </div>
          )}

          {/* Alerts */}
          {error && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '16px', color: '#dc2626', fontSize: '14px', lineHeight: '1.5' }}>{error}</div>}
          {success && <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '16px', color: '#15803d', fontSize: '14px', lineHeight: '1.5' }}>{success}</div>}

          {/* RESET PASSWORD */}
          {showResetForm ? (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{t.newPasswordTitle}</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{t.newPasswordDesc}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t.newPassword}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>{t.confirmNewPassword}</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <button onClick={async () => {
                setError(''); setSuccess('');
                if (!newPassword || newPassword.length < 8) { setError(lang === 'fr' ? 'Min. 8 caractères' : 'Min. 8 characters'); return; }
                if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { setError(lang === 'fr' ? 'Majuscule + chiffre requis' : 'Must include uppercase + number'); return; }
                if (newPassword !== confirmNewPassword) { setError(lang === 'fr' ? 'Mots de passe différents' : 'Passwords do not match'); return; }
                setLoading(true);
                const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
                if (updateErr) { setError(updateErr.message); }
                else {
                  setSuccess(t.passwordUpdated); setShowResetForm(false);
                  if (setPasswordRecovery) setPasswordRecovery(false);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.user?.email) { window.location.href = '/'; }
                }
                setLoading(false);
              }} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ ...' : t.updatePassword}
              </button>
            </div>
          ) : showForgotPassword ? (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{t.forgotTitle}</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{t.forgotDesc}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t.email}</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@church.com" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <button onClick={async () => {
                setLoading(true); setError(''); setSuccess('');
                const result = await forgotPassword(resetEmail);
                if (result.success) { setSuccess(t.resetSent); } else { setError(result.error); }
                setLoading(false);
              }} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px' }}>
                {loading ? '⏳ ...' : t.sendResetLink}
              </button>
              <button onClick={() => { setShowForgotPassword(false); setError(''); setSuccess(''); }}
                style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#4f46e5', border: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.backToLogin}
              </button>
            </div>
          ) : (
          <>
          <form onSubmit={handleSubmit}>
            {/* LOGIN FIELDS */}
            {isLogin && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.email}</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.password}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#4f46e5', borderRadius: '4px' }} /> {t.rememberMe}
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPassword(true); setError(''); setSuccess(''); setResetEmail(form.email); }}
                    style={{ fontSize: '13px', color: '#4f46e5', textDecoration: 'none', fontWeight: '500' }}>{t.forgotPassword}</a>
                </div>
              </>
            )}

            {/* REGISTER STEP 1 */}
            {!isLogin && step === 1 && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.fullName} *</label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Pastor John Doe" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.email} *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.phone}</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t.password} *</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.confirmPassword} *</label>
                    <input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="••••••" style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
                  </div>
                </div>
              </>
            )}

            {/* REGISTER STEP 2 — OTP */}
            {!isLogin && step === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 16px' }}>✉️</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{t.otpTitle}</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{t.otpDesc} <strong style={{ color: '#0f172a' }}>{otpEmail}</strong></p>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <input type="text" value={otpCode} maxLength={8}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder={t.otpPlaceholder}
                    style={{ width: '100%', padding: '16px', border: '1.5px solid #e2e8f0', borderRadius: '14px', fontSize: '28px', textAlign: 'center', letterSpacing: '10px', fontWeight: '700', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc', fontFamily: 'monospace' }}
                    onFocus={(e) => { e.target.style.borderColor = '#818cf8'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                    autoFocus />
                </div>
                <p style={{ textAlign: 'center', margin: '0 0 16px 0' }}>
                  <button type="button" onClick={handleResendOTP} disabled={loading}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '13px', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                    {t.resendCode}
                  </button>
                </p>
              </>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isLogin && step === 2 && (
                <button type="button" onClick={() => setStep(step - 1)}
                  style={{ flex: '0 0 auto', padding: '14px 20px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t.back}
                </button>
              )}
              <button type="submit" disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? (isLogin ? t.signingIn : step === 2 ? t.verifying : t.creating) : isLogin ? t.signInBtn : step === 1 ? t.finishBtn : t.verifyCode}
              </button>
            </div>
          </form>

          {/* Google Sign-In */}
          {isLogin && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{t.orContinueWith}</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>
              <button onClick={handleGoogleSignIn} disabled={loading}
                style={{
                  width: '100%', padding: '13px 16px', backgroundColor: 'white', border: '1.5px solid #e2e8f0',
                  borderRadius: '12px', fontSize: '14px', fontWeight: '600', color: '#334155', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'all 0.2s', opacity: loading ? 0.7 : 1, fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t.googleSignIn}
              </button>
            </div>
          )}
          </>
          )}

          {/* Security badge */}
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>🔒 {t.secure}</p>
          </div>

          {/* Testimonial */}
          <TestimonialRotator lang={lang} />
        </div>
      </div>
    </div>
  );
}


function TestimonialRotator({ lang }) {
  const quotes = [
    { en: '“ChurchSmart changed how we manage our church.”', fr: '«ChurchSmart a transformé la gestion de notre église.»', author: 'Pastor, Douala' },
    { en: '“Finally, a tool built for African churches.”', fr: '«Enfin, un outil conçu pour les églises africaines.»', author: 'Church Admin, Yaoundé' },
    { en: '“Our giving tracking has never been easier.”', fr: '«Le suivi des offrandes n’a jamais été aussi facile.»', author: 'Finance Team, Abuja' },
  ];
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % quotes.length); setFade(true); }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  const q = quotes[idx];
  return (
    <div style={{ marginTop: '28px', textAlign: 'center', opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease', minHeight: '56px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', fontStyle: 'italic', color: '#64748b', lineHeight: '1.5' }}>{lang === 'fr' ? q.fr : q.en}</p>
      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>— {q.author}</p>
    </div>
  );
}

// ==========================================
// DASHBOARD (Main App after login)
// ==========================================

function Dashboard() {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const CHURCH_ID = user?.church_id;
  // If a plan was pre-selected from the landing page, go straight to billing
  const initialTab = (() => {
    if (typeof window !== 'undefined') {
      const sp = localStorage.getItem('selected_plan');
      if (sp && ['starter', 'growth', 'pro'].includes(sp)) return 'settings';
    }
    return 'dashboard';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  // The platform owner has no church of their own, so the whole church app —
  // including the "Set Up My Church" prompt — is replaced by the admin panel.
  // A super admin who DOES belong to a church keeps the normal church view and
  // reaches the panel through its sidebar item, as before.
  const isPlatformOwner = !!user?.is_super_admin || isHardcodedSuperAdmin(user?.email);
  const platformOnly = isPlatformOwner && !CHURCH_ID;
  const [superTab, setSuperTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [churchLogo, setChurchLogo] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchPlan, setChurchPlan] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('churchsmart_plan');
      if (cached && ['free', 'starter', 'growth', 'pro'].includes(cached)) return cached;
    }
    return 'free';
  });
  const [trialExpiredBanner, setTrialExpiredBanner] = useState(false);
  const [showChurchSetupModal, setShowChurchSetupModal] = useState(false);
  const openChurchSetup = () => setShowChurchSetupModal(true);

  // Fetch church branding and subscription plan
  useEffect(() => {
    const fetchBranding = async () => {
      if (!CHURCH_ID) return;
      const [ch, sub] = await Promise.all([
        supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }),
        supabaseQuery('subscriptions', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], single: true })
      ]);
      if (ch) {
        setChurchLogo(ch.logo_url || '');
        setChurchName(ch.name || '');
        // Check trial expiry
        if (ch.trial_end) {
          setTrialExpiredBanner(new Date(ch.trial_end) < new Date());
        } else if (ch.created_at) {
          // Fallback for churches created before trial_end column existed
          const created = new Date(ch.created_at);
          created.setDate(created.getDate() + 30);
          setTrialExpiredBanner(created < new Date());
        }
      }
      // churches.plan is the single source of truth, backfilled from the
      // legacy columns and kept current by the Stripe webhook. The
      // subscriptions row is still read above for billing-cycle display.
      const resolvedPlan = (ch?.plan || 'free').toLowerCase();
      setChurchPlan(resolvedPlan);
      try { localStorage.setItem('churchsmart_plan', resolvedPlan); } catch (e) {}
    };
    fetchBranding();
  }, [CHURCH_ID]);
  const { hasAccess } = usePermissions();

  // Features a sidebar item needs. Absent = available on every plan.
  // The item stays clickable when locked: the page itself renders
  // UpgradePrompt, which names the required plan and links to billing.
  const MENU_FEATURE = {
    visitors: 'visitors',
    groups: 'groups',
    volunteers: 'volunteers',
    messaging: 'messaging_email',
    reports: 'reports_basic'
  };

  // Map sidebar items to role access page keys (null = always visible)
  const allMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊', page: 'dashboard' },
    { id: 'members', label: t('members'), icon: '👥', page: 'members' },
    { id: 'visitors', label: t('visitors'), icon: '🚶', page: 'visitors' },
    { id: 'attendance', label: t('attendance'), icon: '📅', page: 'attendance' },
    { id: 'calendar', label: t('calendar'), icon: '🗓️', page: null },
    { id: 'giving', label: t('giving'), icon: '💰', page: 'giving' },
    { id: 'salvations', label: t('salvations'), icon: '❤️', page: 'salvations' },
    { id: 'groups', label: t('groups'), icon: '👨‍👩‍👧‍👦', page: 'groups' },
    { id: 'volunteers', label: 'Volunteers', icon: '🙋‍♂️', page: 'volunteers' },
    { id: 'messaging', label: 'Messaging', icon: '💬', page: 'messaging' },
    { id: 'reports', label: 'Reports', icon: '📊', page: 'reports' },
    { id: 'services', label: t('services'), icon: '⛪', page: 'events' },
    { id: 'settings', label: t('settings'), icon: '⚙️', page: 'settings' },
    // Sits under Settings and is admin-only: the log can expose who was
    // messaged, and whatsapp_send_log's RLS only grants admins SELECT anyway.
    ...((user?.role === 'ADMIN' || user?.is_super_admin) ? [{ id: 'whatsappLog', label: t('whatsappLog'), icon: '💬', page: 'settings' }] : []),
    // Shown for the church_users flag OR a hardcoded platform owner: an owner
    // whose church_users row has is_super_admin = false would otherwise be
    // granted access by the API but have no way to reach the panel.
    ...((user?.is_super_admin || isHardcodedSuperAdmin(user?.email)) ? [{ id: 'superadmin', label: '🛡️ Super Admin', icon: '🛡️', page: null }] : []),
  ];
  // Mirrors the panel's own tab ids so a sidebar click selects the tab.
  const platformMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: '🏠', page: null },
    { id: 'churches', label: t('sa_churches'), icon: '⛪', page: null },
    { id: 'payments', label: t('sa_payments'), icon: '💳', page: null },
    { id: 'comms', label: t('sa_communications'), icon: '📧', page: null },
    { id: 'log', label: t('activityLogs'), icon: '📋', page: null },
    { id: 'team', label: t('sa_team'), icon: '👥', page: null },
    { id: 'settings', label: t('settings'), icon: '⚙️', page: null }
  ];

  const menuItems = platformOnly ? platformMenuItems : allMenuItems
    .filter(item => hasAccess(item.page))
    .map(item => {
      const feature = MENU_FEATURE[item.id];
      const locked = !!feature && !canAccessFeature(churchPlan, feature);
      return locked
        ? { ...item, locked: true, lockedHint: `${t('upgrade_to_unlock').replace('{plan}', getRequiredPlan(feature))}` }
        : item;
    });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ width: sidebarOpen ? '260px' : '80px', backgroundColor: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', transition: 'all 0.3s', flexShrink: 0 }}>
        {/* Church identity header — vertical stack: logo on top, name below.
            When the church has uploaded a logo, theirs shows. Otherwise the
            ChurchSmart wordmark fills the slot as a placeholder until they
            upload. maxHeight on the container caps the visual footprint so
            portrait-style uploads can't blow up the sidebar. */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', maxHeight: '180px' }}>
          {churchLogo && !platformOnly ? (
            <img src={churchLogo} alt={churchName || 'Church'} style={{ height: sidebarOpen ? '80px' : '40px', maxWidth: sidebarOpen ? '180px' : '40px', width: 'auto', objectFit: 'contain' }} />
          ) : (
            <img src="/churchsmart-logo.svg" alt="ChurchSmart" style={{ height: sidebarOpen ? '60px' : '40px', width: 'auto' }} />
          )}
          {platformOnly && sidebarOpen && (
            <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.03em', backgroundColor: '#eef2ff', color: '#4338ca', whiteSpace: 'nowrap' }}>
              🛡️ {t('platform_admin')}
            </span>
          )}
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <button key={item.id} data-tab={item.id} title={item.locked ? item.lockedHint : undefined} onClick={() => { if (platformOnly) setSuperTab(item.id); else setActiveTab(item.id); if (window.innerWidth <= 768) setSidebarOpen(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: sidebarOpen ? '10px 16px' : '10px', margin: '2px 0', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', backgroundColor: (platformOnly ? superTab : activeTab) === item.id ? '#eef2ff' : 'transparent', color: (platformOnly ? superTab : activeTab) === item.id ? '#6366f1' : (item.locked ? '#9ca3af' : '#4b5563'), fontWeight: (platformOnly ? superTab : activeTab) === item.id ? '600' : '400', justifyContent: sidebarOpen ? 'flex-start' : 'center', transition: 'all 0.2s' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {sidebarOpen && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
              {/* Locked by plan. The item stays clickable; the page shows the
                  upgrade prompt naming the plan that unlocks it. */}
              {item.locked && <span style={{ fontSize: '12px', opacity: 0.75 }} aria-label={item.lockedHint}>🔒</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '14px', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            🚪 {sidebarOpen && t('signOut')}
          </button>
        </div>

        {/* "Powered by ChurchSmart" — only when sidebar is expanded; in collapsed
            mode the 80px-wide column is too tight for the footer text. The SaaS
            brand still appears prominently in the header h1 fallback case. */}
        {sidebarOpen && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', opacity: 0.7 }}>Powered by <span style={{ fontWeight: '600' }}>ChurchSmart</span></p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ height: '64px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>
              ☰
            </button>
            <div className="header-title">
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>{platformOnly ? t('platform_admin') : (churchName || 'ChurchSmart')}</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{user?.name || ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => changeLanguage(language === 'en' ? 'fr' : 'en')} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>
              {language === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'}
            </button>
            <span className="desktop-only" style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>🟢 Live</span>
            <button style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>🔔</button>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-page" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* Trial expired banner */}
          {/* Not for the platform owner: they have no church and no trial. */}
          {!platformOnly && churchPlan === 'free' && trialExpiredBanner && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#991b1b' }}>{t('trialEnded')} <strong>{t('upgradeToUse')}</strong></p>
              <button onClick={() => setActiveTab('settings')} style={{ padding: '8px 20px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('viewPlans')}</button>
            </div>
          )}
          {/* The platform owner has no church, so the church app is replaced
              wholesale rather than each tab falling through to a setup prompt. */}
          {platformOnly ? (
            <SuperAdminPage tab={superTab} onTabChange={setSuperTab} onNavigate={setActiveTab} />
          ) : (<>
          {activeTab === 'dashboard' && (CHURCH_ID ? <DashboardPage onNavigate={setActiveTab} /> : <DashboardWelcomeCard userName={user?.name} onOpenSetup={openChurchSetup} />)}
          {activeTab === 'members' && (CHURCH_ID ? <PermissionGate permission="members" fallback={<AccessDenied onNavigate={setActiveTab} />}><MembersPage plan={churchPlan} onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="members" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'visitors' && (CHURCH_ID ? (canAccessFeature(churchPlan, 'visitors') ? <PermissionGate permission="visitors" fallback={<AccessDenied onNavigate={setActiveTab} />}><VisitorsPage /></PermissionGate> : <UpgradePrompt feature="visitors" featureLabel={t('visitors')} onNavigate={setActiveTab} />) : <ChurchSetupRequired pageKey="visitors" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'attendance' && (CHURCH_ID ? <PermissionGate permission="attendance" fallback={<AccessDenied onNavigate={setActiveTab} />}><AttendancePage /></PermissionGate> : <ChurchSetupRequired pageKey="attendance" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'calendar' && (CHURCH_ID ? <CalendarPage /> : <ChurchSetupRequired pageKey="calendar" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'giving' && (CHURCH_ID ? <PermissionGate permission="giving" fallback={<AccessDenied onNavigate={setActiveTab} />}><GivingPage plan={churchPlan} onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="giving" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'salvations' && (CHURCH_ID ? <PermissionGate permission="salvations" fallback={<AccessDenied onNavigate={setActiveTab} />}><SalvationsPage /></PermissionGate> : <ChurchSetupRequired pageKey="salvations" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'groups' && (CHURCH_ID ? (canAccessFeature(churchPlan, 'groups') ? <PermissionGate permission="groups" fallback={<AccessDenied onNavigate={setActiveTab} />}><GroupsPage /></PermissionGate> : <UpgradePrompt feature="groups" featureLabel="Groups & Cell Management" onNavigate={setActiveTab} />) : <ChurchSetupRequired pageKey="groups" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'volunteers' && (CHURCH_ID ? (canAccessFeature(churchPlan, 'volunteers') ? <PermissionGate permission="volunteers" fallback={<AccessDenied onNavigate={setActiveTab} />}><VolunteersPage /></PermissionGate> : <UpgradePrompt feature="volunteers" featureLabel="Volunteer Management" onNavigate={setActiveTab} />) : <ChurchSetupRequired pageKey="volunteers" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'messaging' && (CHURCH_ID ? <PermissionGate permission="messaging" fallback={<AccessDenied onNavigate={setActiveTab} />}><MessagingPage plan={churchPlan} onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="messaging" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'reports' && (CHURCH_ID ? <PermissionGate permission="reports" fallback={<AccessDenied onNavigate={setActiveTab} />}><ReportsPage plan={churchPlan} onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="reports" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'services' && (CHURCH_ID ? <PermissionGate permission="events" fallback={<AccessDenied onNavigate={setActiveTab} />}><ServicesPage /></PermissionGate> : <ChurchSetupRequired pageKey="services" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'settings' && (CHURCH_ID ? <PermissionGate permission="settings" fallback={<AccessDenied onNavigate={setActiveTab} />}><SettingsPage plan={churchPlan} onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="settings" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'whatsappLog' && (CHURCH_ID ? <PermissionGate permission="settings" fallback={<AccessDenied onNavigate={setActiveTab} />}><WhatsAppLogPage onNavigate={setActiveTab} /></PermissionGate> : <ChurchSetupRequired pageKey="settings" onOpenSetup={openChurchSetup} />)}
          {activeTab === 'superadmin' && <SuperAdminPage onNavigate={setActiveTab} />}
          </>)}
        </main>
      </div>
      {showChurchSetupModal && user && !platformOnly && (
        <GoogleChurchSetup user={user} onClose={() => setShowChurchSetupModal(false)} />
      )}
    </div>
  );
}

