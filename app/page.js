"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = 'https://ntngwrtbbgetobinwvxd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50bmd3cnRiYmdldG9iaW53dnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTc3NTIsImV4cCI6MjA4NTMzMzc1Mn0.uvMWB2zwd4LYJM1P1jpov5rG83L62Eqbe7Bko9kI_1Q';
const CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const EDGE_FUNCTION_URL = 'https://ntngwrtbbgetobinwvxd.supabase.co/functions/v1/send-message';

// ==========================================
// TRANSLATIONS (Bilingual FR/EN)
// ==========================================
const translations = {
  en: {
    // General
    dashboard: 'Dashboard',
    members: 'Members',
    visitors: 'Visitors',
    attendance: 'Attendance',
    giving: 'Giving',
    salvations: 'Salvations',
    groups: 'Groups',
    prayers: 'Prayer Requests',
    services: 'Services',
    settings: 'Settings',
    search: 'Search...',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    success: 'Success!',
    error: 'Error',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    actions: 'Actions',
    status: 'Status',
    date: 'Date',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    total: 'Total',
    active: 'Active',
    inactive: 'Inactive',
    
    // Auth
    welcome: 'Welcome Back',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    forgotPassword: 'Forgot password?',
    createAccount: 'Create Account',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    
    // Dashboard
    totalMembers: 'Total Members',
    totalVisitors: 'Total Visitors',
    totalGiving: 'Total Giving',
    recentDonations: 'Recent Donations',
    recentAttendance: 'Recent Attendance',
    
    // Members
    addMember: 'Add Member',
    editMember: 'Edit Member',
    firstName: 'First Name',
    lastName: 'Last Name',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    dateOfBirth: 'Date of Birth',
    membershipStatus: 'Membership Status',
    membershipDate: 'Membership Date',
    baptized: 'Baptized',
    language: 'Language',
    photo: 'Photo',
    uploadPhoto: 'Upload Photo',
    
    // Visitors
    addVisitor: 'Register Visitor',
    editVisitor: 'Edit Visitor',
    visitDate: 'Visit Date',
    firstTime: 'First Time',
    howHeard: 'How did they hear about us?',
    followUpStatus: 'Follow-up Status',
    sendSMS: 'Send SMS',
    sendWhatsApp: 'Send WhatsApp',
    messageSent: 'Message sent successfully!',
    messageTemplate: 'Message Template',
    customMessage: 'Custom Message',
    
    // Follow-up Status
    notStarted: 'Not Started',
    inProgress: 'In Progress',
    completed: 'Completed',
    becameMember: 'Became Member',
    
    // Attendance
    recordAttendance: 'Record Attendance',
    men: 'Men',
    women: 'Women',
    children: 'Children',
    firstTimers: 'First Timers',
    offering: 'Offering',
    weather: 'Weather',
    sunny: 'Sunny',
    cloudy: 'Cloudy',
    rainy: 'Rainy',
    
    // Giving
    recordDonation: 'Record Donation',
    amount: 'Amount',
    category: 'Category',
    tithe: 'Tithe',
    offeringCat: 'Offering',
    missions: 'Missions',
    thanksgiving: 'Thanksgiving',
    paymentMethod: 'Payment Method',
    cash: 'Cash',
    mobileMoney: 'Mobile Money',
    bankTransfer: 'Bank Transfer',
    anonymous: 'Anonymous',
    
    // Salvations
    recordSalvation: 'Record Salvation',
    ageGroup: 'Age Group',
    child: 'Child',
    youth: 'Youth',
    adult: 'Adult',
    senior: 'Senior',
    followUpNotes: 'Follow-up Notes',
    
    // Groups
    createGroup: 'Create Group',
    groupName: 'Group Name',
    groupType: 'Group Type',
    cellGroup: 'Cell Group',
    department: 'Department',
    ministry: 'Ministry',
    meetingDay: 'Meeting Day',
    meetingTime: 'Meeting Time',
    
    // Prayers
    newRequest: 'New Request',
    prayerTitle: 'Title',
    description: 'Description',
    requesterName: 'Your Name',
    prayForThis: 'Pray for this',
    new: 'New',
    praying: 'Praying',
    answered: 'Answered',
    
    // Auto Follow-up Messages
    day1Message: 'Thank you for visiting FIRE Church! We were blessed to have you. God bless you! 🙏',
    day3Message: 'Hello! We hope you enjoyed your visit to FIRE Church. We would love to see you again this Sunday! 🙏',
    day7Message: 'Hi! Just checking in. We miss you at FIRE Church! Join us this Sunday for a powerful service. God bless! ✝️',
    
    // Days of week
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  },
  fr: {
    // General
    dashboard: 'Tableau de Bord',
    members: 'Membres',
    visitors: 'Visiteurs',
    attendance: 'Présence',
    giving: 'Offrandes',
    salvations: 'Saluts',
    groups: 'Groupes',
    prayers: 'Demandes de Prière',
    services: 'Cultes',
    settings: 'Paramètres',
    search: 'Rechercher...',
    add: 'Ajouter',
    edit: 'Modifier',
    delete: 'Supprimer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    loading: 'Chargement...',
    success: 'Succès!',
    error: 'Erreur',
    confirm: 'Confirmer',
    yes: 'Oui',
    no: 'Non',
    actions: 'Actions',
    status: 'Statut',
    date: 'Date',
    name: 'Nom',
    phone: 'Téléphone',
    email: 'Email',
    total: 'Total',
    active: 'Actif',
    inactive: 'Inactif',
    
    // Auth
    welcome: 'Bienvenue',
    signIn: 'Se Connecter',
    signUp: "S'inscrire",
    signOut: 'Déconnexion',
    forgotPassword: 'Mot de passe oublié?',
    createAccount: 'Créer un Compte',
    noAccount: "Pas de compte?",
    hasAccount: 'Déjà un compte?',
    
    // Dashboard
    totalMembers: 'Total Membres',
    totalVisitors: 'Total Visiteurs',
    totalGiving: 'Total Offrandes',
    recentDonations: 'Offrandes Récentes',
    recentAttendance: 'Présences Récentes',
    
    // Members
    addMember: 'Ajouter Membre',
    editMember: 'Modifier Membre',
    firstName: 'Prénom',
    lastName: 'Nom',
    gender: 'Sexe',
    male: 'Homme',
    female: 'Femme',
    dateOfBirth: 'Date de Naissance',
    membershipStatus: 'Statut',
    membershipDate: "Date d'Adhésion",
    baptized: 'Baptisé',
    language: 'Langue',
    photo: 'Photo',
    uploadPhoto: 'Télécharger Photo',
    
    // Visitors
    addVisitor: 'Enregistrer Visiteur',
    editVisitor: 'Modifier Visiteur',
    visitDate: 'Date de Visite',
    firstTime: 'Première Fois',
    howHeard: 'Comment nous avez-vous connu?',
    followUpStatus: 'Statut de Suivi',
    sendSMS: 'Envoyer SMS',
    sendWhatsApp: 'Envoyer WhatsApp',
    messageSent: 'Message envoyé avec succès!',
    messageTemplate: 'Modèle de Message',
    customMessage: 'Message Personnalisé',
    
    // Follow-up Status
    notStarted: 'Non Commencé',
    inProgress: 'En Cours',
    completed: 'Terminé',
    becameMember: 'Devenu Membre',
    
    // Attendance
    recordAttendance: 'Enregistrer Présence',
    men: 'Hommes',
    women: 'Femmes',
    children: 'Enfants',
    firstTimers: 'Nouveaux',
    offering: 'Offrande',
    weather: 'Météo',
    sunny: 'Ensoleillé',
    cloudy: 'Nuageux',
    rainy: 'Pluvieux',
    
    // Giving
    recordDonation: 'Enregistrer Don',
    amount: 'Montant',
    category: 'Catégorie',
    tithe: 'Dîme',
    offeringCat: 'Offrande',
    missions: 'Missions',
    thanksgiving: 'Action de Grâce',
    paymentMethod: 'Mode de Paiement',
    cash: 'Espèces',
    mobileMoney: 'Mobile Money',
    bankTransfer: 'Virement Bancaire',
    anonymous: 'Anonyme',
    
    // Salvations
    recordSalvation: 'Enregistrer Salut',
    ageGroup: "Tranche d'Âge",
    child: 'Enfant',
    youth: 'Jeune',
    adult: 'Adulte',
    senior: 'Senior',
    followUpNotes: 'Notes de Suivi',
    
    // Groups
    createGroup: 'Créer Groupe',
    groupName: 'Nom du Groupe',
    groupType: 'Type de Groupe',
    cellGroup: 'Cellule de Maison',
    department: 'Département',
    ministry: 'Ministère',
    meetingDay: 'Jour de Réunion',
    meetingTime: 'Heure de Réunion',
    
    // Prayers
    newRequest: 'Nouvelle Demande',
    prayerTitle: 'Titre',
    description: 'Description',
    requesterName: 'Votre Nom',
    prayForThis: 'Prier pour ceci',
    new: 'Nouveau',
    praying: 'En Prière',
    answered: 'Exaucé',
    
    // Auto Follow-up Messages
    day1Message: 'Merci pour votre visite à FIRE Church! Nous avons été bénis de vous avoir. Que Dieu vous bénisse! 🙏',
    day3Message: 'Bonjour! Nous espérons que votre visite à FIRE Church vous a plu. Nous serions ravis de vous revoir ce dimanche! 🙏',
    day7Message: 'Salut! Nous prenons de vos nouvelles. Vous nous manquez à FIRE Church! Rejoignez-nous ce dimanche pour un culte puissant. Que Dieu vous bénisse! ✝️',
    
    // Days of week
    sunday: 'Dimanche',
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
  }
};

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
// SMS/WHATSAPP HELPER
// ==========================================
async function sendMessage(to, message, type = 'sms') {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ to, message, type })
    });
    return response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// PHOTO UPLOAD HELPER
