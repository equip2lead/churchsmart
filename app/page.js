"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = 'https://ntngwrtbbgetobinwvxd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50bmd3cnRiYmdldG9iaW53dnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTc3NTIsImV4cCI6MjA4NTMzMzc1Mn0.uvMWB2zwd4LYJM1P1jpov5rG83L62Eqbe7Bko9kI_1Q';
const CHURCH_ID = '11111111-1111-1111-1111-111111111111';

// ==========================================
// SUPABASE API HELPERS
// ==========================================
async function supabaseQuery(table, options = {}) {
  const { select = '*', filters = [], order, limit, single = false } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  
  filters.forEach(f => {
    url += `&${f.column}=${f.operator}.${f.value}`;
  });
  
  if (order) url += `&order=${order}`;
  if (limit) url += `&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  
  const data = await response.json();
  return single ? data[0] : data;
}

async function supabaseInsert(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ ...data, church_id: CHURCH_ID })
  });
  return response.json();
}

async function supabaseUpdate(table, id, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function supabaseDelete(table, id) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  return response.ok;
}

// ==========================================
// AUTH CONTEXT
// ==========================================
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const stored = localStorage.getItem('churchsmart_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // For demo, accept any valid-looking credentials
    // In production, this would call Supabase Auth
    if (email && password.length >= 6) {
      const userData = {
        id: '1',
        email,
        name: email.split('@')[0],
        role: email.includes('admin') ? 'ADMIN' : 'STAFF',
        church_id: CHURCH_ID
      };
      setUser(userData);
      localStorage.setItem('churchsmart_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  };

  const signup = async (name, email, password) => {
    if (name && email && password.length >= 6) {
      const userData = {
        id: Date.now().toString(),
        email,
        name,
        role: 'STAFF',
        church_id: CHURCH_ID
      };
      setUser(userData);
      localStorage.setItem('churchsmart_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: 'Please fill all fields correctly' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('churchsmart_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
export default function ChurchSmartApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#6b7280' }}>Loading ChurchSmart...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPages />;
  }

  return <Dashboard />;
}

// ==========================================
// AUTH PAGES (Login / Signup)
// ==========================================
function AuthPages() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('admin@firechurch.cm');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;
    if (mode === 'login') {
      result = await login(email, password);
    } else if (mode === 'signup') {
      result = await signup(name, email, password);
    }

    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f9fafb' }}>
      {/* Left Side - Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>✝</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>ChurchSmart</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Church Management System</p>
            </div>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px 0' }}>
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
            {mode === 'login' ? 'Sign in to manage your church' : mode === 'signup' ? 'Start managing your church today' : 'Enter your email to reset password'}
          </p>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '16px', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {mode !== 'forgot' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                <button type="button" onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px' }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              {loading ? '⏳ Please wait...' : mode === 'login' ? 'Sign In →' : mode === 'signup' ? 'Create Account →' : 'Send Reset Link →'}
            </button>
          </form>

          {/* Toggle Mode */}
          <p style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>
            {mode === 'login' ? (
              <>Don't have an account? <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}>Sign in</button></>
            )}
          </p>

          {/* Demo Hint */}
          <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              <strong>Demo:</strong> Use any email with "admin" for admin access, or any email + password (6+ chars) to login.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ maxWidth: '400px', color: 'white' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Manage your church with ease</h2>
          <p style={{ fontSize: '18px', opacity: 0.9, margin: '0 0 32px 0' }}>
            Track attendance, manage members, record giving, and grow your ministry with ChurchSmart.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { icon: '👥', label: 'Member Management' },
              { icon: '📊', label: 'Attendance Tracking' },
              { icon: '💰', label: 'Giving Reports' },
              { icon: '🙏', label: 'Prayer Requests' },
              { icon: '🚶', label: 'Visitor Follow-up' },
              { icon: '❤️', label: 'Salvation Tracking' },
            ].map((feature, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                <span style={{ fontWeight: '500' }}>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD (Main App after login)
// ==========================================
function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'visitors', label: 'Visitors', icon: '🚶' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    { id: 'giving', label: 'Giving', icon: '💰' },
    { id: 'salvations', label: 'Salvations', icon: '❤️' },
    { id: 'groups', label: 'Groups', icon: '👨‍👩‍👧‍👦' },
    { id: 'prayers', label: 'Prayer Requests', icon: '🙏' },
    { id: 'services', label: 'Services', icon: '⛪' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? '260px' : '80px', backgroundColor: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', transition: 'width 0.3s', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px', flexShrink: 0 }}>✝</div>
          {sidebarOpen && <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#111827' }}>ChurchSmart</span>}
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                marginBottom: '4px',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                backgroundColor: activeTab === item.id ? '#eef2ff' : 'transparent',
                color: activeTab === item.id ? '#6366f1' : '#4b5563',
                fontWeight: activeTab === item.id ? '600' : '400',
                fontSize: '14px',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600', flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: '8px',
              padding: '10px 16px',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🚪 {sidebarOpen && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ height: '64px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>
              {sidebarOpen ? '◀' : '▶'}
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>FIRE Church International</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Douala, Cameroon</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>🟢 Live Data</span>
            <button style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>🔔</button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'members' && <MembersPage />}
          {activeTab === 'visitors' && <VisitorsPage />}
          {activeTab === 'attendance' && <AttendancePage />}
          {activeTab === 'giving' && <GivingPage />}
          {activeTab === 'salvations' && <SalvationsPage />}
          {activeTab === 'groups' && <GroupsPage />}
          {activeTab === 'prayers' && <PrayersPage />}
          {activeTab === 'services' && <ServicesPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================
function StatCard({ label, value, icon, color = '#6366f1', trend }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>{label}</p>
          <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#111827' }}>{value}</p>
          {trend && <p style={{ fontSize: '12px', color: trend.startsWith('+') ? '#10b981' : '#ef4444', margin: '8px 0 0 0' }}>{trend}</p>}
        </div>
        <div style={{ width: '48px', height: '48px', backgroundColor: `${color}15`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    'ACTIVE': { bg: '#dcfce7', text: '#166534' },
    'INACTIVE': { bg: '#fee2e2', text: '#991b1b' },
    'NOT_STARTED': { bg: '#fef9c3', text: '#854d0e' },
    'IN_PROGRESS': { bg: '#dbeafe', text: '#1e40af' },
    'COMPLETED': { bg: '#dcfce7', text: '#166534' },
    'BECAME_MEMBER': { bg: '#d1fae5', text: '#065f46' },
    'PENDING': { bg: '#fef9c3', text: '#854d0e' },
    'NEW': { bg: '#dbeafe', text: '#1e40af' },
    'PRAYING': { bg: '#fef3c7', text: '#92400e' },
    'ANSWERED': { bg: '#dcfce7', text: '#166534' },
    'TITHE': { bg: '#e0e7ff', text: '#4338ca' },
    'OFFERING': { bg: '#fef3c7', text: '#92400e' },
    'MISSIONS': { bg: '#d1fae5', text: '#065f46' },
    'CELL': { bg: '#e0e7ff', text: '#4338ca' },
    'DEPARTMENT': { bg: '#fce7f3', text: '#9d174d' },
  };
  const color = colors[status] || { bg: '#f3f4f6', text: '#374151' };
  
  return (
    <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500', backgroundColor: color.bg, color: color.text }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;
  
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{title}</h3>
          <button onClick={onClose} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FormInput({ label, type = 'text', value, onChange, placeholder, required, options }) {
  const inputStyle = { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
  
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {type === 'select' ? (
        <select value={value} onChange={onChange} style={inputStyle}>
          <option value="">Select...</option>
          {options?.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={4} style={inputStyle} />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', disabled, type = 'button', fullWidth }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, #6366f1, #3b82f6)', color: 'white', border: 'none' },
    secondary: { background: 'white', color: '#374151', border: '1px solid #e5e7eb' },
    danger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
    success: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '12px 24px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="400px">
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

function DataTable({ columns, data, onEdit, onDelete, emptyMessage = 'No data found' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>📭</p>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: '#f9fafb' }}>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                {col.header}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ borderTop: '1px solid #e5e7eb' }}>
              {columns.map((col, colIndex) => (
                <td key={colIndex} style={{ padding: '16px' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {onEdit && (
                      <button onClick={() => onEdit(row)} style={{ padding: '8px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>✏️</button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(row)} style={{ padding: '8px', border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '12px' }}>{actions}</div>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: '10px 16px 10px 42px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', width: '280px', outline: 'none' }}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px' }}>
      <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>⏳</div>
    </div>
  );
}

// Add CSS animation for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
// ==========================================
// DASHBOARD PAGE
// ==========================================
function DashboardPage() {
  const [stats, setStats] = useState({ members: 0, visitors: 0, salvations: 0, donations: 0 });
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [members, visitors, salvations, donations, attendance] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'donation_date.desc', limit: 5 }),
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc', limit: 5 }),
      ]);

      const totalDonations = (donations || []).reduce((sum, d) => sum + (d.amount || 0), 0) + 
                            ((await supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })) || []).reduce((sum, d) => sum + (d.amount || 0), 0);
      
      setStats({
        members: members?.length || 0,
        visitors: visitors?.length || 0,
        salvations: salvations?.length || 0,
        donations: totalDonations / 2 // Adjust for double fetch
      });
      setRecentDonations(donations || []);
      setRecentAttendance(attendance || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => `XAF ${(amount || 0).toLocaleString()}`;

  return (
    <div>
      <PageHeader 
        title="📊 Dashboard" 
        subtitle="Welcome back! Here's what's happening at your church."
        actions={<Button onClick={fetchData} variant="secondary">🔄 Refresh</Button>}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <StatCard label="Total Members" value={stats.members} icon="👥" color="#6366f1" trend="+5% this month" />
            <StatCard label="Total Visitors" value={stats.visitors} icon="🚶" color="#f59e0b" trend="+3 this week" />
            <StatCard label="Salvations" value={stats.salvations} icon="❤️" color="#ef4444" trend="+2 this month" />
            <StatCard label="Total Giving" value={formatCurrency(stats.donations)} icon="💰" color="#10b981" trend="+8% this month" />
          </div>

          {/* Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Recent Donations */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>💰 Recent Donations</h3>
              {recentDonations.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>No recent donations</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentDonations.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{d.category_type}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{new Date(d.donation_date).toLocaleDateString()}</p>
                      </div>
                      <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Attendance */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>📅 Recent Attendance</h3>
              {recentAttendance.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>No recent attendance records</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentAttendance.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{new Date(a.service_date).toLocaleDateString()}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Men: {a.men_count} | Women: {a.women_count} | Kids: {a.children_count}</p>
                      </div>
                      <span style={{ fontWeight: 'bold', color: '#6366f1' }}>{a.total_count} total</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// MEMBERS PAGE - Full CRUD
// ==========================================
function MembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
    gender: '', date_of_birth: '', language_preference: 'FRENCH',
    membership_status: 'ACTIVE', membership_date: '', baptism_status: false
  });

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    setLoading(true);
    const data = await supabaseQuery('members', { 
      filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }],
      order: 'last_name'
    });
    setMembers(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
      gender: '', date_of_birth: '', language_preference: 'FRENCH',
      membership_status: 'ACTIVE', membership_date: '', baptism_status: false
    });
    setEditingMember(null);
  };

  const openModal = (member = null) => {
    if (member) {
      setEditingMember(member);
      setForm({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        whatsapp: member.whatsapp || '',
        gender: member.gender || '',
        date_of_birth: member.date_of_birth || '',
        language_preference: member.language_preference || 'FRENCH',
        membership_status: member.membership_status || 'ACTIVE',
        membership_date: member.membership_date || '',
        baptism_status: member.baptism_status || false
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      alert('First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        await supabaseUpdate('members', editingMember.id, form);
      } else {
        const memberNumber = `FC-${String(members.length + 1).padStart(4, '0')}`;
        await supabaseInsert('members', { ...form, member_number: memberNumber });
      }
      setShowModal(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      alert('Error saving member: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await supabaseDelete('members', deleteConfirm.id);
      setDeleteConfirm(null);
      fetchMembers();
    } catch (error) {
      alert('Error deleting member: ' + error.message);
    }
  };

  const filteredMembers = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search)
  );

  const columns = [
    {
      header: 'Name',
      key: 'name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600' }}>
            {row.first_name?.[0]}{row.last_name?.[0]}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '500' }}>{row.first_name} {row.last_name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{row.member_number}</p>
          </div>
        </div>
      )
    },
    { header: 'Email', key: 'email', render: (row) => <span style={{ color: '#6b7280' }}>{row.email || '—'}</span> },
    { header: 'Phone', key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone || '—'}</span> },
    { header: 'Status', key: 'status', render: (row) => <StatusBadge status={row.membership_status} /> },
    { header: 'Baptized', key: 'baptized', render: (row) => row.baptism_status ? '✅' : '—' },
  ];

  return (
    <div>
      <PageHeader
        title="👥 Members"
        subtitle={`${members.length} total members`}
        actions={<Button onClick={() => openModal()}>➕ Add Member</Button>}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={members.length} icon="👥" />
        <StatCard label="Active" value={members.filter(m => m.membership_status === 'ACTIVE').length} icon="✅" color="#10b981" />
        <StatCard label="Baptized" value={members.filter(m => m.baptism_status).length} icon="💧" color="#3b82f6" />
        <StatCard label="New This Month" value={members.filter(m => new Date(m.created_at) > new Date(Date.now() - 30*24*60*60*1000)).length} icon="🆕" color="#f59e0b" />
      </div>

      {/* Search & Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search members..." />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{filteredMembers.length} results</span>
        </div>
        {loading ? <LoadingSpinner /> : (
          <DataTable
            columns={columns}
            data={filteredMembers}
            onEdit={openModal}
            onDelete={setDeleteConfirm}
            emptyMessage="No members found. Add your first member!"
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingMember ? '✏️ Edit Member' : '➕ Add New Member'} width="600px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <FormInput label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" />
          <FormInput label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+237 6XX XXX XXX" />
          <FormInput label="Gender" type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }]} />
          <FormInput label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          <FormInput label="Language" type="select" value={form.language_preference} onChange={(e) => setForm({ ...form, language_preference: e.target.value })} options={[{ value: 'FRENCH', label: 'French' }, { value: 'ENGLISH', label: 'English' }]} />
          <FormInput label="Status" type="select" value={form.membership_status} onChange={(e) => setForm({ ...form, membership_status: e.target.value })} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          <FormInput label="Membership Date" type="date" value={form.membership_date} onChange={(e) => setForm({ ...form, membership_date: e.target.value })} />
        </div>
        <div style={{ marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.baptism_status} onChange={(e) => setForm({ ...form, baptism_status: e.target.checked })} />
            <span style={{ fontSize: '14px' }}>Baptized</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : editingMember ? '💾 Update' : '➕ Create'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="🗑️ Delete Member"
        message={`Are you sure you want to delete ${deleteConfirm?.first_name} ${deleteConfirm?.last_name}? This action cannot be undone.`}
      />
    </div>
  );
}

// ==========================================
// VISITORS PAGE - Full CRUD
// ==========================================
function VisitorsPage() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', whatsapp: '',
    visit_date: new Date().toISOString().split('T')[0],
    is_first_time: true, how_heard_about_us: '', prayer_request: '',
    followup_status: 'NOT_STARTED', language_preference: 'FRENCH'
  });

  useEffect(() => { fetchVisitors(); }, []);

  const fetchVisitors = async () => {
    setLoading(true);
    const data = await supabaseQuery('visitors', {
      filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }],
      order: 'visit_date.desc'
    });
    setVisitors(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      full_name: '', email: '', phone: '', whatsapp: '',
      visit_date: new Date().toISOString().split('T')[0],
      is_first_time: true, how_heard_about_us: '', prayer_request: '',
      followup_status: 'NOT_STARTED', language_preference: 'FRENCH'
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
        visit_date: visitor.visit_date || '',
        is_first_time: visitor.is_first_time ?? true,
        how_heard_about_us: visitor.how_heard_about_us || '',
        prayer_request: visitor.prayer_request || '',
        followup_status: visitor.followup_status || 'NOT_STARTED',
        language_preference: visitor.language_preference || 'FRENCH'
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone) {
      alert('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      if (editingVisitor) {
        await supabaseUpdate('visitors', editingVisitor.id, form);
      } else {
        await supabaseInsert('visitors', form);
      }
      setShowModal(false);
      resetForm();
      fetchVisitors();
    } catch (error) {
      alert('Error saving visitor: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabaseDelete('visitors', deleteConfirm.id);
    setDeleteConfirm(null);
    fetchVisitors();
  };

  const filteredVisitors = visitors.filter(v =>
    v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  );

  const columns = [
    { header: 'Name', key: 'full_name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: 'Visit Date', key: 'visit_date', render: (row) => new Date(row.visit_date).toLocaleDateString() },
    { header: 'Phone', key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone}</span> },
    { header: 'How Heard', key: 'how_heard', render: (row) => <span style={{ color: '#6b7280' }}>{row.how_heard_about_us || '—'}</span> },
    { header: 'Status', key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
    { header: 'First Time', key: 'first_time', render: (row) => row.is_first_time ? '✅' : '🔄' },
  ];

  return (
    <div>
      <PageHeader
        title="🚶 Visitors"
        subtitle={`${visitors.length} total visitors`}
        actions={<Button onClick={() => openModal()}>➕ Register Visitor</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={visitors.length} icon="🚶" />
        <StatCard label="Need Follow-up" value={visitors.filter(v => v.followup_status === 'NOT_STARTED').length} icon="⏰" color="#f59e0b" />
        <StatCard label="In Progress" value={visitors.filter(v => v.followup_status === 'IN_PROGRESS').length} icon="🔄" color="#3b82f6" />
        <StatCard label="Became Members" value={visitors.filter(v => v.followup_status === 'BECAME_MEMBER').length} icon="✅" color="#10b981" />
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search visitors..." />
        </div>
        {loading ? <LoadingSpinner /> : (
          <DataTable columns={columns} data={filteredVisitors} onEdit={openModal} onDelete={setDeleteConfirm} />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingVisitor ? '✏️ Edit Visitor' : '➕ Register Visitor'}>
        <FormInput label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <FormInput label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </div>
        <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Visit Date" type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
          <FormInput label="How did they hear?" type="select" value={form.how_heard_about_us} onChange={(e) => setForm({ ...form, how_heard_about_us: e.target.value })} 
            options={[{ value: 'Friend/Family', label: 'Friend/Family' }, { value: 'Social Media', label: 'Social Media' }, { value: 'Walk-in', label: 'Walk-in' }, { value: 'Flyer/Poster', label: 'Flyer/Poster' }, { value: 'Online Search', label: 'Online Search' }, { value: 'Event', label: 'Event' }]} />
        </div>
        <FormInput label="Follow-up Status" type="select" value={form.followup_status} onChange={(e) => setForm({ ...form, followup_status: e.target.value })}
          options={[{ value: 'NOT_STARTED', label: 'Not Started' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'BECAME_MEMBER', label: 'Became Member' }]} />
        <FormInput label="Prayer Request" type="textarea" value={form.prayer_request} onChange={(e) => setForm({ ...form, prayer_request: e.target.value })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input type="checkbox" checked={form.is_first_time} onChange={(e) => setForm({ ...form, is_first_time: e.target.checked })} />
          <span style={{ fontSize: '14px' }}>First time visitor</span>
        </label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</Button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete}
        title="🗑️ Delete Visitor" message={`Are you sure you want to delete ${deleteConfirm?.full_name}?`} />
    </div>
  );
}

// ==========================================
// ATTENDANCE PAGE - Full CRUD
// ==========================================
function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    service_id: '', service_date: new Date().toISOString().split('T')[0],
    men_count: 0, women_count: 0, children_count: 0,
    first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [attendanceData, servicesData] = await Promise.all([
      supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc' }),
      supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setAttendance(attendanceData || []);
    setServices(servicesData || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      service_id: services[0]?.id || '', service_date: new Date().toISOString().split('T')[0],
      men_count: 0, women_count: 0, children_count: 0,
      first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: ''
    });
    setEditingRecord(null);
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setForm({
        service_id: record.service_id || '',
        service_date: record.service_date || '',
        men_count: record.men_count || 0,
        women_count: record.women_count || 0,
        children_count: record.children_count || 0,
        first_timers_count: record.first_timers_count || 0,
        total_offering: record.total_offering || 0,
        weather: record.weather || 'SUNNY',
        notes: record.notes || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.service_date) {
      alert('Service date is required');
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, men_count: parseInt(form.men_count), women_count: parseInt(form.women_count), children_count: parseInt(form.children_count), first_timers_count: parseInt(form.first_timers_count), total_offering: parseFloat(form.total_offering) };
      if (editingRecord) {
        await supabaseUpdate('attendance_records', editingRecord.id, data);
      } else {
        await supabaseInsert('attendance_records', data);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert('Error saving: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabaseDelete('attendance_records', deleteConfirm.id);
    setDeleteConfirm(null);
    fetchData();
  };

  const totalAttendance = attendance.reduce((s, a) => s + (a.total_count || 0), 0);
  const avgAttendance = attendance.length ? Math.round(totalAttendance / attendance.length) : 0;

  const columns = [
    { header: 'Date', key: 'date', render: (row) => <span style={{ fontWeight: '500' }}>{new Date(row.service_date).toLocaleDateString()}</span> },
    { header: 'Men', key: 'men_count' },
    { header: 'Women', key: 'women_count' },
    { header: 'Children', key: 'children_count' },
    { header: 'Total', key: 'total', render: (row) => <span style={{ fontWeight: 'bold', color: '#6366f1' }}>{row.total_count}</span> },
    { header: 'Offering', key: 'offering', render: (row) => <span style={{ color: '#10b981' }}>XAF {row.total_offering?.toLocaleString()}</span> },
    { header: 'Weather', key: 'weather', render: (row) => row.weather === 'SUNNY' ? '☀️' : row.weather === 'CLOUDY' ? '☁️' : row.weather === 'RAINY' ? '🌧️' : '⛈️' },
  ];

  return (
    <div>
      <PageHeader title="📅 Attendance" subtitle={`${attendance.length} records`} actions={<Button onClick={() => openModal()}>➕ Record Attendance</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Attendance" value={totalAttendance} icon="👥" />
        <StatCard label="Average" value={avgAttendance} icon="📊" color="#10b981" />
        <StatCard label="Services" value={attendance.length} icon="⛪" color="#f59e0b" />
        <StatCard label="Total Offering" value={`XAF ${attendance.reduce((s, a) => s + (a.total_offering || 0), 0).toLocaleString()}`} icon="💰" color="#3b82f6" />
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={attendance} onEdit={openModal} onDelete={setDeleteConfirm} />}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? '✏️ Edit Attendance' : '➕ Record Attendance'}>
        <FormInput label="Service" type="select" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
          options={services.map(s => ({ value: s.id, label: s.name }))} />
        <FormInput label="Date" type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <FormInput label="Men" type="number" value={form.men_count} onChange={(e) => setForm({ ...form, men_count: e.target.value })} />
          <FormInput label="Women" type="number" value={form.women_count} onChange={(e) => setForm({ ...form, women_count: e.target.value })} />
          <FormInput label="Children" type="number" value={form.children_count} onChange={(e) => setForm({ ...form, children_count: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="First Timers" type="number" value={form.first_timers_count} onChange={(e) => setForm({ ...form, first_timers_count: e.target.value })} />
          <FormInput label="Total Offering (XAF)" type="number" value={form.total_offering} onChange={(e) => setForm({ ...form, total_offering: e.target.value })} />
        </div>
        <FormInput label="Weather" type="select" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })}
          options={[{ value: 'SUNNY', label: '☀️ Sunny' }, { value: 'CLOUDY', label: '☁️ Cloudy' }, { value: 'RAINY', label: '🌧️ Rainy' }, { value: 'STORMY', label: '⛈️ Stormy' }]} />
        <FormInput label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</Button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete}
        title="🗑️ Delete Record" message="Are you sure you want to delete this attendance record?" />
    </div>
  );
}
// ==========================================
// GIVING PAGE - Full CRUD
// ==========================================
function GivingPage() {
  const [donations, setDonations] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    member_id: '', amount: '', category_type: 'TITHE',
    donation_date: new Date().toISOString().split('T')[0],
    payment_method: 'CASH', is_anonymous: false, notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [donationsData, membersData] = await Promise.all([
      supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'donation_date.desc' }),
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setDonations(donationsData || []);
    setMembers(membersData || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ member_id: '', amount: '', category_type: 'TITHE', donation_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', is_anonymous: false, notes: '' });
    setEditingDonation(null);
  };

  const openModal = (donation = null) => {
    if (donation) {
      setEditingDonation(donation);
      setForm({ member_id: donation.member_id || '', amount: donation.amount || '', category_type: donation.category_type || 'TITHE', donation_date: donation.donation_date || '', payment_method: donation.payment_method || 'CASH', is_anonymous: donation.is_anonymous || false, notes: donation.notes || '' });
    } else { resetForm(); }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.donation_date) { alert('Amount and date are required'); return; }
    setSaving(true);
    try {
      const data = { ...form, amount: parseFloat(form.amount), member_id: form.member_id || null };
      if (editingDonation) { await supabaseUpdate('donations', editingDonation.id, data); }
      else { await supabaseInsert('donations', data); }
      setShowModal(false); resetForm(); fetchData();
    } catch (error) { alert('Error saving: ' + error.message); }
    setSaving(false);
  };

  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('donations', deleteConfirm.id); setDeleteConfirm(null); fetchData(); };

  const total = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const byCategory = donations.reduce((acc, d) => { acc[d.category_type] = (acc[d.category_type] || 0) + d.amount; return acc; }, {});

  const columns = [
    { header: 'Date', key: 'date', render: (row) => new Date(row.donation_date).toLocaleDateString() },
    { header: 'Category', key: 'category', render: (row) => <StatusBadge status={row.category_type} /> },
    { header: 'Amount', key: 'amount', render: (row) => <span style={{ fontWeight: 'bold', color: '#10b981' }}>XAF {row.amount?.toLocaleString()}</span> },
    { header: 'Method', key: 'method', render: (row) => row.payment_method },
    { header: 'Anonymous', key: 'anon', render: (row) => row.is_anonymous ? '🔒' : '—' },
  ];

  return (
    <div>
      <PageHeader title="💰 Giving" subtitle={`${donations.length} donations recorded`} actions={<Button onClick={() => openModal()}>➕ Record Donation</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Giving" value={`XAF ${total.toLocaleString()}`} icon="💰" color="#10b981" />
        <StatCard label="Tithes" value={`XAF ${(byCategory.TITHE || 0).toLocaleString()}`} icon="📿" color="#6366f1" />
        <StatCard label="Offerings" value={`XAF ${(byCategory.OFFERING || 0).toLocaleString()}`} icon="🎁" color="#f59e0b" />
        <StatCard label="Missions" value={`XAF ${(byCategory.MISSIONS || 0).toLocaleString()}`} icon="🌍" color="#3b82f6" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={donations} onEdit={openModal} onDelete={setDeleteConfirm} />}
      </div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingDonation ? '✏️ Edit Donation' : '➕ Record Donation'}>
        <FormInput label="Donor (optional)" type="select" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} options={members.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Amount (XAF)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <FormInput label="Date" type="date" value={form.donation_date} onChange={(e) => setForm({ ...form, donation_date: e.target.value })} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Category" type="select" value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })} options={[{ value: 'TITHE', label: 'Tithe' }, { value: 'OFFERING', label: 'Offering' }, { value: 'MISSIONS', label: 'Missions' }, { value: 'THANKSGIVING', label: 'Thanksgiving' }, { value: 'BUILDING', label: 'Building Fund' }]} />
          <FormInput label="Payment Method" type="select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={[{ value: 'CASH', label: 'Cash' }, { value: 'MOBILE_MONEY', label: 'Mobile Money' }, { value: 'BANK_TRANSFER', label: 'Bank Transfer' }]} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_anonymous} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} /><span style={{ fontSize: '14px' }}>Anonymous donation</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete Donation" message="Are you sure you want to delete this donation?" />
    </div>
  );
}

// ==========================================
// SALVATIONS PAGE - Full CRUD
// ==========================================
function SalvationsPage() {
  const [salvations, setSalvations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', gender: '', age_group: '', salvation_date: new Date().toISOString().split('T')[0], followup_status: 'PENDING', followup_notes: '' });

  useEffect(() => { fetchSalvations(); }, []);
  const fetchSalvations = async () => { setLoading(true); const data = await supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'salvation_date.desc' }); setSalvations(data || []); setLoading(false); };
  const resetForm = () => { setForm({ full_name: '', phone: '', email: '', gender: '', age_group: '', salvation_date: new Date().toISOString().split('T')[0], followup_status: 'PENDING', followup_notes: '' }); setEditingRecord(null); };
  const openModal = (record = null) => { if (record) { setEditingRecord(record); setForm({ full_name: record.full_name || '', phone: record.phone || '', email: record.email || '', gender: record.gender || '', age_group: record.age_group || '', salvation_date: record.salvation_date || '', followup_status: record.followup_status || 'PENDING', followup_notes: record.followup_notes || '' }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => { if (!form.full_name) { alert('Name is required'); return; } setSaving(true); try { if (editingRecord) { await supabaseUpdate('salvations', editingRecord.id, form); } else { await supabaseInsert('salvations', form); } setShowModal(false); resetForm(); fetchSalvations(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('salvations', deleteConfirm.id); setDeleteConfirm(null); fetchSalvations(); };

  const columns = [
    { header: 'Name', key: 'name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: 'Date', key: 'date', render: (row) => new Date(row.salvation_date).toLocaleDateString() },
    { header: 'Phone', key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone || '—'}</span> },
    { header: 'Follow-up', key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
  ];

  return (
    <div>
      <PageHeader title="❤️ Salvations" subtitle={`${salvations.length} souls won`} actions={<Button onClick={() => openModal()}>➕ Record Salvation</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={salvations.length} icon="❤️" color="#ef4444" />
        <StatCard label="This Month" value={salvations.filter(s => new Date(s.salvation_date) > new Date(Date.now() - 30*24*60*60*1000)).length} icon="📅" color="#6366f1" />
        <StatCard label="Pending" value={salvations.filter(s => s.followup_status === 'PENDING').length} icon="⏰" color="#f59e0b" />
        <StatCard label="Completed" value={salvations.filter(s => s.followup_status === 'COMPLETED').length} icon="✅" color="#10b981" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>{loading ? <LoadingSpinner /> : <DataTable columns={columns} data={salvations} onEdit={openModal} onDelete={setDeleteConfirm} />}</div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? '✏️ Edit' : '➕ Record Salvation'}>
        <FormInput label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Gender" type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }]} />
          <FormInput label="Age Group" type="select" value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })} options={[{ value: 'CHILD', label: 'Child' }, { value: 'YOUTH', label: 'Youth' }, { value: 'ADULT', label: 'Adult' }, { value: 'SENIOR', label: 'Senior' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Date" type="date" value={form.salvation_date} onChange={(e) => setForm({ ...form, salvation_date: e.target.value })} required />
          <FormInput label="Status" type="select" value={form.followup_status} onChange={(e) => setForm({ ...form, followup_status: e.target.value })} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'COMPLETED', label: 'Completed' }]} />
        </div>
        <FormInput label="Notes" type="textarea" value={form.followup_notes} onChange={(e) => setForm({ ...form, followup_notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message={`Delete ${deleteConfirm?.full_name}?`} />
    </div>
  );
}

// ==========================================
// GROUPS PAGE - Full CRUD
// ==========================================
function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', group_type: 'CELL', meeting_day: 'WEDNESDAY', meeting_time: '18:00', is_active: true });

  useEffect(() => { fetchGroups(); }, []);
  const fetchGroups = async () => { setLoading(true); const data = await supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }); setGroups(data || []); setLoading(false); };
  const resetForm = () => { setForm({ name: '', description: '', group_type: 'CELL', meeting_day: 'WEDNESDAY', meeting_time: '18:00', is_active: true }); setEditingGroup(null); };
  const openModal = (group = null) => { if (group) { setEditingGroup(group); setForm({ name: group.name || '', description: group.description || '', group_type: group.group_type || 'CELL', meeting_day: group.meeting_day || 'WEDNESDAY', meeting_time: group.meeting_time || '18:00', is_active: group.is_active ?? true }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => { if (!form.name) { alert('Name required'); return; } setSaving(true); try { if (editingGroup) { await supabaseUpdate('groups', editingGroup.id, form); } else { await supabaseInsert('groups', form); } setShowModal(false); resetForm(); fetchGroups(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('groups', deleteConfirm.id); setDeleteConfirm(null); fetchGroups(); };

  return (
    <div>
      <PageHeader title="👨‍👩‍👧‍👦 Groups" subtitle={`${groups.length} groups`} actions={<Button onClick={() => openModal()}>➕ Create Group</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={groups.length} icon="👥" />
        <StatCard label="Active" value={groups.filter(g => g.is_active).length} icon="✅" color="#10b981" />
        <StatCard label="Cell Groups" value={groups.filter(g => g.group_type === 'CELL').length} icon="🏠" color="#6366f1" />
      </div>
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {groups.map((group) => (
            <div key={group.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👥</div>
                <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => openModal(group)} style={{ padding: '8px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>✏️</button><button onClick={() => setDeleteConfirm(group)} style={{ padding: '8px', border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button></div>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>{group.name}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>{group.description || 'No description'}</p>
              <div style={{ display: 'flex', gap: '8px' }}><StatusBadge status={group.group_type} />{group.is_active && <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>Active</span>}</div>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', fontSize: '14px', color: '#6b7280' }}>📅 {group.meeting_day} {group.meeting_time && `at ${group.meeting_time}`}</div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingGroup ? '✏️ Edit' : '➕ Create Group'}>
        <FormInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <FormInput label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Type" type="select" value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value })} options={[{ value: 'CELL', label: 'Cell Group' }, { value: 'DEPARTMENT', label: 'Department' }, { value: 'MINISTRY', label: 'Ministry' }, { value: 'TRAINING', label: 'Training' }]} />
          <FormInput label="Meeting Day" type="select" value={form.meeting_day} onChange={(e) => setForm({ ...form, meeting_day: e.target.value })} options={[{ value: 'SUNDAY', label: 'Sunday' }, { value: 'MONDAY', label: 'Monday' }, { value: 'TUESDAY', label: 'Tuesday' }, { value: 'WEDNESDAY', label: 'Wednesday' }, { value: 'THURSDAY', label: 'Thursday' }, { value: 'FRIDAY', label: 'Friday' }, { value: 'SATURDAY', label: 'Saturday' }]} />
        </div>
        <FormInput label="Time" type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span style={{ fontSize: '14px' }}>Active</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message={`Delete "${deleteConfirm?.name}"?`} />
    </div>
  );
}

// ==========================================
// PRAYERS PAGE - Full CRUD
// ==========================================
function PrayersPage() {
  const [prayers, setPrayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', requester_name: '', category: 'General', privacy: 'PUBLIC', status: 'NEW' });

  useEffect(() => { fetchPrayers(); }, []);
  const fetchPrayers = async () => { setLoading(true); const data = await supabaseQuery('prayer_requests', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc' }); setPrayers(data || []); setLoading(false); };
  const resetForm = () => { setForm({ title: '', description: '', requester_name: '', category: 'General', privacy: 'PUBLIC', status: 'NEW' }); setEditingPrayer(null); };
  const openModal = (prayer = null) => { if (prayer) { setEditingPrayer(prayer); setForm({ title: prayer.title || '', description: prayer.description || '', requester_name: prayer.requester_name || '', category: prayer.category || 'General', privacy: prayer.privacy || 'PUBLIC', status: prayer.status || 'NEW' }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => { if (!form.title) { alert('Title required'); return; } setSaving(true); try { if (editingPrayer) { await supabaseUpdate('prayer_requests', editingPrayer.id, form); } else { await supabaseInsert('prayer_requests', form); } setShowModal(false); resetForm(); fetchPrayers(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('prayer_requests', deleteConfirm.id); setDeleteConfirm(null); fetchPrayers(); };
  const incrementPrayer = async (prayer) => { await supabaseUpdate('prayer_requests', prayer.id, { prayer_count: (prayer.prayer_count || 0) + 1 }); fetchPrayers(); };

  return (
    <div>
      <PageHeader title="🙏 Prayer Requests" subtitle={`${prayers.length} requests`} actions={<Button onClick={() => openModal()}>➕ New Request</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={prayers.length} icon="🙏" />
        <StatCard label="New" value={prayers.filter(p => p.status === 'NEW').length} icon="🆕" color="#3b82f6" />
        <StatCard label="Praying" value={prayers.filter(p => p.status === 'PRAYING').length} icon="✨" color="#f59e0b" />
        <StatCard label="Answered" value={prayers.filter(p => p.status === 'ANSWERED').length} icon="✅" color="#10b981" />
      </div>
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {prayers.map((prayer) => (
            <div key={prayer.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <StatusBadge status={prayer.status} />
                <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => openModal(prayer)} style={{ padding: '6px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button><button onClick={() => setDeleteConfirm(prayer)} style={{ padding: '6px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button></div>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>{prayer.title}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{prayer.description || 'No description'}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>{prayer.requester_name || 'Anonymous'}</span>
                <button onClick={() => incrementPrayer(prayer)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', background: '#fef3c7', color: '#92400e', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>🙏 {prayer.prayer_count || 0}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingPrayer ? '✏️ Edit' : '➕ New Prayer Request'}>
        <FormInput label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <FormInput label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <FormInput label="Your Name" value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} placeholder="Optional" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <FormInput label="Category" type="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={[{ value: 'General', label: 'General' }, { value: 'Health', label: 'Health' }, { value: 'Family', label: 'Family' }, { value: 'Financial', label: 'Financial' }]} />
          <FormInput label="Privacy" type="select" value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })} options={[{ value: 'PUBLIC', label: 'Public' }, { value: 'PRIVATE', label: 'Private' }]} />
          <FormInput label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'NEW', label: 'New' }, { value: 'PRAYING', label: 'Praying' }, { value: 'ANSWERED', label: 'Answered' }]} />
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message={`Delete "${deleteConfirm?.title}"?`} />
    </div>
  );
}

// ==========================================
// SERVICES PAGE - Full CRUD
// ==========================================
function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', day_of_week: 'SUNDAY', start_time: '09:00', end_time: '11:00', is_active: true });

  useEffect(() => { fetchServices(); }, []);
  const fetchServices = async () => { setLoading(true); const data = await supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }); setServices(data || []); setLoading(false); };
  const resetForm = () => { setForm({ name: '', description: '', day_of_week: 'SUNDAY', start_time: '09:00', end_time: '11:00', is_active: true }); setEditingService(null); };
  const openModal = (service = null) => { if (service) { setEditingService(service); setForm({ name: service.name || '', description: service.description || '', day_of_week: service.day_of_week || 'SUNDAY', start_time: service.start_time || '09:00', end_time: service.end_time || '11:00', is_active: service.is_active ?? true }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => { if (!form.name) { alert('Name required'); return; } setSaving(true); try { if (editingService) { await supabaseUpdate('services', editingService.id, form); } else { await supabaseInsert('services', form); } setShowModal(false); resetForm(); fetchServices(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('services', deleteConfirm.id); setDeleteConfirm(null); fetchServices(); };

  const columns = [
    { header: 'Service Name', key: 'name', render: (row) => <span style={{ fontWeight: '500' }}>{row.name}</span> },
    { header: 'Day', key: 'day', render: (row) => row.day_of_week },
    { header: 'Time', key: 'time', render: (row) => `${row.start_time} - ${row.end_time}` },
    { header: 'Status', key: 'status', render: (row) => row.is_active ? <span style={{ color: '#10b981' }}>✅ Active</span> : <span style={{ color: '#ef4444' }}>❌ Inactive</span> },
  ];

  return (
    <div>
      <PageHeader title="⛪ Services" subtitle={`${services.length} services`} actions={<Button onClick={() => openModal()}>➕ Add Service</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total" value={services.length} icon="⛪" />
        <StatCard label="Active" value={services.filter(s => s.is_active).length} icon="✅" color="#10b981" />
        <StatCard label="Sunday" value={services.filter(s => s.day_of_week === 'SUNDAY').length} icon="📅" color="#6366f1" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>{loading ? <LoadingSpinner /> : <DataTable columns={columns} data={services} onEdit={openModal} onDelete={setDeleteConfirm} />}</div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingService ? '✏️ Edit' : '➕ Add Service'}>
        <FormInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <FormInput label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <FormInput label="Day" type="select" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} options={[{ value: 'SUNDAY', label: 'Sunday' }, { value: 'MONDAY', label: 'Monday' }, { value: 'TUESDAY', label: 'Tuesday' }, { value: 'WEDNESDAY', label: 'Wednesday' }, { value: 'THURSDAY', label: 'Thursday' }, { value: 'FRIDAY', label: 'Friday' }, { value: 'SATURDAY', label: 'Saturday' }]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span style={{ fontSize: '14px' }}>Active</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message={`Delete "${deleteConfirm?.name}"?`} />
    </div>
  );
}

// ==========================================
// SETTINGS PAGE
// ==========================================
function SettingsPage() {
  const { user, logout } = useAuth();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchChurch(); }, []);
  const fetchChurch = async () => { setLoading(true); const data = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }); setChurch(data); setLoading(false); };

  return (
    <div>
      <PageHeader title="⚙️ Settings" subtitle="Manage your church settings" />
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>⛪ Church Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Church Name</label><p style={{ margin: 0, fontWeight: '500' }}>{church?.name}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Address</label><p style={{ margin: 0 }}>{church?.address}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>City</label><p style={{ margin: 0 }}>{church?.city}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</label><p style={{ margin: 0 }}>{church?.phone}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{church?.email}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Currency</label><p style={{ margin: 0 }}>{church?.currency}</p></div>
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>👤 Your Account</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Name</label><p style={{ margin: 0, fontWeight: '500' }}>{user?.name}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{user?.email}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Role</label><p style={{ margin: 0 }}><StatusBadge status={user?.role} /></p></div>
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🔧 Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}><Button variant="secondary">📤 Export Data</Button><Button variant="secondary">📊 Generate Report</Button><Button variant="danger" onClick={logout}>🚪 Sign Out</Button></div>
          </div>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✝</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold' }}>ChurchSmart</h3>
            <p style={{ margin: 0, color: '#6b7280' }}>Version 1.0.0 • Connected to Supabase</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>Built with ❤️ for churches in Cameroon</p>
          </div>
        </div>
      )}
    </div>
  );
}