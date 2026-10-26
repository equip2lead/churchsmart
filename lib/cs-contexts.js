"use client";
// ChurchSmart React contexts — extracted from app/page.js
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { translations } from './translations';
import { supabase, isValidEmail, sanitizeObject, supabaseQuery, SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY } from './cs-shared';
import { isHardcodedSuperAdmin } from './superAdmin';

// ==========================================
// LANGUAGE CONTEXT
// ==========================================
const LanguageContext = createContext(null);

function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  
  useEffect(() => {
    const saved = localStorage.getItem('churchsmart_language');
    if (saved) setLanguage(saved);
  }, []);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('churchsmart_language', lang);
  };

  const t = (key) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

// ==========================================
// AUTH CONTEXT
// ==========================================
const AuthContext = createContext(null);
const PermissionsContext = createContext({ hasAccess: () => true, hasPermission: () => true, isAdmin: true, isFinanceVisible: true });

const ROLE_ACCESS = {
  ADMIN: ['dashboard', 'members', 'visitors', 'salvations', 'attendance', 'giving', 'events', 'groups', 'volunteers', 'prayer', 'messaging', 'reports', 'settings'],
  STAFF: ['dashboard', 'members', 'visitors', 'salvations', 'attendance', 'events', 'groups', 'prayer'],
  VOLUNTEER: ['dashboard', 'visitors', 'attendance', 'events', 'groups', 'prayer'],
};

// Legacy module keys (used by older PermissionGate call sites) → canonical page keys
const MODULE_TO_PAGE = {
  services: 'events',
};

function usePermissions() {
  return useContext(PermissionsContext);
}