// ==========================================
async function uploadPhoto(file, bucket = 'avatars') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
    },
    body: file
  });

  if (response.ok) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
  }
  return null;
}

// ==========================================
// AUTH CONTEXT
// ==========================================
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('churchsmart_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
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
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
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
  const { t, language, changeLanguage } = useLanguage();
  const [mode, setMode] = useState('login');
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
      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
        <button
          onClick={() => changeLanguage(language === 'en' ? 'fr' : 'en')}
          style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
        >
          {language === 'en' ? '🇫🇷 Français' : '🇬🇧 English'}
        </button>
      </div>

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
            {mode === 'login' ? t('welcome') : mode === 'signup' ? t('createAccount') : t('forgotPassword')}
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
            {mode === 'login' ? 'Sign in to manage your church' : 'Start managing your church today'}
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
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('name')}</label>
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
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>{t('email')}</label>
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
                  {t('forgotPassword')}
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
              {loading ? '⏳ ...' : mode === 'login' ? `${t('signIn')} →` : mode === 'signup' ? `${t('createAccount')} →` : 'Send Reset Link →'}
            </button>
          </form>

          {/* Toggle Mode */}
          <p style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>
            {mode === 'login' ? (
              <>{t('noAccount')} <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}>{t('signUp')}</button></>
            ) : (
              <>{t('hasAccount')} <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}>{t('signIn')}</button></>
            )}
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ maxWidth: '400px', color: 'white' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            {language === 'en' ? 'Manage your church with ease' : 'Gérez votre église facilement'}
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.9, margin: '0 0 32px 0' }}>
            {language === 'en' 
              ? 'Track attendance, manage members, record giving, and grow your ministry with ChurchSmart.'
              : "Suivez la présence, gérez les membres, enregistrez les offrandes et développez votre ministère avec ChurchSmart."}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { icon: '👥', label: language === 'en' ? 'Member Management' : 'Gestion des Membres' },
              { icon: '📊', label: language === 'en' ? 'Attendance Tracking' : 'Suivi des Présences' },
              { icon: '💰', label: language === 'en' ? 'Giving Reports' : 'Rapports Offrandes' },
              { icon: '🙏', label: language === 'en' ? 'Prayer Requests' : 'Demandes de Prière' },
              { icon: '📱', label: language === 'en' ? 'SMS Follow-up' : 'Suivi par SMS' },
              { icon: '❤️', label: language === 'en' ? 'Salvation Tracking' : 'Suivi des Saluts' },
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
  const { t, language, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊' },
    { id: 'members', label: t('members'), icon: '👥' },
    { id: 'visitors', label: t('visitors'), icon: '🚶' },
    { id: 'attendance', label: t('attendance'), icon: '📅' },
    { id: 'giving', label: t('giving'), icon: '💰' },
    { id: 'salvations', label: t('salvations'), icon: '❤️' },
    { id: 'groups', label: t('groups'), icon: '👨‍👩‍👧‍👦' },
    { id: 'prayers', label: t('prayers'), icon: '🙏' },
    { id: 'services', label: t('services'), icon: '⛪' },
    { id: 'settings', label: t('settings'), icon: '⚙️' },
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
            🚪 {sidebarOpen && t('signOut')}
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
            {/* Language Toggle */}
            <button
              onClick={() => changeLanguage(language === 'en' ? 'fr' : 'en')}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
            >
              {language === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'}
            </button>
            <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>🟢 Live</span>
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
      ) : type === 'file' ? (
        <input type="file" onChange={onChange} accept="image/*" style={inputStyle} />
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
    sms: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
    whatsapp: { background: '#dcfce7', color: '#166534', border: '1px solid #22c55e' },
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
  const { t } = useLanguage();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="400px">
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="danger" onClick={onConfirm}>{t('delete')}</Button>
      </div>
    </Modal>
  );
}

function DataTable({ columns, data, onEdit, onDelete, onSMS, emptyMessage = 'No data found' }) {
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
            {(onEdit || onDelete || onSMS) && (
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
              {(onEdit || onDelete || onSMS) && (
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {onSMS && (
                      <button onClick={() => onSMS(row)} style={{ padding: '8px', border: 'none', background: '#dcfce7', borderRadius: '8px', cursor: 'pointer' }} title="Send SMS">📱</button>
                    )}
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

function SearchBar({ value, onChange, placeholder }) {
  const { t } = useLanguage();
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t('search')}
        style={{ padding: '10px 16px 10px 42px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', width: '280px', outline: 'none' }}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px' }}>
      <div style={{ fontSize: '32px' }}>⏳</div>
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

  const handleSend = async (type = 'sms') => {
    setSending(true);
    setResult(null);
    
    const message = messageType === 'custom' ? customMessage : messageTemplates[messageType];
    const response = await sendMessage(recipient.phone || recipient.whatsapp, message, type);
    
    setResult(response);
    setSending(false);
    
    if (response.success) {
      // Update follow-up status
      if (recipient.id) {
        await supabaseUpdate('visitors', recipient.id, { followup_status: 'IN_PROGRESS' });
      }
      setTimeout(() => {
        onClose();
        if (onSend) onSend();
      }, 2000);
    }
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
        <Button variant="sms" onClick={() => handleSend('sms')} disabled={sending}>
          {sending ? '⏳...' : '📱 SMS'}
        </Button>
        <Button variant="whatsapp" onClick={() => handleSend('whatsapp')} disabled={sending}>
          {sending ? '⏳...' : '💬 WhatsApp'}
        </Button>
      </div>
    </Modal>
  );
}

// ==========================================
// DASHBOARD PAGE
// ==========================================
function DashboardPage() {
  const { t } = useLanguage();
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

      const allDonations = await supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] });
      const totalDonations = (allDonations || []).reduce((sum, d) => sum + (d.amount || 0), 0);
      
      setStats({
        members: members?.length || 0,
        visitors: visitors?.length || 0,
        salvations: salvations?.length || 0,
        donations: totalDonations
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
        title={`📊 ${t('dashboard')}`}
        subtitle={t('welcome')}
        actions={<Button onClick={fetchData} variant="secondary">🔄 Refresh</Button>}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <StatCard label={t('totalMembers')} value={stats.members} icon="👥" color="#6366f1" trend="+5%" />
            <StatCard label={t('totalVisitors')} value={stats.visitors} icon="🚶" color="#f59e0b" trend="+3" />
            <StatCard label={t('salvations')} value={stats.salvations} icon="❤️" color="#ef4444" trend="+2" />
            <StatCard label={t('totalGiving')} value={formatCurrency(stats.donations)} icon="💰" color="#10b981" trend="+8%" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>💰 {t('recentDonations')}</h3>
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

            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>📅 {t('recentAttendance')}</h3>
              {recentAttendance.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>No recent attendance</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentAttendance.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{new Date(a.service_date).toLocaleDateString()}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{t('men')}: {a.men_count} | {t('women')}: {a.women_count} | {t('children')}: {a.children_count}</p>
                      </div>
                      <span style={{ fontWeight: 'bold', color: '#6366f1' }}>{a.total_count} {t('total')}</span>
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
// MEMBERS PAGE - With Photo Upload
// ==========================================
function MembersPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
    gender: '', date_of_birth: '', language_preference: 'FRENCH',
    membership_status: 'ACTIVE', membership_date: '', baptism_status: false, photo_url: ''
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
      membership_status: 'ACTIVE', membership_date: '', baptism_status: false, photo_url: ''
    });
    setEditingMember(null);
    setPhotoFile(null);
    setPhotoPreview(null);
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
        baptism_status: member.baptism_status || false,
        photo_url: member.photo_url || ''
      });
      setPhotoPreview(member.photo_url || null);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      alert('First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      
      // Upload photo if new file selected
      if (photoFile) {
        const uploadedUrl = await uploadPhoto(photoFile, 'avatars');
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      }

      const memberData = { ...form, photo_url: photoUrl };

      if (editingMember) {
        await supabaseUpdate('members', editingMember.id, memberData);
      } else {
        const memberNumber = `FC-${String(members.length + 1).padStart(4, '0')}`;
        await supabaseInsert('members', { ...memberData, member_number: memberNumber });
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
      header: t('name'),
      key: 'name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {row.photo_url ? (
            <img src={row.photo_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600' }}>
              {row.first_name?.[0]}{row.last_name?.[0]}
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontWeight: '500' }}>{row.first_name} {row.last_name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{row.member_number}</p>
          </div>
        </div>
      )
    },
    { header: t('email'), key: 'email', render: (row) => <span style={{ color: '#6b7280' }}>{row.email || '—'}</span> },
    { header: t('phone'), key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone || '—'}</span> },
    { header: t('status'), key: 'status', render: (row) => <StatusBadge status={row.membership_status} /> },
    { header: t('baptized'), key: 'baptized', render: (row) => row.baptism_status ? '✅' : '—' },
  ];

  return (
    <div>
      <PageHeader
        title={`👥 ${t('members')}`}
        subtitle={`${members.length} ${t('total')}`}
        actions={<Button onClick={() => openModal()}>➕ {t('addMember')}</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={members.length} icon="👥" />
        <StatCard label={t('active')} value={members.filter(m => m.membership_status === 'ACTIVE').length} icon="✅" color="#10b981" />
        <StatCard label={t('baptized')} value={members.filter(m => m.baptism_status).length} icon="💧" color="#3b82f6" />
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} />
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{filteredMembers.length} results</span>
        </div>
        {loading ? <LoadingSpinner /> : (
          <DataTable columns={columns} data={filteredMembers} onEdit={openModal} onDelete={setDeleteConfirm} />
        )}
      </div>

      {/* Add/Edit Modal with Photo Upload */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingMember ? `✏️ ${t('editMember')}` : `➕ ${t('addMember')}`} width="600px">
        {/* Photo Upload */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }} />
            ) : (
              <div style={{ width: '100px', height: '100px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '32px', color: '#6366f1' }}>
                {form.first_name?.[0] || '👤'}
              </div>
            )}
            <label style={{ cursor: 'pointer', color: '#6366f1', fontSize: '14px', fontWeight: '500' }}>
              📷 {t('uploadPhoto')}
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('firstName')} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <FormInput label={t('lastName')} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <FormInput label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" />
          <FormInput label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+237 6XX XXX XXX" />
          <FormInput label={t('gender')} type="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: 'MALE', label: t('male') }, { value: 'FEMALE', label: t('female') }]} />
          <FormInput label={t('dateOfBirth')} type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          <FormInput label={t('language')} type="select" value={form.language_preference} onChange={(e) => setForm({ ...form, language_preference: e.target.value })} options={[{ value: 'FRENCH', label: 'Français' }, { value: 'ENGLISH', label: 'English' }]} />
          <FormInput label={t('membershipStatus')} type="select" value={form.membership_status} onChange={(e) => setForm({ ...form, membership_status: e.target.value })} options={[{ value: 'ACTIVE', label: t('active') }, { value: 'INACTIVE', label: t('inactive') }]} />
          <FormInput label={t('membershipDate')} type="date" value={form.membership_date} onChange={(e) => setForm({ ...form, membership_date: e.target.value })} />
        </div>
        <div style={{ marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.baptism_status} onChange={(e) => setForm({ ...form, baptism_status: e.target.checked })} />
            <span style={{ fontSize: '14px' }}>{t('baptized')}</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳...' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={`🗑️ ${t('delete')} ${t('members')}`}
        message={`Are you sure you want to delete ${deleteConfirm?.first_name} ${deleteConfirm?.last_name}?`}
      />
    </div>
  );
}