function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;
  const rawRole = (user?.role || 'VOLUNTEER').toUpperCase();
  const role = ROLE_ACCESS[rawRole] ? rawRole : (rawRole === 'PASTOR' ? 'STAFF' : 'VOLUNTEER');
  const isAdmin = role === 'ADMIN' || isSuperAdmin;
  const isFinanceVisible = isAdmin;

  const hasAccess = (page) => {
    if (!page) return true;
    if (isSuperAdmin) return true;
    return ROLE_ACCESS[role]?.includes(page) || false;
  };

  const hasPermission = (moduleKey) => {
    if (!moduleKey) return true;
    const pageKey = MODULE_TO_PAGE[moduleKey] || moduleKey;
    return hasAccess(pageKey);
  };

  return (
    <PermissionsContext.Provider value={{ hasAccess, hasPermission, isAdmin, isFinanceVisible, isSuperAdmin, role }}>
      {children}
    </PermissionsContext.Provider>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const registeringRef = useRef(false);
  const loginAttempts = useRef({ count: 0, lastAttempt: 0, lockedUntil: 0 });

  // Load user profile from church_users given an auth email.
  // Also fetches and caches the church plan so features are unlocked
  // instantly on subsequent loads (even if Supabase auth hangs later).
  const loadUserProfile = async (authEmail) => {
    const { data: users } = await supabase
      .from('church_users')
      .select('*')
      .eq('email', authEmail.toLowerCase())
      .eq('is_active', true)
      .order('church_id', { nullsFirst: false })
      .limit(1);

    if (users && users.length > 0) {
      const dbUser = users[0];
      const sessionUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.full_name,
        role: dbUser.role,
        church_id: dbUser.church_id,
        phone: dbUser.phone,
        is_super_admin: dbUser.is_super_admin || false
      };

      // Cache the church plan so feature gating works immediately on
      // next page load, even if the churches query is slow or hangs.
      if (dbUser.church_id) {
        supabase.from('churches').select('plan').eq('id', dbUser.church_id).single()
          .then(({ data }) => {
            if (data?.plan) {
              try { localStorage.setItem('churchsmart_plan', data.plan.toLowerCase()); } catch (e) {}
            }
          }).catch(() => {});
      }

      // Fire and forget — don't block on last_login update
      supabase.from('church_users').update({ last_login: new Date().toISOString() }).eq('id', dbUser.id).then(() => {}).catch(() => {});

      setUser(sessionUser);
      localStorage.setItem('churchsmart_user', JSON.stringify(sessionUser));
      return sessionUser;
    }
    return null;
  };

  // Initialize: localStorage FIRST for instant load, Supabase session in background
  useEffect(() => {
    // Step 1: Instantly load from localStorage (no waiting)
    const savedUser = localStorage.getItem('churchsmart_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setLoading(false);
      } catch (e) {
        localStorage.removeItem('churchsmart_user');
      }
    }

    // Step 2: Verify/refresh Supabase session in background (non-blocking)
    // supabase.auth.getSession() can hang indefinitely when the internal auth
    // lock is held. Race it with a 3-second timeout so the dashboard still loads.
    const initSession = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000))
        ]);
        if (session?.user?.email) {
          // Session valid — refresh profile silently
          const profile = await loadUserProfile(session.user.email);
          if (!profile && !savedUser) {
            // No profile and no localStorage — show login
            setUser(null);
          }
        } else if (!savedUser) {
          // No Supabase session and no localStorage — show login
          setUser(null);
        }
      } catch (err) {
        console.warn('ChurchSmart: Background session check failed:', err);
        // If localStorage had a user, keep it; otherwise show login
        if (!savedUser) setUser(null);
      }
      setLoading(false);
      // Clean up OAuth hash fragment from URL
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    // If no saved user, we must wait for Supabase (with a safety timeout)
    if (!savedUser) {
      const safetyTimer = setTimeout(() => { setLoading(false); }, 3000);
      initSession().finally(() => clearTimeout(safetyTimer));
    } else {
      // User loaded from localStorage — run Supabase check in background silently
      initSession();
    }

    // Listen for auth state changes (login/logout, OAuth callbacks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setUser(null);
        localStorage.removeItem('churchsmart_user');
        if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + '?reset=true');
        return;
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('churchsmart_user');
        return;
      }
      // Load profile on sign-in or initial session (OAuth redirect fires INITIAL_SESSION in Supabase v2)
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.email) {
        if (passwordRecovery || registeringRef.current) return;
        try {
          let profile = await loadUserProfile(session.user.email);
          if (!profile) {
            // Before creating a new row, check if one already exists (case-insensitive, including inactive)
            const { data: existingRows } = await supabase
              .from('church_users')
              .select('*')
              .ilike('email', session.user.email)
              .order('church_id', { nullsFirst: false })
              .limit(1);

            if (existingRows && existingRows.length > 0) {
              // Row exists — reactivate and update auth_id, then reload profile
              const existing = existingRows[0];
              await supabase.from('church_users')
                .update({ is_active: true, auth_id: session.user.id })
                .eq('id', existing.id);
              profile = await loadUserProfile(session.user.email);
            } else {
              // Truly new Google user — create a minimal church_users row
              const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0];
              const { data: newRow } = await supabase
                .from('church_users')
                .insert({
                  auth_id: session.user.id,
                  email: session.user.email,
                  full_name: fullName,
                  role: 'ADMIN',
                  is_active: true
                })
                .select()
                .single();

              if (newRow) {
                const sessionUser = {
                  id: newRow.id, email: newRow.email, name: newRow.full_name,
                  role: newRow.role, church_id: null, phone: null, is_super_admin: false
                };
                setUser(sessionUser);
                localStorage.setItem('churchsmart_user', JSON.stringify(sessionUser));
              }
            }
          }
        } catch (err) {
          console.warn('ChurchSmart: Auth state change error:', err);
        }
        // Clean OAuth hash fragment
        if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      // Rate limiting
      const now = Date.now();
      const attempts = loginAttempts.current;
      if (attempts.lockedUntil > now) {
        const waitSec = Math.ceil((attempts.lockedUntil - now) / 1000);
        return { success: false, error: `Too many attempts. Try again in ${waitSec}s` };
      }

      // Validate inputs
      if (!email || !password) return { success: false, error: 'Email and password are required' };
      if (!isValidEmail(email)) return { success: false, error: 'Invalid email format' };

      // Try Supabase Auth first
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (authError) {
        attempts.count++;
        attempts.lastAttempt = Date.now();
        if (attempts.count >= 5) { attempts.lockedUntil = Date.now() + 60000; attempts.count = 0; }
        return { success: false, error: 'Invalid email or password' };
      }

      // Supabase Auth succeeded — load profile
      attempts.count = 0; attempts.lockedUntil = 0;
      const profile = await loadUserProfile(authData.user.email);
      if (!profile) {
        return { success: false, error: 'Account found but no church profile. Contact your administrator.' };
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [editingChurch, setEditingChurch] = useState(false);
  const [churchForm, setChurchForm] = useState({});
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current: '', new_password: '', confirm: '' });
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const register = async (userData) => {
    registeringRef.current = true;
    try {
      // 1. Create the church
      const slug = userData.church_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      const { data: newChurch, error: churchError } = await supabase
        .from('churches')
        .insert({
          name: userData.church_name,
          slug: slug,
          city: userData.church_city || null,
          denomination: userData.church_denomination || null,
          pastor_name: userData.church_pastor || null,
          phone: userData.church_phone || null,
          email: userData.church_email || null,
          currency: userData.church_currency || 'XAF',
          trial_end: trialEnd.toISOString()
        })
        .select()
        .single();

      if (churchError || !newChurch?.id) {
        console.error('Church creation failed:', churchError);
        registeringRef.current = false;
        return { success: false, error: 'Failed to create church. Please try again.' };
      }

      // 2. Check if user already exists in auth (OTP flow) or needs signUp
      const { data: { session } } = await supabase.auth.getSession();
      let authUserId = session?.user?.id || null;

      if (!authUserId) {
        // No active session — try signUp (legacy email flow)
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email.trim().toLowerCase(),
            password: userData.password,
            options: { data: { full_name: userData.full_name, church_id: newChurch.id } }
          });
          if (!authError && authData?.user?.id) {
            authUserId = authData.user.id;
          } else if (authError?.message?.includes('already registered')) {
            await supabase.from('churches').delete().eq('id', newChurch.id);
            registeringRef.current = false;
            return { success: false, error: 'This email is already registered' };
          }
        } catch (authErr) {
          console.warn('Auth signup failed:', authErr);
        }
      }

      // 3. Check if church_users row exists (trigger or OTP may have created one)
      const { data: existingUser } = await supabase
        .from('church_users')
        .select('id')
        .eq('email', userData.email.trim().toLowerCase())
        .limit(1)
        .single();

      if (existingUser) {
        // Update existing row with church info
        const { error: updateError } = await supabase
          .from('church_users')
          .update({
            church_id: newChurch.id,
            full_name: userData.full_name,
            phone: userData.phone || null,
            role: 'ADMIN',
            is_active: true,
            auth_id: authUserId
          })
          .eq('id', existingUser.id);

        if (updateError) {
          await supabase.from('churches').delete().eq('id', newChurch.id);
          registeringRef.current = false;
          return { success: false, error: 'Failed to complete registration.' };
        }
      } else {
        // Insert new row
        const insertData = {
          church_id: newChurch.id,
          email: userData.email.trim().toLowerCase(),
          full_name: userData.full_name,
          phone: userData.phone || null,
          role: 'ADMIN',
          is_active: true
        };
        if (authUserId) insertData.auth_id = authUserId;
        if (!authUserId) insertData.password_hash = userData.password;

        const { error: userError } = await supabase
          .from('church_users')
          .insert(insertData);

        if (userError) {
          await supabase.from('churches').delete().eq('id', newChurch.id);
          registeringRef.current = false;
          return { success: false, error: 'Database error saving new user' };
        }
      }

      // Send welcome email (fire-and-forget — don't block registration)
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email, churchName: userData.church_name, adminName: userData.full_name })
      }).then(() => supabase.from('churches').update({ welcome_email_sent: true }).eq('id', newChurch.id)).catch(() => {});

      registeringRef.current = false;
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      registeringRef.current = false;
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const forgotPassword = async (email) => {
    try {
      if (!email || !isValidEmail(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'https://app.churchsmartnow.com'
      });
      // Always return success — don't reveal whether the email exists (security best practice)
      if (error) console.warn('Password reset error (hidden from user):', error.message);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to send reset email. Please try again.' };
    }
  };

  const logout = async () => {
    // Clear local state FIRST
    localStorage.removeItem('churchsmart_user');
    localStorage.removeItem('churchsmart_plan');
    setUser(null);
    setPasswordRecovery(false);
    // Must await signOut to clear the Supabase session cookie, otherwise
    // the page reload will find a valid session and log back in
    try { await Promise.race([supabase.auth.signOut(), new Promise((_, rej) => setTimeout(() => rej('timeout'), 3000))]); } catch (e) { /* timeout or error — continue anyway */ }
    // Force clean reload
    window.location.href = window.location.origin;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, forgotPassword, passwordRecovery, setPasswordRecovery, loading, loadUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}