// ==========================================
// VISITORS PAGE - With SMS Integration (Continued)
// ==========================================
function VisitorsPage() {
  const { t } = useLanguage();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const openSMSModal = (visitor) => {
    setSelectedVisitor(visitor);
    setShowSMSModal(true);
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

  const sendAutoFollowUp = async (visitor, dayType) => {
    const message = t(`day${dayType}Message`);
    const result = await sendMessage(visitor.phone, message, 'sms');
    if (result.success) {
      await supabaseUpdate('visitors', visitor.id, { followup_status: 'IN_PROGRESS' });
      fetchVisitors();
      alert(`✅ Day ${dayType} message sent to ${visitor.full_name}!`);
    } else {
      alert(`❌ Failed to send message: ${result.error}`);
    }
  };

  const getVisitorDays = (visitDate) => {
    const visit = new Date(visitDate);
    const today = new Date();
    const diffTime = Math.abs(today - visit);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredVisitors = visitors.filter(v =>
    v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  );

  const columns = [
    { header: t('name'), key: 'full_name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: t('visitDate'), key: 'visit_date', render: (row) => new Date(row.visit_date).toLocaleDateString() },
    { header: t('phone'), key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone}</span> },
    { header: t('howHeard'), key: 'how_heard', render: (row) => <span style={{ color: '#6b7280' }}>{row.how_heard_about_us || '—'}</span> },
    { header: t('status'), key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
    { header: t('firstTime'), key: 'first_time', render: (row) => row.is_first_time ? '✅' : '🔄' },
  ];

  return (
    <div>
      <PageHeader
        title={`🚶 ${t('visitors')}`}
        subtitle={`${visitors.length} ${t('total')}`}
        actions={<Button onClick={() => openModal()}>➕ {t('addVisitor')}</Button>}
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
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} />
        </div>
        {loading ? <LoadingSpinner /> : (
          <DataTable columns={columns} data={filteredVisitors} onEdit={openModal} onDelete={setDeleteConfirm} onSMS={openSMSModal} />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingVisitor ? `✏️ ${t('editVisitor')}` : `➕ ${t('addVisitor')}`}>
        <FormInput label={t('name')} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+237 6XX XXX XXX" />
          <FormInput label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+237 6XX XXX XXX" />
        </div>
        <FormInput label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('visitDate')} type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
          <FormInput label={t('howHeard')} type="select" value={form.how_heard_about_us} onChange={(e) => setForm({ ...form, how_heard_about_us: e.target.value })} 
            options={[{ value: 'Friend/Family', label: 'Friend/Family' }, { value: 'Social Media', label: 'Social Media' }, { value: 'Walk-in', label: 'Walk-in' }, { value: 'Flyer/Poster', label: 'Flyer/Poster' }, { value: 'Online Search', label: 'Online Search' }, { value: 'Event', label: 'Event' }]} />
        </div>
        <FormInput label={t('followUpStatus')} type="select" value={form.followup_status} onChange={(e) => setForm({ ...form, followup_status: e.target.value })}
          options={[{ value: 'NOT_STARTED', label: t('notStarted') }, { value: 'IN_PROGRESS', label: t('inProgress') }, { value: 'COMPLETED', label: t('completed') }, { value: 'BECAME_MEMBER', label: t('becameMember') }]} />
        <FormInput label="Prayer Request" type="textarea" value={form.prayer_request} onChange={(e) => setForm({ ...form, prayer_request: e.target.value })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input type="checkbox" checked={form.is_first_time} onChange={(e) => setForm({ ...form, is_first_time: e.target.checked })} />
          <span style={{ fontSize: '14px' }}>{t('firstTime')}</span>
        </label>
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
// ATTENDANCE PAGE
// ==========================================
function AttendancePage() {
  const { t } = useLanguage();
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
    setForm({ service_id: services[0]?.id || '', service_date: new Date().toISOString().split('T')[0], men_count: 0, women_count: 0, children_count: 0, first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: '' });
    setEditingRecord(null);
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setForm({ service_id: record.service_id || '', service_date: record.service_date || '', men_count: record.men_count || 0, women_count: record.women_count || 0, children_count: record.children_count || 0, first_timers_count: record.first_timers_count || 0, total_offering: record.total_offering || 0, weather: record.weather || 'SUNNY', notes: record.notes || '' });
    } else { resetForm(); }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.service_date) { alert('Service date is required'); return; }
    setSaving(true);
    try {
      const data = { ...form, men_count: parseInt(form.men_count), women_count: parseInt(form.women_count), children_count: parseInt(form.children_count), first_timers_count: parseInt(form.first_timers_count), total_offering: parseFloat(form.total_offering) };
      if (editingRecord) { await supabaseUpdate('attendance_records', editingRecord.id, data); }
      else { await supabaseInsert('attendance_records', data); }
      setShowModal(false); resetForm(); fetchData();
    } catch (error) { alert('Error saving: ' + error.message); }
    setSaving(false);
  };

  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('attendance_records', deleteConfirm.id); setDeleteConfirm(null); fetchData(); };

  const totalAttendance = attendance.reduce((s, a) => s + (a.total_count || 0), 0);
  const avgAttendance = attendance.length ? Math.round(totalAttendance / attendance.length) : 0;

  const columns = [
    { header: t('date'), key: 'date', render: (row) => <span style={{ fontWeight: '500' }}>{new Date(row.service_date).toLocaleDateString()}</span> },
    { header: t('men'), key: 'men_count' },
    { header: t('women'), key: 'women_count' },
    { header: t('children'), key: 'children_count' },
    { header: t('total'), key: 'total', render: (row) => <span style={{ fontWeight: 'bold', color: '#6366f1' }}>{row.total_count}</span> },
    { header: t('offering'), key: 'offering', render: (row) => <span style={{ color: '#10b981' }}>XAF {row.total_offering?.toLocaleString()}</span> },
  ];

  return (
    <div>
      <PageHeader title={`📅 ${t('attendance')}`} subtitle={`${attendance.length} records`} actions={<Button onClick={() => openModal()}>➕ {t('recordAttendance')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={totalAttendance} icon="👥" />
        <StatCard label="Average" value={avgAttendance} icon="📊" color="#10b981" />
        <StatCard label={t('services')} value={attendance.length} icon="⛪" color="#f59e0b" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={attendance} onEdit={openModal} onDelete={setDeleteConfirm} />}
      </div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? `✏️ ${t('edit')}` : `➕ ${t('recordAttendance')}`}>
        <FormInput label={t('services')} type="select" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} options={services.map(s => ({ value: s.id, label: s.name }))} />
        <FormInput label={t('date')} type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <FormInput label={t('men')} type="number" value={form.men_count} onChange={(e) => setForm({ ...form, men_count: e.target.value })} />
          <FormInput label={t('women')} type="number" value={form.women_count} onChange={(e) => setForm({ ...form, women_count: e.target.value })} />
          <FormInput label={t('children')} type="number" value={form.children_count} onChange={(e) => setForm({ ...form, children_count: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('firstTimers')} type="number" value={form.first_timers_count} onChange={(e) => setForm({ ...form, first_timers_count: e.target.value })} />
          <FormInput label={`${t('offering')} (XAF)`} type="number" value={form.total_offering} onChange={(e) => setForm({ ...form, total_offering: e.target.value })} />
        </div>
        <FormInput label={t('weather')} type="select" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} options={[{ value: 'SUNNY', label: `☀️ ${t('sunny')}` }, { value: 'CLOUDY', label: `☁️ ${t('cloudy')}` }, { value: 'RAINY', label: `🌧️ ${t('rainy')}` }]} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message="Delete this record?" />
    </div>
  );
}

// ==========================================
// GIVING PAGE
// ==========================================
function GivingPage() {
  const { t } = useLanguage();
  const [donations, setDonations] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ member_id: '', amount: '', category_type: 'TITHE', donation_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', is_anonymous: false, notes: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => { setLoading(true); const [donationsData, membersData] = await Promise.all([supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'donation_date.desc' }), supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })]); setDonations(donationsData || []); setMembers(membersData || []); setLoading(false); };
  const resetForm = () => { setForm({ member_id: '', amount: '', category_type: 'TITHE', donation_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', is_anonymous: false, notes: '' }); setEditingDonation(null); };
  const openModal = (donation = null) => { if (donation) { setEditingDonation(donation); setForm({ member_id: donation.member_id || '', amount: donation.amount || '', category_type: donation.category_type || 'TITHE', donation_date: donation.donation_date || '', payment_method: donation.payment_method || 'CASH', is_anonymous: donation.is_anonymous || false, notes: donation.notes || '' }); } else { resetForm(); } setShowModal(true); };
  const handleSave = async () => { if (!form.amount || !form.donation_date) { alert('Amount and date required'); return; } setSaving(true); try { const data = { ...form, amount: parseFloat(form.amount), member_id: form.member_id || null }; if (editingDonation) { await supabaseUpdate('donations', editingDonation.id, data); } else { await supabaseInsert('donations', data); } setShowModal(false); resetForm(); fetchData(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('donations', deleteConfirm.id); setDeleteConfirm(null); fetchData(); };

  const total = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const byCategory = donations.reduce((acc, d) => { acc[d.category_type] = (acc[d.category_type] || 0) + d.amount; return acc; }, {});

  const columns = [
    { header: t('date'), key: 'date', render: (row) => new Date(row.donation_date).toLocaleDateString() },
    { header: t('category'), key: 'category', render: (row) => <StatusBadge status={row.category_type} /> },
    { header: t('amount'), key: 'amount', render: (row) => <span style={{ fontWeight: 'bold', color: '#10b981' }}>XAF {row.amount?.toLocaleString()}</span> },
    { header: t('paymentMethod'), key: 'method', render: (row) => row.payment_method },
  ];

  return (
    <div>
      <PageHeader title={`💰 ${t('giving')}`} subtitle={`${donations.length} donations`} actions={<Button onClick={() => openModal()}>➕ {t('recordDonation')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={`XAF ${total.toLocaleString()}`} icon="💰" color="#10b981" />
        <StatCard label={t('tithe')} value={`XAF ${(byCategory.TITHE || 0).toLocaleString()}`} icon="📿" color="#6366f1" />
        <StatCard label={t('offeringCat')} value={`XAF ${(byCategory.OFFERING || 0).toLocaleString()}`} icon="🎁" color="#f59e0b" />
        <StatCard label={t('missions')} value={`XAF ${(byCategory.MISSIONS || 0).toLocaleString()}`} icon="🌍" color="#3b82f6" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={donations} onEdit={openModal} onDelete={setDeleteConfirm} />}
      </div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingDonation ? `✏️ ${t('edit')}` : `➕ ${t('recordDonation')}`}>
        <FormInput label="Donor" type="select" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} options={members.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={`${t('amount')} (XAF)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <FormInput label={t('date')} type="date" value={form.donation_date} onChange={(e) => setForm({ ...form, donation_date: e.target.value })} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('category')} type="select" value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })} options={[{ value: 'TITHE', label: t('tithe') }, { value: 'OFFERING', label: t('offeringCat') }, { value: 'MISSIONS', label: t('missions') }, { value: 'THANKSGIVING', label: t('thanksgiving') }]} />
          <FormInput label={t('paymentMethod')} type="select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={[{ value: 'CASH', label: t('cash') }, { value: 'MOBILE_MONEY', label: t('mobileMoney') }, { value: 'BANK_TRANSFER', label: t('bankTransfer') }]} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_anonymous} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} /><span>{t('anonymous')}</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message="Delete this donation?" />
    </div>
  );
}

// ==========================================
// SALVATIONS PAGE
// ==========================================
function SalvationsPage() {
  const { t } = useLanguage();
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
  const handleSave = async () => { if (!form.full_name) { alert('Name required'); return; } setSaving(true); try { if (editingRecord) { await supabaseUpdate('salvations', editingRecord.id, form); } else { await supabaseInsert('salvations', form); } setShowModal(false); resetForm(); fetchSalvations(); } catch (error) { alert('Error: ' + error.message); } setSaving(false); };
  const handleDelete = async () => { if (!deleteConfirm) return; await supabaseDelete('salvations', deleteConfirm.id); setDeleteConfirm(null); fetchSalvations(); };

  const columns = [
    { header: t('name'), key: 'name', render: (row) => <span style={{ fontWeight: '500' }}>{row.full_name}</span> },
    { header: t('date'), key: 'date', render: (row) => new Date(row.salvation_date).toLocaleDateString() },
    { header: t('phone'), key: 'phone', render: (row) => <span style={{ color: '#6b7280' }}>{row.phone || '—'}</span> },
    { header: t('status'), key: 'status', render: (row) => <StatusBadge status={row.followup_status} /> },
  ];

  return (
    <div>
      <PageHeader title={`❤️ ${t('salvations')}`} subtitle={`${salvations.length} souls won`} actions={<Button onClick={() => openModal()}>➕ {t('recordSalvation')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={salvations.length} icon="❤️" color="#ef4444" />
        <StatCard label="This Month" value={salvations.filter(s => new Date(s.salvation_date) > new Date(Date.now() - 30*24*60*60*1000)).length} icon="📅" color="#6366f1" />
        <StatCard label="Pending" value={salvations.filter(s => s.followup_status === 'PENDING').length} icon="⏰" color="#f59e0b" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>{loading ? <LoadingSpinner /> : <DataTable columns={columns} data={salvations} onEdit={openModal} onDelete={setDeleteConfirm} />}</div>
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
function GroupsPage() {
  const { t } = useLanguage();
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
      <PageHeader title={`👨‍👩‍👧‍👦 ${t('groups')}`} subtitle={`${groups.length} ${t('groups')}`} actions={<Button onClick={() => openModal()}>➕ {t('createGroup')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={groups.length} icon="👥" />
        <StatCard label={t('active')} value={groups.filter(g => g.is_active).length} icon="✅" color="#10b981" />
        <StatCard label={t('cellGroup')} value={groups.filter(g => g.group_type === 'CELL').length} icon="🏠" color="#6366f1" />
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
              <div style={{ display: 'flex', gap: '8px' }}><StatusBadge status={group.group_type} />{group.is_active && <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>{t('active')}</span>}</div>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span>{t('active')}</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message={`Delete "${deleteConfirm?.name}"?`} />
    </div>
  );
}

// ==========================================
// PRAYERS PAGE
// ==========================================
function PrayersPage() {
  const { t } = useLanguage();
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
      <PageHeader title={`🙏 ${t('prayers')}`} subtitle={`${prayers.length} requests`} actions={<Button onClick={() => openModal()}>➕ {t('newRequest')}</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={prayers.length} icon="🙏" />
        <StatCard label={t('new')} value={prayers.filter(p => p.status === 'NEW').length} icon="🆕" color="#3b82f6" />
        <StatCard label={t('praying')} value={prayers.filter(p => p.status === 'PRAYING').length} icon="✨" color="#f59e0b" />
        <StatCard label={t('answered')} value={prayers.filter(p => p.status === 'ANSWERED').length} icon="✅" color="#10b981" />
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
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingPrayer ? `✏️ ${t('edit')}` : `➕ ${t('newRequest')}`}>
        <FormInput label={t('prayerTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <FormInput label={t('description')} type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <FormInput label={t('requesterName')} value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} placeholder="Optional" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('category')} type="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={[{ value: 'General', label: 'General' }, { value: 'Health', label: 'Health' }, { value: 'Family', label: 'Family' }, { value: 'Financial', label: 'Financial' }]} />
          <FormInput label={t('status')} type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'NEW', label: t('new') }, { value: 'PRAYING', label: t('praying') }, { value: 'ANSWERED', label: t('answered') }]} />
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message={`Delete "${deleteConfirm?.title}"?`} />
    </div>
  );
}

// ==========================================
// SERVICES PAGE
// ==========================================
function ServicesPage() {
  const { t } = useLanguage();
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
    { header: t('name'), key: 'name', render: (row) => <span style={{ fontWeight: '500' }}>{row.name}</span> },
    { header: t('meetingDay'), key: 'day', render: (row) => row.day_of_week },
    { header: t('meetingTime'), key: 'time', render: (row) => `${row.start_time} - ${row.end_time}` },
    { header: t('status'), key: 'status', render: (row) => row.is_active ? <span style={{ color: '#10b981' }}>✅ {t('active')}</span> : <span style={{ color: '#ef4444' }}>❌ {t('inactive')}</span> },
  ];

  return (
    <div>
      <PageHeader title={`⛪ ${t('services')}`} subtitle={`${services.length} ${t('services')}`} actions={<Button onClick={() => openModal()}>➕ {t('add')} Service</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('total')} value={services.length} icon="⛪" />
        <StatCard label={t('active')} value={services.filter(s => s.is_active).length} icon="✅" color="#10b981" />
        <StatCard label={t('sunday')} value={services.filter(s => s.day_of_week === 'SUNDAY').length} icon="📅" color="#6366f1" />
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>{loading ? <LoadingSpinner /> : <DataTable columns={columns} data={services} onEdit={openModal} onDelete={setDeleteConfirm} />}</div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingService ? `✏️ ${t('edit')}` : `➕ ${t('add')} Service`}>
        <FormInput label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <FormInput label={t('description')} type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <FormInput label={t('meetingDay')} type="select" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} options={[{ value: 'SUNDAY', label: t('sunday') }, { value: 'MONDAY', label: t('monday') }, { value: 'TUESDAY', label: t('tuesday') }, { value: 'WEDNESDAY', label: t('wednesday') }, { value: 'THURSDAY', label: t('thursday') }, { value: 'FRIDAY', label: t('friday') }, { value: 'SATURDAY', label: t('saturday') }]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><span>{t('active')}</span></label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button><Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title={`🗑️ ${t('delete')}`} message={`Delete "${deleteConfirm?.name}"?`} />
    </div>
  );
}

// ==========================================
// SETTINGS PAGE
// ==========================================
function SettingsPage() {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchChurch(); }, []);
  const fetchChurch = async () => { setLoading(true); const data = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }); setChurch(data); setLoading(false); };

  return (
    <div>
      <PageHeader title={`⚙️ ${t('settings')}`} subtitle="Manage your church settings" />
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Language Settings */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🌍 {t('language')}</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => changeLanguage('en')} style={{ padding: '12px 24px', border: language === 'en' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'en' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'en' ? '600' : '400' }}>🇬🇧 English</button>
              <button onClick={() => changeLanguage('fr')} style={{ padding: '12px 24px', border: language === 'fr' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'fr' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'fr' ? '600' : '400' }}>🇫🇷 Français</button>
            </div>
          </div>

          {/* Church Info */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>⛪ Church Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Church Name</label><p style={{ margin: 0, fontWeight: '500' }}>{church?.name}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Address</label><p style={{ margin: 0 }}>{church?.address}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>City</label><p style={{ margin: 0 }}>{church?.city}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{t('phone')}</label><p style={{ margin: 0 }}>{church?.phone}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{t('email')}</label><p style={{ margin: 0 }}>{church?.email}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Currency</label><p style={{ margin: 0 }}>{church?.currency}</p></div>
            </div>
          </div>

          {/* User Info */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>👤 Your Account</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{t('name')}</label><p style={{ margin: 0, fontWeight: '500' }}>{user?.name}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{t('email')}</label><p style={{ margin: 0 }}>{user?.email}</p></div>
              <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Role</label><p style={{ margin: 0 }}><StatusBadge status={user?.role} /></p></div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🔧 Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button variant="secondary">📤 Export Data</Button>
              <Button variant="secondary">📊 Generate Report</Button>
              <Button variant="danger" onClick={logout}>🚪 {t('signOut')}</Button>
            </div>
          </div>

          {/* App Info */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✝</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold' }}>ChurchSmart</h3>
            <p style={{ margin: 0, color: '#6b7280' }}>Version 2.0.0 • Connected to Supabase</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>Built with ❤️ for churches in Cameroon</p>
          </div>
        </div>
      )}
    </div>
  );
}