// ==========================================
// MAIN APP COMPONENT
// ==========================================
// ==========================================
// COOKIE CONSENT BANNER + GOOGLE ANALYTICS
// ==========================================
// ==========================================
// NETWORK STATUS + SERVICE WORKER
// ==========================================

// Add toast animation style
if (typeof document !== 'undefined' && !document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = '@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
  document.head.appendChild(style);
}


// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
const ToastContext = createContext();
function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };
  
  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning', 4000),
  };
  
  return React.createElement(ToastContext.Provider, { value: toast },
    children,
    React.createElement('div', {
      style: { position: 'fixed', top: '20px', right: '20px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }
    }, toasts.map(t => React.createElement('div', {
      key: t.id,
      style: {
        padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', pointerEvents: 'auto', minWidth: '250px', maxWidth: '400px',
        animation: 'slideIn 0.3s ease-out',
        backgroundColor: t.type === 'success' ? '#dcfce7' : t.type === 'error' ? '#fef2f2' : t.type === 'warning' ? '#fef3c7' : '#dbeafe',
        color: t.type === 'success' ? '#166534' : t.type === 'error' ? '#991b1b' : t.type === 'warning' ? '#92400e' : '#1e40af',
        border: `1px solid ${t.type === 'success' ? '#bbf7d0' : t.type === 'error' ? '#fecaca' : t.type === 'warning' ? '#fde68a' : '#bfdbfe'}`,
        display: 'flex', alignItems: 'center', gap: '8px'
      }
    },
      t.type === 'success' ? '✅ ' : t.type === 'error' ? '❌ ' : t.type === 'warning' ? '⚠️ ' : 'ℹ️ ',
      t.message
    )))
  );
}




// ==========================================
// MEMBER PROFILE VIEW


export { LanguageContext, LanguageProvider, useLanguage };
export { AuthContext, AuthProvider, useAuth };
export { PermissionsContext, PermissionsProvider, usePermissions, ROLE_ACCESS, MODULE_TO_PAGE };
export { ToastContext, ToastProvider, useToast };
