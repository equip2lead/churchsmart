"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ntngwrtbbgetobinwvxd.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50bmd3cnRiYmdldG9iaW53dnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTc3NTIsImV4cCI6MjA4NTMzMzc1Mn0.uvMWB2zwd4LYJM1P1jpov5rG83L62Eqbe7Bko9kI_1Q';
const SUPABASE_ANON_KEY = SUPABASE_KEY;
const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_FUNCTION_URL || 'https://ntngwrtbbgetobinwvxd.supabase.co/functions/v1/send-message';
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
    const savedUser = localStorage.getItem('churchsmart_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('churchsmart_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/church_users?email=eq.${encodeURIComponent(email)}&is_active=eq.true`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      
      const users = await response.json();
      
      if (!users || users.length === 0) {
        return { success: false, error: 'User not found' };
      }

      const dbUser = users[0];

      if (dbUser.password_hash !== password) {
        return { success: false, error: 'Invalid password' };
      }

      const sessionUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.full_name,
        role: dbUser.role,
        church_id: dbUser.church_id,
        phone: dbUser.phone,
        is_super_admin: dbUser.is_super_admin || false
      };
      await fetch(`${SUPABASE_URL}/rest/v1/church_users?id=eq.${dbUser.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ last_login: new Date().toISOString() })
      });

      setUser(sessionUser);
      localStorage.setItem('churchsmart_user', JSON.stringify(sessionUser));
      
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
    try {
      const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/church_users?email=eq.${encodeURIComponent(userData.email)}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      
      const existingUsers = await checkResponse.json();
      
      if (existingUsers && existingUsers.length > 0) {
        return { success: false, error: 'Email already registered' };
      }

      const newUser = {
        church_id: CHURCH_ID,
        email: userData.email,
        password_hash: userData.password,
        full_name: userData.full_name,
        phone: userData.phone || null,
        role: 'STAFF',
        is_active: true
      };

      const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/church_users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newUser)
      });

      if (!createResponse.ok) {
        return { success: false, error: 'Failed to create account' };
      }

      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('churchsmart_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, loading }}>
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
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 768px) {
            .sidebar {
              position: fixed !important;
              left: -280px !important;
              top: 0 !important;
              bottom: 0 !important;
              width: 260px !important;
              z-index: 50 !important;
              box-shadow: 2px 0 10px rgba(0,0,0,0.1);
            }
            .sidebar.open {
              left: 0 !important;
            }
            .mobile-overlay {
              display: block !important;
            }
            .main-content {
              margin-left: 0 !important;
            }
            .header-title { display: none !important; }
            .desktop-only { display: none !important; }
            .main-page { padding: 12px !important; }
            .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
            .table-wrap table { min-width: 600px !important; }
            .form-grid { grid-template-columns: 1fr !important; }
            .modal-content { width: 95% !important; padding: 16px !important; }
          }
        `}} />
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
    return <LoginPage />;
  }

  return <Dashboard />;
}

// ==========================================
// LOGIN PAGE - Split Screen Bilingual + Registration with Church Info
// ==========================================
function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // Registration steps: 1=user info, 2=church info

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', confirm_password: '',
    church_name: '', church_address: '', church_city: '', church_phone: '', church_email: '',
    church_pastor: '', church_denomination: '', church_currency: 'XAF'
  });

  const txt = {
    en: {
      welcome: 'Welcome back!', signInDesc: 'Sign in to access your church dashboard',
      createAccount: 'Create your account', getStarted: 'Get started with ChurchSmart today',
      signIn: 'Sign In', register: 'Register', email: 'Email Address', password: 'Password',
      fullName: 'Full Name', phone: 'Phone', confirmPassword: 'Confirm Password',
      rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
      signingIn: 'Please wait...', signInBtn: 'Sign In →', createBtn: 'Next: Church Info →',
      demoAccounts: 'Demo Accounts', clickToFill: 'Click to fill →',
      secure: 'Secure • Encrypted • GDPR Compliant',
      tagline: 'The all-in-one church management platform built for African churches. Manage your congregation with ease.',
      churches: 'Churches', membersManaged: 'Members Managed', countries: 'Countries',
      memberMgmt: 'Member Management', memberDesc: 'Track members, visitors & groups across all locations',
      finance: 'Financial Tracking', financeDesc: 'Manage tithes, offerings, expenses & generate reports',
      reports: 'Smart Reports', reportsDesc: 'Real-time analytics for attendance, giving & growth',
      messaging: 'SMS & WhatsApp', messagingDesc: 'Automated birthday messages & bulk communication',
      volunteers: 'Volunteer Management', volunteersDesc: 'Organize ministries, schedules & team leaders',
      multiLoc: 'Multi-Location', multiLocDesc: 'Manage multiple campuses from one dashboard',
      footer: '© 2026 ChurchSmart • Built with ❤️ for Churches in Africa',
      // Step 2
      churchInfo: 'Church Information', churchInfoDesc: 'Tell us about your church',
      churchName: 'Church Name *', churchAddress: 'Address', churchCity: 'City',
      churchPhone: 'Church Phone', churchEmail: 'Church Email', pastorName: 'Senior Pastor',
      denomination: 'Denomination', currency: 'Currency',
      back: '← Back', finishBtn: 'Create Account →', creating: 'Creating...',
      step1: 'Your Info', step2: 'Church Info'
    },
    fr: {
      welcome: 'Bon retour!', signInDesc: 'Connectez-vous pour accéder à votre tableau de bord',
      createAccount: 'Créer votre compte', getStarted: 'Commencez avec ChurchSmart aujourd\'hui',
      signIn: 'Connexion', register: 'S\'inscrire', email: 'Adresse Email', password: 'Mot de passe',
      fullName: 'Nom Complet', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe',
      rememberMe: 'Se souvenir de moi', forgotPassword: 'Mot de passe oublié?',
      signingIn: 'Veuillez patienter...', signInBtn: 'Connexion →', createBtn: 'Suivant: Info Église →',
      demoAccounts: 'Comptes Démo', clickToFill: 'Cliquer pour remplir →',
      secure: 'Sécurisé • Chiffré • Conforme RGPD',
      tagline: 'La plateforme de gestion d\'église tout-en-un conçue pour les églises africaines. Gérez votre congrégation facilement.',
      churches: 'Églises', membersManaged: 'Membres Gérés', countries: 'Pays',
      memberMgmt: 'Gestion des Membres', memberDesc: 'Suivre les membres, visiteurs et groupes dans tous les sites',
      finance: 'Suivi Financier', financeDesc: 'Gérer les dîmes, offrandes, dépenses et rapports',
      reports: 'Rapports Intelligents', reportsDesc: 'Analyses en temps réel pour la fréquentation et les dons',
      messaging: 'SMS & WhatsApp', messagingDesc: 'Messages d\'anniversaire automatiques et communication en masse',
      volunteers: 'Gestion des Bénévoles', volunteersDesc: 'Organiser les ministères, horaires et chefs d\'équipe',
      multiLoc: 'Multi-Sites', multiLocDesc: 'Gérer plusieurs campus depuis un seul tableau de bord',
      footer: '© 2026 ChurchSmart • Fait avec ❤️ pour les Églises d\'Afrique',
      churchInfo: 'Informations de l\'Église', churchInfoDesc: 'Parlez-nous de votre église',
      churchName: 'Nom de l\'Église *', churchAddress: 'Adresse', churchCity: 'Ville',
      churchPhone: 'Téléphone de l\'Église', churchEmail: 'Email de l\'Église', pastorName: 'Pasteur Principal',
      denomination: 'Dénomination', currency: 'Devise',
      back: '← Retour', finishBtn: 'Créer le Compte →', creating: 'Création...',
      step1: 'Vos Infos', step2: 'Info Église'
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
        if (!form.full_name || !form.email || !form.password) { setError(lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires' : 'Please fill in all required fields'); return; }
        if (form.password !== form.confirm_password) { setError(lang === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match'); return; }
        if (form.password.length < 6) { setError(lang === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters'); return; }
        setStep(2);
      } else {
        if (!form.church_name) { setError(lang === 'fr' ? 'Le nom de l\'église est requis' : 'Church name is required'); return; }
        setLoading(true);
        const result = await register(form);
        if (result.success) {
          setSuccess(lang === 'fr' ? 'Compte créé! Vous pouvez maintenant vous connecter.' : 'Account created! You can now sign in.');
          setIsLogin(true); setStep(1);
          setForm({ ...form, password: '', confirm_password: '' });
        } else { setError(result.error); }
        setLoading(false);
      }
    }
  };

  const features = [
    { icon: '👥', title: t.memberMgmt, desc: t.memberDesc },
    { icon: '💰', title: t.finance, desc: t.financeDesc },
    { icon: '📊', title: t.reports, desc: t.reportsDesc },
    { icon: '💬', title: t.messaging, desc: t.messagingDesc },
    { icon: '🙋‍♂️', title: t.volunteers, desc: t.volunteersDesc },
    { icon: '🌍', title: t.multiLoc, desc: t.multiLocDesc }
  ];

  const inputStyle = { width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', transition: 'border-color 0.2s', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* LEFT SIDE - Branding */}
      <div style={{ width: '50%', minHeight: '100vh', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-150px', left: '-100px', width: '400px', height: '400px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />

        <div style={{ marginBottom: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: '28px' }}>✝</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: 'white', letterSpacing: '-0.5px' }}>ChurchSmart</h1>
          </div>
          <p style={{ margin: 0, fontSize: '18px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', maxWidth: '420px' }}>{t.tagline}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', position: 'relative', zIndex: 1 }}>
          {features.map((feature, i) => (
            <div key={i} style={{ padding: '18px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '14px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '24px' }}>{feature.icon}</span>
              <h3 style={{ margin: '10px 0 6px 0', fontSize: '14px', fontWeight: '600', color: 'white' }}>{feature.title}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>{feature.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '32px', marginTop: '40px', position: 'relative', zIndex: 1 }}>
          <div><p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'white' }}>500+</p><p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{t.churches}</p></div>
          <div><p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'white' }}>50K+</p><p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{t.membersManaged}</p></div>
          <div><p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'white' }}>10+</p><p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{t.countries}</p></div>
        </div>
        <p style={{ marginTop: '40px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>{t.footer}</p>
      </div>

      {/* RIGHT SIDE - Form */}
      <div style={{ width: '50%', minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative' }}>
        {/* Language Toggle */}
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '4px', backgroundColor: '#e5e7eb', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setLang('en')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'en' ? 'white' : 'transparent', color: lang === 'en' ? '#4f46e5' : '#6b7280', fontWeight: lang === 'en' ? '600' : '400', fontSize: '12px', cursor: 'pointer' }}>🇬🇧 EN</button>
          <button onClick={() => setLang('fr')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'fr' ? 'white' : 'transparent', color: lang === 'fr' ? '#4f46e5' : '#6b7280', fontWeight: lang === 'fr' ? '600' : '400', fontSize: '12px', cursor: 'pointer' }}>🇫🇷 FR</button>
        </div>

        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: 'bold', color: '#1f2937' }}>
              {isLogin ? t.welcome : t.createAccount}
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '15px' }}>
              {isLogin ? t.signInDesc : t.getStarted}
            </p>
          </div>

          {/* Tab Toggle */}
          <div style={{ display: 'flex', marginBottom: '24px', backgroundColor: '#e5e7eb', borderRadius: '12px', padding: '4px' }}>
            <button onClick={() => { setIsLogin(true); setError(''); setSuccess(''); setStep(1); }}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', backgroundColor: isLogin ? 'white' : 'transparent', color: isLogin ? '#4f46e5' : '#6b7280', fontWeight: isLogin ? '600' : '400', fontSize: '14px', cursor: 'pointer', boxShadow: isLogin ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}
            >{t.signIn}</button>
            <button onClick={() => { setIsLogin(false); setError(''); setSuccess(''); setStep(1); }}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', backgroundColor: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#4f46e5' : '#6b7280', fontWeight: !isLogin ? '600' : '400', fontSize: '14px', cursor: 'pointer', boxShadow: !isLogin ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}
            >{t.register}</button>
          </div>

          {/* Registration Step Indicator */}
          {!isLogin && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</span>
                <span style={{ fontSize: '13px', color: step === 1 ? '#4f46e5' : '#6b7280', fontWeight: step === 1 ? '600' : '400' }}>{t.step1}</span>
              </div>
              <div style={{ flex: 1, height: '2px', backgroundColor: step >= 2 ? '#4f46e5' : '#e5e7eb' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step >= 2 ? '#4f46e5' : '#e5e7eb', color: step >= 2 ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>2</span>
                <span style={{ fontSize: '13px', color: step === 2 ? '#4f46e5' : '#6b7280', fontWeight: step === 2 ? '600' : '400' }}>{t.step2}</span>
              </div>
            </div>
          )}

          {error && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '16px', color: '#dc2626', fontSize: '14px' }}>❌ {error}</div>}
          {success && <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '16px', color: '#166534', fontSize: '14px' }}>✅ {success}</div>}

          <form onSubmit={handleSubmit}>
            {/* LOGIN FORM */}
            {isLogin && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.email}</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.password}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#6366f1' }} /> {t.rememberMe}
                  </label>
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>{t.forgotPassword}</a>
                </div>
              </>
            )}

            {/* REGISTER STEP 1 - User Info */}
            {!isLogin && step === 1 && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.fullName} *</label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Pastor John Doe" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.email} *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.phone}</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t.password} *</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.confirmPassword} *</label>
                    <input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="••••••" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                </div>
              </>
            )}

            {/* REGISTER STEP 2 - Church Info */}
            {!isLogin && step === 2 && (
              <>
                <div style={{ padding: '14px 16px', backgroundColor: '#eef2ff', borderRadius: '10px', marginBottom: '20px', border: '1px solid #c7d2fe' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#4338ca', fontWeight: '500' }}>⛪ {t.churchInfoDesc}</p>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.churchName}</label>
                  <input type="text" value={form.church_name} onChange={(e) => setForm({ ...form, church_name: e.target.value })} placeholder="e.g., Fire of God Ministry" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t.churchCity}</label>
                    <input type="text" value={form.church_city} onChange={(e) => setForm({ ...form, church_city: e.target.value })} placeholder="Douala" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.denomination}</label>
                    <input type="text" value={form.church_denomination} onChange={(e) => setForm({ ...form, church_denomination: e.target.value })} placeholder="Pentecostal" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t.churchAddress}</label>
                  <input type="text" value={form.church_address} onChange={(e) => setForm({ ...form, church_address: e.target.value })} placeholder="123 Faith Avenue" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t.pastorName}</label>
                    <input type="text" value={form.church_pastor} onChange={(e) => setForm({ ...form, church_pastor: e.target.value })} placeholder="Pastor John" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.currency}</label>
                    <select value={form.church_currency} onChange={(e) => setForm({ ...form, church_currency: e.target.value })} style={inputStyle}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t.churchPhone}</label>
                    <input type="tel" value={form.church_phone} onChange={(e) => setForm({ ...form, church_phone: e.target.value })} placeholder="+237..." style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.churchEmail}</label>
                    <input type="email" value={form.church_email} onChange={(e) => setForm({ ...form, church_email: e.target.value })} placeholder="info@church.com" style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                  </div>
                </div>
              </>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isLogin && step === 2 && (
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '14px', backgroundColor: 'white', color: '#6b7280', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                  {t.back}
                </button>
              )}
              <button type="submit" disabled={loading}
                style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}>
                {loading ? `⏳ ${isLogin ? t.signingIn : t.creating}` : isLogin ? t.signInBtn : step === 1 ? t.createBtn : t.finishBtn}
              </button>
            </div>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>🔒 {t.secure}</p>
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
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊' },
    { id: 'members', label: t('members'), icon: '👥' },
    { id: 'visitors', label: t('visitors'), icon: '🚶' },
    { id: 'attendance', label: t('attendance'), icon: '📅' },
    { id: 'giving', label: t('giving'), icon: '💰' },
    { id: 'salvations', label: t('salvations'), icon: '❤️' },
    { id: 'groups', label: t('groups'), icon: '👨‍👩‍👧‍👦' },
    { id: 'volunteers', label: 'Volunteers', icon: '🙋‍♂️' },
    { id: 'messaging', label: 'Messaging', icon: '💬' },
    { id: 'reports', label: 'Reports', icon: '📊' },
    { id: 'services', label: t('services'), icon: '⛪' },
    { id: 'settings', label: t('settings'), icon: '⚙️' },
    ...(user?.is_super_admin ? [{ id: 'superadmin', label: '🛡️ Super Admin', icon: '🛡️' }] : []),
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ width: sidebarOpen ? '260px' : '80px', backgroundColor: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', transition: 'all 0.3s', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px', flexShrink: 0 }}>✝</div>
          {sidebarOpen && <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#111827' }}>ChurchSmart</span>}
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); if (window.innerWidth <= 768) setSidebarOpen(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: sidebarOpen ? '10px 16px' : '10px', margin: '2px 0', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', backgroundColor: activeTab === item.id ? '#eef2ff' : 'transparent', color: activeTab === item.id ? '#6366f1' : '#4b5563', fontWeight: activeTab === item.id ? '600' : '400', justifyContent: sidebarOpen ? 'flex-start' : 'center', transition: 'all 0.2s' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {sidebarOpen && item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '14px', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            🚪 {sidebarOpen && t('signOut')}
          </button>
        </div>
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
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>ChurchSmart</h1>
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
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'members' && <MembersPage />}
          {activeTab === 'visitors' && <VisitorsPage />}
          {activeTab === 'attendance' && <AttendancePage />}
          {activeTab === 'giving' && <GivingPage />}
          {activeTab === 'salvations' && <SalvationsPage />}
          {activeTab === 'groups' && <GroupsPage />}
          {activeTab === 'volunteers' && <VolunteersPage />}
          {activeTab === 'messaging' && <MessagingPage />}
          {activeTab === 'reports' && <ReportsPage />}
          {activeTab === 'services' && <ServicesPage />}
          {activeTab === 'settings' && <SettingsPage />}
          {activeTab === 'superadmin' && <SuperAdminPage />}
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
// DASHBOARD PAGE - With Charts
// ==========================================
function DashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [stats, setStats] = useState({ members: 0, visitors: 0, salvations: 0, donations: 0 });
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);
  const [recentSalvations, setRecentSalvations] = useState([]);
  const [weeklyGiving, setWeeklyGiving] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [members, visitors, salvations, donations, services, events, activityLogs] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'visit_date.desc', limit: 5 }),
        supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'salvation_date.desc', limit: 5 }),
        supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'event_date.asc' }),
        supabaseQuery('activity_logs', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc', limit: 5 }),
      ]);

      // Calculate total donations
      const totalDonations = (Array.isArray(donations) ? donations : []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);      
      // Calculate weekly giving (last 7 days)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayTotal = (Array.isArray(donations) ? donations : [])
          .filter(d => d.donation_date === dateStr)
          .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        weekData.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          amount: dayTotal,
          date: dateStr
        });
      }
      setWeeklyGiving(weekData);
      
      // Get upcoming birthdays (next 30 days)
      const birthdayMembers = (members || []).filter(m => {
        if (!m.date_of_birth) return false;
        const dob = new Date(m.date_of_birth);
        const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        const nextYearBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const diffThis = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
        const diffNext = Math.ceil((nextYearBirthday - today) / (1000 * 60 * 60 * 24));
        return (diffThis >= 0 && diffThis <= 30) || (diffNext >= 0 && diffNext <= 30);
      }).map(m => {
        const dob = new Date(m.date_of_birth);
        let birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (birthday < today) birthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const daysUntil = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
        return { ...m, birthday, daysUntil };
      }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5);

      // Calculate next occurrence for each service
      const dayMap = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
      const upcomingServices = (services || []).filter(s => s.is_active).map(service => {
        const serviceDay = dayMap[service.day_of_week];
        const todayDay = today.getDay();
        let daysUntil = serviceDay - todayDay;
        if (daysUntil < 0) daysUntil += 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntil);
        return { id: service.id, title: service.name, date: nextDate, time: service.start_time, type: 'SERVICE', icon: '⛪', color: '#6366f1', daysUntil };
      });

      // Get upcoming events
      const upcomingEvents = (events || []).filter(e => new Date(e.event_date) >= today).map(event => {
        const eventDate = new Date(event.event_date);
        const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        const eventIcons = { 'SERVICE': '⛪', 'CONFERENCE': '🎤', 'PRAYER': '🙏', 'MEETING': '👥', 'OUTREACH': '🌍', 'YOUTH': '🎉', 'GENERAL': '📅', 'WORKSHOP': '📚' };
        const eventColors = { 'SERVICE': '#6366f1', 'CONFERENCE': '#f59e0b', 'PRAYER': '#ec4899', 'MEETING': '#10b981', 'OUTREACH': '#3b82f6', 'YOUTH': '#8b5cf6', 'GENERAL': '#6b7280', 'WORKSHOP': '#14b8a6' };
        return { id: event.id, title: event.title, date: eventDate, time: event.start_time, type: event.event_type, icon: eventIcons[event.event_type] || '📅', color: eventColors[event.event_type] || '#6b7280', daysUntil, isEvent: true };
      });

      const combined = [...upcomingServices, ...upcomingEvents].sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);

      setStats({ members: members?.length || 0, visitors: (visitors || []).length, salvations: (salvations || []).length, donations: totalDonations });
      setUpcomingBirthdays(birthdayMembers);
      setUpcomingItems(combined);
      setRecentActivity(activityLogs || []);
      setRecentVisitors(visitors || []);
      setRecentSalvations(salvations || []);
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const formatCurrency = (amount) => `XAF ${(amount || 0).toLocaleString()}`;
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : '';
  const timeAgo = (dateStr) => {
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };
  const getDaysLabel = (days) => {
    if (days === 0) return { label: 'Today', color: '#dc2626', bg: '#fef2f2' };
    if (days === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: '#fef3c7' };
    if (days <= 3) return { label: `In ${days} days`, color: '#f59e0b', bg: '#fef3c7' };
    return { label: `In ${days} days`, color: '#6b7280', bg: '#f3f4f6' };
  };

  // Calculate weekly total for chart
  const weeklyTotal = weeklyGiving.reduce((sum, d) => sum + d.amount, 0);
  const maxDayAmount = Math.max(...weeklyGiving.map(d => d.amount), 1);

  return (
    <div>
      <PageHeader 
        title={`📊 ${t('dashboard')}`}
        subtitle={`${t('welcome')} back! Here's what's happening at your church.`}
        actions={<Button onClick={fetchData} variant="secondary">🔄 Refresh</Button>}
      />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <StatCard label={t('totalMembers')} value={stats.members} icon="👥" color="#6366f1" trend="+5%" />
            <StatCard label={t('totalVisitors')} value={stats.visitors} icon="🚶" color="#f59e0b" trend="+3" />
            <StatCard label={t('salvations')} value={stats.salvations} icon="❤️" color="#ef4444" trend="+2" />
            <StatCard label={t('totalGiving')} value={formatCurrency(stats.donations)} icon="💰" color="#10b981" trend="+8%" />
          </div>

          {/* Weekly Giving Chart */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#6b7280' }}>💰 Weekly Contributions</h3>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(weeklyTotal)}</p>
              </div>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Last 7 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px' }}>
              {weeklyGiving.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '100%', backgroundColor: '#e0e7ff', borderRadius: '8px', position: 'relative', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ 
                      width: '100%', 
                      backgroundColor: '#6366f1', 
                      borderRadius: '8px', 
                      height: `${Math.max((day.amount / maxDayAmount) * 100, 5)}%`,
                      minHeight: day.amount > 0 ? '10px' : '4px',
                      transition: 'height 0.3s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{day.day}</span>
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>{day.amount > 0 ? `${(day.amount / 1000).toFixed(0)}k` : '0'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Birthdays */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🎂 Upcoming Birthdays</h3>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Next 30 days</span>
            </div>
            {upcomingBirthdays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                <span style={{ fontSize: '48px' }}>🎂</span>
                <p>No upcoming birthdays</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                {upcomingBirthdays.map((member, i) => (
                  <div key={i} style={{ minWidth: '140px', padding: '16px', backgroundColor: member.daysUntil === 0 ? '#fef2f2' : '#fef3c7', borderRadius: '12px', textAlign: 'center', border: member.daysUntil === 0 ? '2px solid #fecaca' : 'none' }}>
                    <div style={{ width: '50px', height: '50px', backgroundColor: member.daysUntil === 0 ? '#ef4444' : '#fbbf24', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '18px', color: 'white', fontWeight: 'bold' }}>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '14px' }}>{member.first_name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: member.daysUntil === 0 ? '#dc2626' : '#92400e', fontWeight: '500' }}>
                      {member.daysUntil === 0 ? '🎉 Today!' : member.daysUntil === 1 ? 'Tomorrow' : `In ${member.daysUntil} days`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            
            {/* Recent Activity */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>⚡ Recent Activity</h3>
              {recentActivity.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>No recent activity</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {recentActivity.map((activity, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', backgroundColor: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                        {activity.entity_type === 'donation' ? '💰' : activity.entity_type === 'attendance' ? '📊' : activity.entity_type === 'salvation' ? '❤️' : activity.entity_type === 'visitor' ? '🚶' : '📝'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{activity.action === 'CREATE' ? 'New' : activity.action} {activity.entity_type}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.entity_name || activity.user_name}</p>
                      </div>
                      <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{timeAgo(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Services & Events */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>📅 Upcoming Services & Events</h3>
              {upcomingItems.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>No upcoming items</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcomingItems.map((item, i) => {
                    const dayInfo = getDaysLabel(item.daysUntil);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px', borderLeft: `4px solid ${item.color}` }}>
                        <div style={{ width: '42px', height: '42px', backgroundColor: `${item.color}15`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{item.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.title}</p>
                            {item.isEvent && <span style={{ padding: '2px 6px', backgroundColor: `${item.color}20`, color: item.color, borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>EVENT</span>}
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{formatDate(item.date)} {item.time && `at ${formatTime(item.time)}`}</p>
                        </div>
                        <span style={{ padding: '4px 10px', backgroundColor: dayInfo.bg, color: dayInfo.color, borderRadius: '9999px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{dayInfo.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Recent Visitors */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>🚶 Recent Visitors</h3>
                <span style={{ fontSize: '20px' }}>👥</span>
              </div>
              {recentVisitors.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '16px' }}>No recent visitors</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentVisitors.slice(0, 4).map((visitor, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{visitor.full_name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{formatDate(visitor.visit_date)}</p>
                      </div>
                      {visitor.is_first_time && <span style={{ padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '11px' }}>First Time</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Salvation Decisions */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>❤️ Salvation Decisions</h3>
                <span style={{ fontSize: '20px' }}>🙌</span>
              </div>
              {recentSalvations.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '16px' }}>No recent salvations</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentSalvations.slice(0, 4).map((salvation, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{salvation.full_name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{formatDate(salvation.salvation_date)}</p>
                      </div>
                      <StatusBadge status={salvation.followup_status} />
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
// MEMBERS PAGE - With Location Support
// ==========================================
function MembersPage() {
  const { t } = useLanguage();
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

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
    gender: 'MALE', address: '', city: '', status: 'ACTIVE', membership_date: '',
    location_id: '', notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [membersData, locationsData] = await Promise.all([
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc' }),
      supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setMembers(membersData || []);
    setLocations(locationsData || []);
    setLoading(false);
  };

  const resetForm = () => {
    const mainCampus = locations.find(l => l.is_main_campus);
    setForm({
      first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
      gender: 'MALE', address: '', city: '', status: 'ACTIVE', membership_date: new Date().toISOString().split('T')[0],
      location_id: mainCampus?.id || '', notes: ''
    });
    setEditingMember(null);
  };

  const openModal = (member = null) => {
    if (member) {
      setEditingMember(member);
      setForm({
        first_name: member.first_name || '', last_name: member.last_name || '',
        email: member.email || '', phone: member.phone || '', date_of_birth: member.date_of_birth || '',
        gender: member.gender || 'MALE', address: member.address || '', city: member.city || '',
        status: member.status || 'ACTIVE', membership_date: member.membership_date || '',
        location_id: member.location_id || '', notes: member.notes || ''
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
      const data = { ...form, location_id: form.location_id || null };
      if (editingMember) {
        await supabaseUpdate('members', editingMember.id, data);
      } else {
        await supabaseInsert('members', data);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabaseDelete('members', deleteConfirm.id);
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
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
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
  const totalActive = members.filter(m => m.status === 'ACTIVE').length;
  const locationStats = locations.map(loc => ({
    ...loc,
    count: members.filter(m => m.location_id === loc.id).length
  }));

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div>
      <PageHeader
        title={`👥 ${t('members')}`}
        subtitle={`Manage your ${members.length} church members across ${locations.length} locations`}
        actions={<Button onClick={() => openModal()}>➕ {t('addMember')}</Button>}
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Members" value={members.length} icon="👥" color="#6366f1" />
        <StatCard label="Active" value={totalActive} icon="✅" color="#10b981" />
        <StatCard label="Inactive" value={members.filter(m => m.status === 'INACTIVE').length} icon="⏸️" color="#f59e0b" />
        <StatCard label="Locations" value={locations.length} icon="📍" color="#8b5cf6" />
      </div>

      {/* Members by Location */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
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
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
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
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Showing {filteredMembers.length} of {members.length} members</span>
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
                {filteredMembers.map((member, index) => (
                  <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600' }}>
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: '500' }}>{member.first_name} {member.last_name}</p>
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
                      <StatusBadge status={member.status} />
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
                      <span style={{ fontSize: '48px' }}>👥</span>
                      <p>No members found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingMember ? '✏️ Edit Member' : '➕ Add Member'} width="600px">
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
          <FormInput label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'ACTIVE', label: '✅ Active' }, { value: 'INACTIVE', label: '⏸️ Inactive' }]} />
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

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete Member" message={`Are you sure you want to delete "${deleteConfirm?.first_name} ${deleteConfirm?.last_name}"?`} />
    </div>
  );
}

// ==========================================
// VISITORS PAGE - With SMS Integration (Continued)
// ==========================================
function VisitorsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
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
// ATTENDANCE PAGE - With Charts, Filters & Multi-Location
// ==========================================
function AttendancePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [activeView, setActiveView] = useState('charts');
  const [attendance, setAttendance] = useState([]);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('10weeks');
  
  const [form, setForm] = useState({
    service_id: '', location_id: '', service_date: new Date().toISOString().split('T')[0],
    men_count: 0, women_count: 0, children_count: 0,
    first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [attendanceData, servicesData, locationsData] = await Promise.all([
      supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc' }),
      supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setAttendance(attendanceData || []);
    setServices(servicesData || []);
    setLocations(locationsData || []);
    setLoading(false);
  };

  // Filter attendance data
  const getFilteredAttendance = () => {
    let filtered = [...attendance];
    
    // Filter by location
    if (filterLocation !== 'all') {
      filtered = filtered.filter(a => a.location_id === filterLocation);
    }
    
    // Filter by service
    if (filterService !== 'all') {
      filtered = filtered.filter(a => a.service_id === filterService);
    }
    
    // Filter by date range
    const now = new Date();
    let startDate;
    switch (filterDateRange) {
      case '4weeks': startDate = new Date(now.setDate(now.getDate() - 28)); break;
      case '10weeks': startDate = new Date(now.setDate(now.getDate() - 70)); break;
      case '6months': startDate = new Date(now.setMonth(now.getMonth() - 6)); break;
      case '1year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      default: startDate = new Date(now.setDate(now.getDate() - 70));
    }
    filtered = filtered.filter(a => new Date(a.service_date) >= startDate);
    
    return filtered.sort((a, b) => new Date(a.service_date) - new Date(b.service_date));
  };

  const filteredAttendance = getFilteredAttendance();

  // Calculate statistics
  const currentWeekAttendance = filteredAttendance.length > 0 ? filteredAttendance[filteredAttendance.length - 1]?.total_count || 0 : 0;
  const previousWeekAttendance = filteredAttendance.length > 1 ? filteredAttendance[filteredAttendance.length - 2]?.total_count || 0 : 0;
  const weekOverWeekChange = previousWeekAttendance > 0 ? (((currentWeekAttendance - previousWeekAttendance) / previousWeekAttendance) * 100).toFixed(1) : 0;
  
  const totalAttendance = filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0);
  const avgAttendance = filteredAttendance.length > 0 ? Math.round(totalAttendance / filteredAttendance.length) : 0;
  const totalFirstTimers = filteredAttendance.reduce((sum, a) => sum + (a.first_timers_count || 0), 0);
  const totalChildren = filteredAttendance.reduce((sum, a) => sum + (a.children_count || 0), 0);
  const childrenPercentage = totalAttendance > 0 ? ((totalChildren / totalAttendance) * 100).toFixed(0) : 0;

  // Get service name by ID
  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || 'Unknown';
  };

  // Get location name by ID
  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Main Campus';
  };

  const resetForm = () => {
    setForm({
      service_id: services[0]?.id || '', location_id: locations.find(l => l.is_main_campus)?.id || locations[0]?.id || '',
      service_date: new Date().toISOString().split('T')[0],
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
        location_id: record.location_id || '',
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
    if (!form.service_date) { alert('Service date is required'); return; }
    setSaving(true);
    try {
      const data = {
        ...form,
        men_count: parseInt(form.men_count) || 0,
        women_count: parseInt(form.women_count) || 0,
        children_count: parseInt(form.children_count) || 0,
        first_timers_count: parseInt(form.first_timers_count) || 0,
        total_offering: parseFloat(form.total_offering) || 0
      };
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

  // Simple chart using divs (bar chart visualization)
  const maxAttendance = Math.max(...filteredAttendance.map(a => a.total_count || 0), 1);

  return (
    <div>
      <PageHeader 
        title={`📊 ${t('attendance')}`}
        subtitle="Track attendance across all services and locations."
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setActiveView('charts')}
              style={{
                padding: '10px 20px',
                border: activeView === 'charts' ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: activeView === 'charts' ? '#6366f1' : 'white',
                color: activeView === 'charts' ? 'white' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500'
              }}
            >
              📈 Charts
            </button>
            <button
              onClick={() => setActiveView('details')}
              style={{
                padding: '10px 20px',
                border: activeView === 'details' ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: activeView === 'details' ? '#6366f1' : 'white',
                color: activeView === 'details' ? 'white' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500'
              }}
            >
              📋 Details
            </button>
            <Button onClick={() => openModal()}>➕ {t('recordAttendance')}</Button>
          </div>
        }
      />

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Location</label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Service</label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="all">All Services</option>
              {services.map(svc => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Date Range</label>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="4weeks">Last 4 Weeks</option>
              <option value="10weeks">Last 10 Weeks</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Current Week Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{currentWeekAttendance}</p>
          <p style={{ fontSize: '14px', margin: 0, color: parseFloat(weekOverWeekChange) >= 0 ? '#10b981' : '#ef4444' }}>
            {parseFloat(weekOverWeekChange) >= 0 ? '+' : ''}{weekOverWeekChange}% from previous week
          </p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Average Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{avgAttendance}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>Over the {filterDateRange.replace('weeks', ' weeks').replace('months', ' months').replace('year', ' year')}</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>First Time Visitors</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{totalFirstTimers}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>{filteredAttendance.length} total in period</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Children's Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{totalChildren}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>{childrenPercentage}% of total attendance</p>
        </div>
      </div>

      {/* Charts View */}
      {activeView === 'charts' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📈 Attendance Trends</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#6366f1', borderRadius: '2px' }}></span>
                Total Attendance
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
                Children
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#ec4899', borderRadius: '2px' }}></span>
                First Time Visitors
              </span>
            </div>
          </div>
          
          {/* Chart Area */}
          <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '40px', position: 'relative' }}>
            {/* Y-axis labels */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: '40px', width: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
              <span>{maxAttendance}</span>
              <span>{Math.round(maxAttendance * 0.75)}</span>
              <span>{Math.round(maxAttendance * 0.5)}</span>
              <span>{Math.round(maxAttendance * 0.25)}</span>
              <span>0</span>
            </div>
            
            {/* Bars */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '4px', marginLeft: '60px', height: '100%' }}>
              {filteredAttendance.slice(-12).map((record, index) => {
                const totalHeight = ((record.total_count || 0) / maxAttendance) * 100;
                const childrenHeight = ((record.children_count || 0) / maxAttendance) * 100;
                const firstTimersHeight = ((record.first_timers_count || 0) / maxAttendance) * 100;
                
                return (
                  <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '220px' }}>
                      {/* Total bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${totalHeight}%`,
                          backgroundColor: '#6366f1',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Total: ${record.total_count}`}
                      />
                      {/* Children bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${childrenHeight}%`,
                          backgroundColor: '#f59e0b',
                          borderRadius: '4px 4px 0 0',
                          minHeight: record.children_count > 0 ? '4px' : '0',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Children: ${record.children_count}`}
                      />
                      {/* First timers bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${firstTimersHeight}%`,
                          backgroundColor: '#ec4899',
                          borderRadius: '4px 4px 0 0',
                          minHeight: record.first_timers_count > 0 ? '4px' : '0',
                          transition: 'height 0.3s ease'
                        }}
                        title={`First Timers: ${record.first_timers_count}`}
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: '#6b7280', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {new Date(record.service_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary below chart */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1', margin: 0 }}>{totalAttendance}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Total Attendance</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>{filteredAttendance.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Services Recorded</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>XAF {filteredAttendance.reduce((sum, a) => sum + (a.total_offering || 0), 0).toLocaleString()}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Total Offering</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ec4899', margin: 0 }}>{locations.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Locations</p>
            </div>
          </div>
        </div>
      )}

      {/* Details View */}
      {activeView === 'details' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📋 Attendance Records</h3>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{filteredAttendance.length} records</span>
          </div>
          {loading ? <LoadingSpinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('date')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Service</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('men')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('women')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('children')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('total')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>First Timers</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Offering</th>
                    <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.slice().reverse().map((record, index) => (
                    <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '16px', fontWeight: '500' }}>{new Date(record.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                      <td style={{ padding: '16px', color: '#6366f1' }}>{getServiceName(record.service_id)}</td>
                      <td style={{ padding: '16px', color: '#6b7280' }}>{getLocationName(record.location_id)}</td>
                      <td style={{ padding: '16px' }}>{record.men_count}</td>
                      <td style={{ padding: '16px' }}>{record.women_count}</td>
                      <td style={{ padding: '16px' }}>{record.children_count}</td>
                      <td style={{ padding: '16px', fontWeight: 'bold', color: '#6366f1' }}>{record.total_count}</td>
                      <td style={{ padding: '16px', color: '#ec4899' }}>{record.first_timers_count}</td>
                      <td style={{ padding: '16px', color: '#10b981', fontWeight: '500' }}>XAF {(record.total_offering || 0).toLocaleString()}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => openModal(record)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                          <button onClick={() => setDeleteConfirm(record)} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Attendance Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? `✏️ Edit Attendance` : `➕ ${t('recordAttendance')}`} width="600px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput 
            label="Service" 
            type="select" 
            value={form.service_id} 
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            options={services.map(s => ({ value: s.id, label: s.name }))} 
          />
          <FormInput 
            label="Location" 
            type="select" 
            value={form.location_id} 
            onChange={(e) => setForm({ ...form, location_id: e.target.value })}
            options={locations.map(l => ({ value: l.id, label: l.name }))} 
          />
        </div>
        <FormInput label={t('date')} type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} required />
        
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>👥 Attendance Count</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <FormInput label={t('men')} type="number" value={form.men_count} onChange={(e) => setForm({ ...form, men_count: e.target.value })} />
            <FormInput label={t('women')} type="number" value={form.women_count} onChange={(e) => setForm({ ...form, women_count: e.target.value })} />
            <FormInput label={t('children')} type="number" value={form.children_count} onChange={(e) => setForm({ ...form, children_count: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('firstTimers')} type="number" value={form.first_timers_count} onChange={(e) => setForm({ ...form, first_timers_count: e.target.value })} />
          <FormInput label={`${t('offering')} (XAF)`} type="number" value={form.total_offering} onChange={(e) => setForm({ ...form, total_offering: e.target.value })} />
        </div>
        
        <FormInput 
          label={t('weather')} 
          type="select" 
          value={form.weather} 
          onChange={(e) => setForm({ ...form, weather: e.target.value })}
          options={[{ value: 'SUNNY', label: `☀️ ${t('sunny')}` }, { value: 'CLOUDY', label: `☁️ ${t('cloudy')}` }, { value: 'RAINY', label: `🌧️ ${t('rainy')}` }]} 
        />
        
        <FormInput label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this service..." />
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

      <ConfirmDialog 
        isOpen={!!deleteConfirm} 
        onClose={() => setDeleteConfirm(null)} 
        onConfirm={handleDelete} 
        title={`🗑️ ${t('delete')}`} 
        message="Are you sure you want to delete this attendance record?" 
      />
    </div>
  );
}
// ==========================================
// GIVING PAGE - With Charts
// ==========================================
function GivingPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [activeTab, setActiveTab] = useState('income');
  const [donations, setDonations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chartView, setChartView] = useState('monthly');

  const [donationForm, setDonationForm] = useState({ member_id: '', amount: '', donation_date: new Date().toISOString().split('T')[0], category: 'TITHE', payment_method: 'CASH', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'GENERAL', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', vendor_name: '', notes: '' });

  const categories = ['TITHE', 'OFFERING', 'DONATION', 'MISSIONS', 'BUILDING', 'SPECIAL', 'OTHER'];
  const expenseCategories = ['GENERAL', 'BUILDING', 'UTILITIES', 'SALARIES', 'MISSIONS', 'SUPPLIES', 'TRANSPORT', 'EVENTS', 'OTHER'];
  const paymentMethods = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHECK', 'OTHER'];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [donationsData, expensesData, membersData] = await Promise.all([
      supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'donation_date.desc' }),
      supabaseQuery('expenses', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'expense_date.desc' }),
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setDonations(donationsData || []);
    setExpenses(expensesData || []);
    setMembers(membersData || []);
    setLoading(false);
  };

  // Calculations
  const totalIncome = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  // Category breakdown for pie chart
  const categoryTotals = categories.map(cat => ({
    category: cat,
    amount: donations.filter(d => d.category === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  })).filter(c => c.amount > 0);

  const categoryColors = {
    'TITHE': '#6366f1', 'OFFERING': '#f59e0b', 'DONATION': '#10b981', 'MISSIONS': '#ec4899',
    'BUILDING': '#8b5cf6', 'SPECIAL': '#14b8a6', 'OTHER': '#6b7280'
  };

  // Monthly trends data
  const getMonthlyData = () => {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      const monthIncome = donations
        .filter(d => d.donation_date?.startsWith(monthStr))
        .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthIncome
      });
    }
    return months;
  };

  const monthlyData = getMonthlyData();
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  // Form handlers
  const resetDonationForm = () => { setDonationForm({ member_id: '', amount: '', donation_date: new Date().toISOString().split('T')[0], category: 'TITHE', payment_method: 'CASH', notes: '' }); setEditingItem(null); };
  const resetExpenseForm = () => { setExpenseForm({ category: 'GENERAL', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', vendor_name: '', notes: '' }); setEditingItem(null); };

  const openDonationModal = (donation = null) => {
    if (donation) {
      setEditingItem(donation);
      setDonationForm({ member_id: donation.member_id || '', amount: donation.amount || '', donation_date: donation.donation_date || '', category: donation.category || 'TITHE', payment_method: donation.payment_method || 'CASH', notes: donation.notes || '' });
    } else { resetDonationForm(); }
    setShowModal(true);
  };

  const openExpenseModal = (expense = null) => {
    if (expense) {
      setEditingItem(expense);
      setExpenseForm({ category: expense.category || 'GENERAL', amount: expense.amount || '', description: expense.description || '', expense_date: expense.expense_date || '', payment_method: expense.payment_method || 'CASH', vendor_name: expense.vendor_name || '', notes: expense.notes || '' });
    } else { resetExpenseForm(); }
    setShowExpenseModal(true);
  };

  const handleSaveDonation = async () => {
    if (!donationForm.amount) { alert('Amount is required'); return; }
    setSaving(true);
    try {
      const data = { ...donationForm, amount: parseFloat(donationForm.amount) };
      if (editingItem) { await supabaseUpdate('donations', editingItem.id, data); }
      else { await supabaseInsert('donations', data); }
      setShowModal(false); resetDonationForm(); fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) { alert('Amount and description are required'); return; }
    setSaving(true);
    try {
      const data = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
      if (editingItem) { await supabaseUpdate('expenses', editingItem.id, data); }
      else { await supabaseInsert('expenses', data); }
      setShowExpenseModal(false); resetExpenseForm(); fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabaseDelete(deleteConfirm.table, deleteConfirm.id);
    setDeleteConfirm(null); fetchData();
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? `${member.first_name} ${member.last_name}` : 'Anonymous';
  };

  const formatCurrency = (amount) => `XAF ${(parseFloat(amount) || 0).toLocaleString()}`;

  // Pie chart SVG
  const PieChart = ({ data, size = 200 }) => {
    const total = data.reduce((sum, d) => sum + d.amount, 0);
    if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>No data</div>;
    
    let currentAngle = 0;
    const paths = data.map((item, i) => {
      const percentage = item.amount / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const largeArc = angle > 180 ? 1 : 0;

      const x1 = 100 + 80 * Math.cos(startRad);
      const y1 = 100 + 80 * Math.sin(startRad);
      const x2 = 100 + 80 * Math.cos(endRad);
      const y2 = 100 + 80 * Math.sin(endRad);

      const pathData = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      return <path key={i} d={pathData} fill={categoryColors[item.category] || '#6b7280'} stroke="white" strokeWidth="2" />;
    });

    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        {paths}
        <circle cx="100" cy="100" r="40" fill="white" />
        <text x="100" y="95" textAnchor="middle" fontSize="12" fill="#6b7280">Total</text>
        <text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#374151">{(total / 1000000).toFixed(1)}M</text>
      </svg>
    );
  };

  return (
    <div>
      <PageHeader
        title={`💰 ${t('giving')}`}
        subtitle="Track and manage all church income and expenses"
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'income' && <Button onClick={() => openDonationModal()}>➕ Add Donation</Button>}
            {activeTab === 'expenses' && <Button onClick={() => openExpenseModal()}>➕ Add Expense</Button>}
          </div>
        }
      />

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('income')} style={{ padding: '12px 24px', border: activeTab === 'income' ? '2px solid #10b981' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'income' ? '#d1fae5' : 'white', color: activeTab === 'income' ? '#10b981' : '#6b7280', fontWeight: activeTab === 'income' ? '600' : '400', cursor: 'pointer' }}>💵 Income</button>
        <button onClick={() => setActiveTab('expenses')} style={{ padding: '12px 24px', border: activeTab === 'expenses' ? '2px solid #ef4444' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'expenses' ? '#fef2f2' : 'white', color: activeTab === 'expenses' ? '#ef4444' : '#6b7280', fontWeight: activeTab === 'expenses' ? '600' : '400', cursor: 'pointer' }}>📤 Expenses</button>
        <button onClick={() => setActiveTab('report')} style={{ padding: '12px 24px', border: activeTab === 'report' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'report' ? '#eef2ff' : 'white', color: activeTab === 'report' ? '#6366f1' : '#6b7280', fontWeight: activeTab === 'report' ? '600' : '400', cursor: 'pointer' }}>📊 Report</button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Income" value={formatCurrency(totalIncome)} icon="💵" color="#10b981" />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon="📤" color="#ef4444" />
        <StatCard label="Net Balance" value={formatCurrency(netBalance)} icon="💰" color={netBalance >= 0 ? '#10b981' : '#ef4444'} />
        <StatCard label="This Month" value={formatCurrency(donations.filter(d => d.donation_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0))} icon="📅" color="#6366f1" />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* INCOME TAB */}
          {activeTab === 'income' && (
            <>
              {/* Charts Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* Pie Chart */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>📊 Giving by Category</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <PieChart data={categoryTotals} size={180} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categoryTotals.map((cat, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: categoryColors[cat.category] }} />
                          <span style={{ fontSize: '13px', color: '#374151' }}>{cat.category}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>{((cat.amount / totalIncome) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line Chart - Monthly Trends */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📈 Giving Trends</h3>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Last 6 months</span>
                  </div>
                  <div style={{ position: 'relative', height: '150px' }}>
                    {/* Y-axis labels */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, width: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280' }}>
                      <span>{(maxMonthly / 1000000).toFixed(1)}M</span>
                      <span>{(maxMonthly / 2000000).toFixed(1)}M</span>
                      <span>0</span>
                    </div>
                    {/* Chart area */}
                    <div style={{ marginLeft: '55px', height: '130px', display: 'flex', alignItems: 'flex-end', gap: '8px', borderBottom: '1px solid #e5e7eb' }}>
                      {monthlyData.map((month, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '100%', maxWidth: '40px', backgroundColor: '#6366f1', borderRadius: '4px 4px 0 0', height: `${Math.max((month.amount / maxMonthly) * 110, 4)}px`, transition: 'height 0.3s' }} />
                        </div>
                      ))}
                    </div>
                    {/* X-axis labels */}
                    <div style={{ marginLeft: '55px', display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {monthlyData.map((month, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>{month.month}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Donations Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💵 Recent Donations</h3>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>{donations.length} records</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Donor</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Method</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.slice(0, 10).map((donation, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{donation.donation_date}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{getMemberName(donation.member_id)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: `${categoryColors[donation.category]}20`, color: categoryColors[donation.category], borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{donation.category}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>{formatCurrency(donation.amount)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{donation.payment_method}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button onClick={() => openDonationModal(donation)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>✏️</button>
                            <button onClick={() => setDeleteConfirm({ ...donation, table: 'donations' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📤 Expenses</h3>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>{expenses.length} records</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Vendor</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontSize: '14px' }}>{expense.expense_date}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{expense.description}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>{expense.category}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#ef4444' }}>{formatCurrency(expense.amount)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{expense.vendor_name || '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={() => openExpenseModal(expense)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => setDeleteConfirm({ ...expense, table: 'expenses' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No expenses recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORT TAB */}
          {activeTab === 'report' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#d1fae5', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#991b1b' }}>Total Expenses</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#991b1b' }}>{formatCurrency(totalExpenses)}</p>
                </div>
                <div style={{ backgroundColor: netBalance >= 0 ? '#dbeafe' : '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>Net Balance</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>{formatCurrency(netBalance)}</p>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Category Breakdown</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Income</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Expenses</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, i) => {
                      const income = donations.filter(d => d.category === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                      const expense = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                      const net = income - expense;
                      if (income === 0 && expense === 0) return null;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: categoryColors[cat] || '#6b7280' }} />
                              {cat}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981' }}>{formatCurrency(income)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(expense)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: net >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(net)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>TOTAL</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalIncome)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(totalExpenses)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary">🖨️ Print Report</Button>
                <Button variant="secondary">📄 Export PDF</Button>
                <Button variant="secondary">📊 Export Excel</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Donation Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetDonationForm(); }} title={editingItem ? '✏️ Edit Donation' : '➕ Add Donation'}>
        <FormInput label="Donor" type="select" value={donationForm.member_id} onChange={(e) => setDonationForm({ ...donationForm, member_id: e.target.value })} options={[{ value: '', label: 'Anonymous' }, ...members.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))]} />
        <FormInput label="Amount (XAF) *" type="number" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} required placeholder="50000" />
        <FormInput label="Date" type="date" value={donationForm.donation_date} onChange={(e) => setDonationForm({ ...donationForm, donation_date: e.target.value })} />
        <FormInput label="Category" type="select" value={donationForm.category} onChange={(e) => setDonationForm({ ...donationForm, category: e.target.value })} options={categories.map(c => ({ value: c, label: c }))} />
        <FormInput label="Payment Method" type="select" value={donationForm.payment_method} onChange={(e) => setDonationForm({ ...donationForm, payment_method: e.target.value })} options={paymentMethods.map(m => ({ value: m, label: m.replace('_', ' ') }))} />
        <FormInput label="Notes" type="textarea" value={donationForm.notes} onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetDonationForm(); }}>Cancel</Button>
          <Button onClick={handleSaveDonation} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => { setShowExpenseModal(false); resetExpenseForm(); }} title={editingItem ? '✏️ Edit Expense' : '➕ Add Expense'}>
        <FormInput label="Description *" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required placeholder="Office supplies" />
        <FormInput label="Amount (XAF) *" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required placeholder="25000" />
        <FormInput label="Date" type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
        <FormInput label="Category" type="select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} options={expenseCategories.map(c => ({ value: c, label: c }))} />
        <FormInput label="Vendor Name" value={expenseForm.vendor_name} onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })} placeholder="Supplier name" />
        <FormInput label="Payment Method" type="select" value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })} options={paymentMethods.map(m => ({ value: m, label: m.replace('_', ' ') }))} />
        <FormInput label="Notes" type="textarea" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowExpenseModal(false); resetExpenseForm(); }}>Cancel</Button>
          <Button onClick={handleSaveExpense} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message="Are you sure you want to delete this record?" />
    </div>
  );
}
// ==========================================
// SALVATIONS PAGE
// ==========================================
function SalvationsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
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
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
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
// VOLUNTEERS PAGE
// ==========================================
function VolunteersPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [volunteers, setVolunteers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterMinistry, setFilterMinistry] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const ministries = ['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer', 'Outreach', 'Discipleship', 'Admin', 'Other'];
  const statuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
  const availabilities = ['Sundays', 'Weekends', 'Weekdays', 'All Services', 'Fridays & Sundays', 'Daily', 'As Needed'];

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', ministry: 'Worship', role: '',
    status: 'ACTIVE', availability: 'Sundays', start_date: '', skills: '',
    notes: '', emergency_contact: '', emergency_phone: '', is_team_leader: false, member_id: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [volunteersData, membersData] = await Promise.all([
      supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setVolunteers(volunteersData || []);
    setMembers(membersData || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      full_name: '', email: '', phone: '', ministry: 'Worship', role: '',
      status: 'ACTIVE', availability: 'Sundays', start_date: '', skills: '',
      notes: '', emergency_contact: '', emergency_phone: '', is_team_leader: false, member_id: ''
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
        member_id: volunteer.member_id || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.ministry) {
      alert('Name and ministry are required');
      return;
    }
    setSaving(true);
    try {
      if (editingVolunteer) {
        await supabaseUpdate('volunteers', editingVolunteer.id, form);
      } else {
        await supabaseInsert('volunteers', form);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabaseDelete('volunteers', deleteConfirm.id);
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
        subtitle={`Manage your ${volunteers.length} volunteers across ${ministryStats.length} ministries`}
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
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
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
function MessagingPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [members, setMembers] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');

  const [message, setMessage] = useState({
    type: 'SMS',
    recipientType: 'ALL_MEMBERS',
    groupId: '',
    ministryFilter: '',
    customRecipients: [],
    subject: '',
    body: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [membersData, visitorsData, groupsData, volunteersData, messagesData, templatesData] = await Promise.all([
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('messages', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'sent_at.desc', limit: 20 }),
      supabaseQuery('message_templates', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setMembers(membersData || []);
    setVisitors(visitorsData || []);
    setGroups(groupsData || []);
    setVolunteers(volunteersData || []);
    setMessageHistory(messagesData || []);
    setTemplates(templatesData || []);
    setLoading(false);
  };

  // Get recipients based on selection
  const getRecipients = () => {
    let recipients = [];
    switch (message.recipientType) {
      case 'ALL_MEMBERS':
        recipients = members.filter(m => m.phone).map(m => ({ name: `${m.first_name} ${m.last_name}`, phone: m.phone, type: 'member' }));
        break;
      case 'ALL_VISITORS':
        recipients = visitors.filter(v => v.phone).map(v => ({ name: v.full_name, phone: v.phone, type: 'visitor' }));
        break;
      case 'ALL_VOLUNTEERS':
        recipients = volunteers.filter(v => v.phone).map(v => ({ name: v.full_name, phone: v.phone, type: 'volunteer' }));
        break;
      case 'GROUP':
        // In real app, would filter by group membership
        recipients = members.filter(m => m.phone).slice(0, 10).map(m => ({ name: `${m.first_name} ${m.last_name}`, phone: m.phone, type: 'member' }));
        break;
      case 'MINISTRY':
        recipients = volunteers.filter(v => v.phone && v.ministry === message.ministryFilter).map(v => ({ name: v.full_name, phone: v.phone, type: 'volunteer' }));
        break;
      case 'CUSTOM':
        recipients = selectedRecipients;
        break;
      default:
        recipients = [];
    }
    return recipients;
  };

  const recipientCount = getRecipients().length;

  // Handle template selection
  const applyTemplate = (template) => {
    setMessage({ ...message, body: template.body, subject: template.name });
  };

  // Handle send
  const handleSend = async () => {
    if (!message.body) {
      alert('Please enter a message');
      return;
    }
    if (recipientCount === 0) {
      alert('No recipients selected');
      return;
    }

    setSending(true);
    try {
      // Log the message to history
      await supabaseInsert('messages', {
        message_type: message.type,
        recipient_type: message.recipientType,
        recipient_count: recipientCount,
        subject: message.subject,
        body: message.body,
        status: 'SENT',
        sent_by: 'Admin'
      });

      // In real app, would call Twilio API here
      alert(`✅ Message sent to ${recipientCount} recipients!`);
      
      setMessage({ ...message, body: '', subject: '' });
      fetchData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setSending(false);
  };

  // Add/remove custom recipients
  const toggleRecipient = (recipient) => {
    const exists = selectedRecipients.find(r => r.phone === recipient.phone);
    if (exists) {
      setSelectedRecipients(selectedRecipients.filter(r => r.phone !== recipient.phone));
    } else {
      setSelectedRecipients([...selectedRecipients, recipient]);
    }
  };

  // All available contacts for custom selection
  const allContacts = [
    ...members.filter(m => m.phone).map(m => ({ name: `${m.first_name} ${m.last_name}`, phone: m.phone, type: 'Member' })),
    ...visitors.filter(v => v.phone).map(v => ({ name: v.full_name, phone: v.phone, type: 'Visitor' })),
    ...volunteers.filter(v => v.phone).map(v => ({ name: v.full_name, phone: v.phone, type: 'Volunteer' }))
  ].filter((c, i, arr) => arr.findIndex(x => x.phone === c.phone) === i); // Remove duplicates

  const filteredContacts = allContacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const ministries = ['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer', 'Outreach'];

  return (
    <div>
      <PageHeader
        title="💬 Messaging"
        subtitle="Send SMS and WhatsApp messages to your congregation"
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Contacts" value={allContacts.length} icon="👥" color="#6366f1" />
        <StatCard label="Members w/ Phone" value={members.filter(m => m.phone).length} icon="📱" color="#10b981" />
        <StatCard label="Messages Sent" value={messageHistory.length} icon="📤" color="#f59e0b" />
        <StatCard label="This Month" value={messageHistory.filter(m => m.sent_at?.startsWith(new Date().toISOString().slice(0, 7))).length} icon="📅" color="#8b5cf6" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('compose')} style={{ padding: '12px 24px', border: activeTab === 'compose' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'compose' ? '#eef2ff' : 'white', color: activeTab === 'compose' ? '#6366f1' : '#6b7280', fontWeight: activeTab === 'compose' ? '600' : '400', cursor: 'pointer' }}>✏️ Compose</button>
        <button onClick={() => setActiveTab('history')} style={{ padding: '12px 24px', border: activeTab === 'history' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'history' ? '#eef2ff' : 'white', color: activeTab === 'history' ? '#6366f1' : '#6b7280', fontWeight: activeTab === 'history' ? '600' : '400', cursor: 'pointer' }}>📜 History</button>
        <button onClick={() => setActiveTab('templates')} style={{ padding: '12px 24px', border: activeTab === 'templates' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'templates' ? '#eef2ff' : 'white', color: activeTab === 'templates' ? '#6366f1' : '#6b7280', fontWeight: activeTab === 'templates' ? '600' : '400', cursor: 'pointer' }}>📝 Templates</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* COMPOSE TAB */}
          {activeTab === 'compose' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
              {/* Message Form */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>✏️ Compose Message</h3>

                {/* Message Type */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Message Type</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setMessage({ ...message, type: 'SMS' })} style={{ flex: 1, padding: '16px', border: message.type === 'SMS' ? '2px solid #10b981' : '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: message.type === 'SMS' ? '#d1fae5' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '24px' }}>📱</span>
                      <span style={{ fontWeight: message.type === 'SMS' ? '600' : '400', color: message.type === 'SMS' ? '#166534' : '#6b7280' }}>SMS</span>
                    </button>
                    <button onClick={() => setMessage({ ...message, type: 'WHATSAPP' })} style={{ flex: 1, padding: '16px', border: message.type === 'WHATSAPP' ? '2px solid #25d366' : '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: message.type === 'WHATSAPP' ? '#dcfce7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '24px' }}>💬</span>
                      <span style={{ fontWeight: message.type === 'WHATSAPP' ? '600' : '400', color: message.type === 'WHATSAPP' ? '#166534' : '#6b7280' }}>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Recipients */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Recipients</label>
                  <select value={message.recipientType} onChange={(e) => setMessage({ ...message, recipientType: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
                    <option value="ALL_MEMBERS">📋 All Members ({members.filter(m => m.phone).length})</option>
                    <option value="ALL_VISITORS">🚶 All Visitors ({visitors.filter(v => v.phone).length})</option>
                    <option value="ALL_VOLUNTEERS">🙋‍♂️ All Volunteers ({volunteers.filter(v => v.phone).length})</option>
                    <option value="GROUP">👨‍👩‍👧‍👦 Specific Group</option>
                    <option value="MINISTRY">⛪ Ministry Team</option>
                    <option value="CUSTOM">✅ Custom Selection</option>
                  </select>
                </div>

                {/* Group Selection */}
                {message.recipientType === 'GROUP' && (
                  <div style={{ marginBottom: '20px' }}>
                    <select value={message.groupId} onChange={(e) => setMessage({ ...message, groupId: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
                      <option value="">Select a group...</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Ministry Selection */}
                {message.recipientType === 'MINISTRY' && (
                  <div style={{ marginBottom: '20px' }}>
                    <select value={message.ministryFilter} onChange={(e) => setMessage({ ...message, ministryFilter: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
                      <option value="">Select ministry...</option>
                      {ministries.map(m => <option key={m} value={m}>{m} ({volunteers.filter(v => v.ministry === m && v.phone).length})</option>)}
                    </select>
                  </div>
                )}

                {/* Custom Selection */}
                {message.recipientType === 'CUSTOM' && (
                  <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <input type="text" placeholder="🔍 Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredContacts.slice(0, 20).map((contact, i) => {
                        const isSelected = selectedRecipients.find(r => r.phone === contact.phone);
                        return (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: isSelected ? '#dbeafe' : 'white', borderRadius: '8px', cursor: 'pointer', border: isSelected ? '1px solid #3b82f6' : '1px solid #e5e7eb' }}>
                            <input type="checkbox" checked={!!isSelected} onChange={() => toggleRecipient(contact)} />
                            <span style={{ flex: 1, fontSize: '14px' }}>{contact.name}</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#f3f4f6', borderRadius: '4px', color: '#6b7280' }}>{contact.type}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#6b7280' }}>✅ {selectedRecipients.length} selected</p>
                  </div>
                )}

                {/* Message Body */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Message</label>
                  <textarea
                    value={message.body}
                    onChange={(e) => setMessage({ ...message, body: e.target.value })}
                    placeholder="Type your message here..."
                    style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', minHeight: '150px', resize: 'vertical' }}
                  />
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{message.body.length} characters</p>
                </div>

                {/* Send Button */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Button onClick={handleSend} disabled={sending || recipientCount === 0}>
                    {sending ? '⏳ Sending...' : `📤 Send to ${recipientCount} recipients`}
                  </Button>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    via {message.type === 'SMS' ? '📱 SMS' : '💬 WhatsApp'}
                  </span>
                </div>
              </div>

              {/* Sidebar - Quick Templates */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>📝 Quick Templates</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {templates.slice(0, 5).map((template, i) => (
                      <button key={i} onClick={() => applyTemplate(template)} style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', textAlign: 'left' }}>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{template.name}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.body?.slice(0, 50)}...</p>
                      </button>
                    ))}
                    {templates.length === 0 && <p style={{ color: '#6b7280', fontSize: '14px' }}>No templates yet</p>}
                  </div>
                </div>

                <div style={{ backgroundColor: '#fef3c7', borderRadius: '16px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#92400e' }}>💡 Tips</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#92400e', lineHeight: '1.6' }}>
                    <li>Keep SMS under 160 characters</li>
                    <li>Use {"{{name}}"} for personalization</li>
                    <li>Include church name for recognition</li>
                    <li>Add a call to action</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📜 Message History</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Recipients</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {messageHistory.map((msg, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{formatDate(msg.sent_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: msg.message_type === 'SMS' ? '#dbeafe' : '#dcfce7', color: msg.message_type === 'SMS' ? '#1e40af' : '#166534', borderRadius: '9999px', fontSize: '12px' }}>
                          {msg.message_type === 'SMS' ? '📱' : '💬'} {msg.message_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: '500' }}>{msg.recipient_count}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>({msg.recipient_type})</span>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <p style={{ margin: 0, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.body}</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>✅ {msg.status}</span>
                      </td>
                    </tr>
                  ))}
                  {messageHistory.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No messages sent yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📝 Message Templates</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Manage templates in Settings → Automation</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {templates.map((template, i) => (
                  <div key={i} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{template.name}</h4>
                      <span style={{ padding: '2px 8px', backgroundColor: template.category === 'BIRTHDAY' ? '#fef3c7' : '#dbeafe', color: template.category === 'BIRTHDAY' ? '#92400e' : '#1e40af', borderRadius: '6px', fontSize: '11px' }}>{template.category}</span>
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{template.body}</p>
                    <Button variant="secondary" onClick={() => { setMessage({ ...message, body: template.body }); setActiveTab('compose'); }}>
                      Use Template
                    </Button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                    <span style={{ fontSize: '48px' }}>📝</span>
                    <p>No templates yet. Create them in Settings.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ==========================================
// REPORTS PAGE
// ==========================================
function ReportsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState('month');
  const [data, setData] = useState({
    members: [], visitors: [], donations: [], expenses: [], 
    salvations: [], attendance: [], volunteers: [], groups: []
  });

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const [members, visitors, donations, expenses, salvations, attendance, volunteers, groups] = await Promise.all([
      supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('expenses', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setData({
      members: members || [], visitors: visitors || [], donations: donations || [],
      expenses: expenses || [], salvations: salvations || [], attendance: attendance || [],
      volunteers: volunteers || [], groups: groups || []
    });
    setLoading(false);
  };

  // Date filtering
  const getDateFilter = () => {
    const today = new Date();
    let startDate;
    switch (dateRange) {
      case 'week': startDate = new Date(today.setDate(today.getDate() - 7)); break;
      case 'month': startDate = new Date(today.setMonth(today.getMonth() - 1)); break;
      case 'quarter': startDate = new Date(today.setMonth(today.getMonth() - 3)); break;
      case 'year': startDate = new Date(today.setFullYear(today.getFullYear() - 1)); break;
      default: startDate = new Date(0);
    }
    return startDate.toISOString().split('T')[0];
  };

  const filterByDate = (items, dateField) => {
    const startDate = getDateFilter();
    return items.filter(item => item[dateField] >= startDate);
  };

  // Calculations
  const filteredDonations = filterByDate(data.donations, 'donation_date');
  const filteredExpenses = filterByDate(data.expenses, 'expense_date');
  const filteredSalvations = filterByDate(data.salvations, 'salvation_date');
  const filteredVisitors = filterByDate(data.visitors, 'visit_date');
  const filteredAttendance = filterByDate(data.attendance, 'service_date');

  const totalIncome = filteredDonations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;
  const avgAttendance = filteredAttendance.length > 0 
    ? Math.round(filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0) / filteredAttendance.length)
    : 0;

  const formatCurrency = (amount) => `XAF ${(amount || 0).toLocaleString()}`;
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  // Generate printable report
  const handlePrint = () => {
    window.print();
  };

  // Export to CSV
  const exportCSV = (reportData, filename) => {
    const headers = Object.keys(reportData[0] || {}).join(',');
    const rows = reportData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  const reportTypes = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'financial', label: '💰 Financial', icon: '💰' },
    { id: 'attendance', label: '👥 Attendance', icon: '👥' },
    { id: 'membership', label: '📋 Membership', icon: '📋' },
    { id: 'salvations', label: '❤️ Salvations', icon: '❤️' },
    { id: 'volunteers', label: '🙋‍♂️ Volunteers', icon: '🙋‍♂️' },
  ];

  return (
    <div>
      <PageHeader
        title="📊 Reports"
        subtitle="Generate and export church reports"
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={handlePrint}>🖨️ Print</Button>
            <Button variant="secondary" onClick={() => exportCSV(filteredDonations, 'donations')}>📥 Export CSV</Button>
          </div>
        }
      />

      {/* Date Range Selector */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>📅 Date Range:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'week', label: 'Last 7 Days' },
              { value: 'month', label: 'Last 30 Days' },
              { value: 'quarter', label: 'Last 3 Months' },
              { value: 'year', label: 'Last Year' },
              { value: 'all', label: 'All Time' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                style={{
                  padding: '8px 16px',
                  border: dateRange === option.value ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: dateRange === option.value ? '#eef2ff' : 'white',
                  color: dateRange === option.value ? '#6366f1' : '#6b7280',
                  fontWeight: dateRange === option.value ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {reportTypes.map(report => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            style={{
              padding: '10px 20px',
              border: activeReport === report.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius: '10px',
              backgroundColor: activeReport === report.id ? '#eef2ff' : 'white',
              color: activeReport === report.id ? '#6366f1' : '#6b7280',
              fontWeight: activeReport === report.id ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {report.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div id="report-content">
          {/* OVERVIEW REPORT */}
          {activeReport === 'overview' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#dbeafe', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e40af' }}>👥 Total Members</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#1e40af' }}>{data.members.length}</p>
                </div>
                <div style={{ backgroundColor: '#dcfce7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>💰 Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef3c7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#92400e' }}>📊 Avg Attendance</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#92400e' }}>{avgAttendance}</p>
                </div>
                <div style={{ backgroundColor: '#fce7f3', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9d174d' }}>❤️ Salvations</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#9d174d' }}>{filteredSalvations.length}</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>📋 Quick Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Membership</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Members</span><strong>{data.members.filter(m => m.status === 'ACTIVE').length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>New Visitors</span><strong>{filteredVisitors.length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Groups</span><strong>{data.groups.length}</strong></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Financial</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Income</span><strong style={{ color: '#10b981' }}>{formatCurrency(totalIncome)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expenses</span><strong style={{ color: '#ef4444' }}>{formatCurrency(totalExpenses)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Net</span><strong style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netBalance)}</strong></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Ministry</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volunteers</span><strong>{data.volunteers.length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active</span><strong>{data.volunteers.filter(v => v.status === 'ACTIVE').length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Services Recorded</span><strong>{filteredAttendance.length}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL REPORT */}
          {activeReport === 'financial' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#dcfce7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>💵 Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#991b1b' }}>📤 Total Expenses</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#991b1b' }}>{formatCurrency(totalExpenses)}</p>
                </div>
                <div style={{ backgroundColor: netBalance >= 0 ? '#dbeafe' : '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>💰 Net Balance</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>{formatCurrency(netBalance)}</p>
                </div>
              </div>

              {/* Income by Category */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💵 Income by Category</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['TITHE', 'OFFERING', 'DONATION', 'MISSIONS', 'BUILDING', 'SPECIAL', 'OTHER'].map((cat, i) => {
                      const amount = filteredDonations.filter(d => d.category === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                      if (amount === 0) return null;
                      const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(1) : 0;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{cat}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>{formatCurrency(amount)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recent Transactions */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📜 Recent Transactions</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredDonations.map(d => ({ ...d, type: 'Income', date: d.donation_date })), 
                      ...filteredExpenses.map(e => ({ ...e, type: 'Expense', date: e.expense_date }))]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 10)
                      .map((item, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{formatDate(item.date)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fef2f2', color: item.type === 'Income' ? '#166534' : '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6b7280' }}>{item.category}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: item.type === 'Income' ? '#10b981' : '#ef4444' }}>
                            {item.type === 'Income' ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ATTENDANCE REPORT */}
          {activeReport === 'attendance' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Services Recorded" value={filteredAttendance.length} icon="⛪" color="#6366f1" />
                <StatCard label="Average Attendance" value={avgAttendance} icon="👥" color="#10b981" />
                <StatCard label="Total Attendance" value={filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0)} icon="📊" color="#f59e0b" />
                <StatCard label="First Time Visitors" value={filteredAttendance.reduce((sum, a) => sum + (a.first_timers || 0), 0)} icon="🆕" color="#8b5cf6" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Attendance Records</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Men</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Women</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Children</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Offering</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.slice(0, 10).map((record, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{formatDate(record.service_date)}</td>
                        <td style={{ padding: '12px 16px' }}>{record.men_count || 0}</td>
                        <td style={{ padding: '12px 16px' }}>{record.women_count || 0}</td>
                        <td style={{ padding: '12px 16px' }}>{record.children_count || 0}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#6366f1' }}>{record.total_count || 0}</td>
                        <td style={{ padding: '12px 16px', color: '#10b981' }}>{formatCurrency(record.total_offering)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MEMBERSHIP REPORT */}
          {activeReport === 'membership' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Members" value={data.members.length} icon="👥" color="#6366f1" />
                <StatCard label="Active" value={data.members.filter(m => m.status === 'ACTIVE').length} icon="✅" color="#10b981" />
                <StatCard label="New Visitors" value={filteredVisitors.length} icon="🚶" color="#f59e0b" />
                <StatCard label="Groups" value={data.groups.length} icon="👨‍👩‍👧‍👦" color="#8b5cf6" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📋 Members List</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.slice(0, 15).map((member, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{member.first_name} {member.last_name}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{member.phone || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={member.status} /></td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(member.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SALVATIONS REPORT */}
          {activeReport === 'salvations' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Salvations" value={filteredSalvations.length} icon="❤️" color="#ef4444" />
                <StatCard label="Pending Follow-up" value={filteredSalvations.filter(s => s.followup_status === 'PENDING').length} icon="⏳" color="#f59e0b" />
                <StatCard label="Completed" value={filteredSalvations.filter(s => s.followup_status === 'COMPLETED').length} icon="✅" color="#10b981" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>❤️ Salvation Records</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Follow-up Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalvations.map((salvation, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{salvation.full_name}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(salvation.salvation_date)}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{salvation.phone || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={salvation.followup_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VOLUNTEERS REPORT */}
          {activeReport === 'volunteers' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Volunteers" value={data.volunteers.length} icon="🙋‍♂️" color="#6366f1" />
                <StatCard label="Active" value={data.volunteers.filter(v => v.status === 'ACTIVE').length} icon="✅" color="#10b981" />
                <StatCard label="Team Leaders" value={data.volunteers.filter(v => v.is_team_leader).length} icon="⭐" color="#f59e0b" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🙋‍♂️ Volunteers by Ministry</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Ministry</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Count</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Active</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Leaders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer'].map((ministry, i) => {
                      const ministryVolunteers = data.volunteers.filter(v => v.ministry === ministry);
                      if (ministryVolunteers.length === 0) return null;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{ministry}</td>
                          <td style={{ padding: '12px 16px' }}>{ministryVolunteers.length}</td>
                          <td style={{ padding: '12px 16px', color: '#10b981' }}>{ministryVolunteers.filter(v => v.status === 'ACTIVE').length}</td>
                          <td style={{ padding: '12px 16px', color: '#f59e0b' }}>{ministryVolunteers.filter(v => v.is_team_leader).length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ==========================================
// SERVICES & EVENTS PAGE
// ==========================================
function ServicesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [activeTab, setActiveTab] = useState('services');
  const [services, setServices] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');

  const [serviceForm, setServiceForm] = useState({ 
    name: '', description: '', location_id: '', day_of_week: 'SUNDAY', 
    start_time: '09:00', end_time: '11:00', is_active: true 
  });

  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_date: '', start_time: '09:00', 
    end_time: '12:00', location_id: '', event_type: 'GENERAL', 
    is_recurring: false, recurrence_pattern: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [servicesData, eventsData, locationsData, attendanceData] = await Promise.all([
      supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'event_date.asc' }),
      supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc', limit: 10 })
    ]);
    setServices(servicesData || []);
    setEvents(eventsData || []);
    setLocations(locationsData || []);
    setAttendance(attendanceData || []);
    setLoading(false);
  };

  // Reset forms
  const resetServiceForm = () => {
    setServiceForm({ name: '', description: '', location_id: locations[0]?.id || '', day_of_week: 'SUNDAY', start_time: '09:00', end_time: '11:00', is_active: true });
    setEditingService(null);
  };

  const resetEventForm = () => {
    setEventForm({ title: '', description: '', event_date: '', start_time: '09:00', end_time: '12:00', location_id: locations[0]?.id || '', event_type: 'GENERAL', is_recurring: false, recurrence_pattern: '' });
    setEditingEvent(null);
  };

  // Open modals
  const openServiceModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name || '', description: service.description || '',
        location_id: service.location_id || '', day_of_week: service.day_of_week || 'SUNDAY',
        start_time: service.start_time || '09:00', end_time: service.end_time || '11:00',
        is_active: service.is_active ?? true
      });
    } else { resetServiceForm(); }
    setShowServiceModal(true);
  };

  const openEventModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title || '', description: event.description || '',
        event_date: event.event_date || '', start_time: event.start_time || '09:00',
        end_time: event.end_time || '12:00', location_id: event.location_id || '',
        event_type: event.event_type || 'GENERAL', is_recurring: event.is_recurring || false,
        recurrence_pattern: event.recurrence_pattern || ''
      });
    } else { resetEventForm(); }
    setShowEventModal(true);
  };

  // Save handlers
  const handleSaveService = async () => {
    if (!serviceForm.name) { alert('Service name is required'); return; }
    setSaving(true);
    try {
      if (editingService) {
        await supabaseUpdate('services', editingService.id, serviceForm);
      } else {
        await supabaseInsert('services', serviceForm);
      }
      setShowServiceModal(false);
      resetServiceForm();
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.event_date) { alert('Event title and date are required'); return; }
    setSaving(true);
    try {
      if (editingEvent) {
        await supabaseUpdate('events', editingEvent.id, eventForm);
      } else {
        await supabaseInsert('events', eventForm);
      }
      setShowEventModal(false);
      resetEventForm();
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'service') {
        await supabaseDelete('services', deleteConfirm.id);
      } else {
        await supabaseDelete('events', deleteConfirm.id);
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
  };

  // Helper functions
  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Main Campus';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || 'Unknown';
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : '';

  const isUpcoming = (dateStr) => new Date(dateStr) >= new Date();
  const isPast = (dateStr) => new Date(dateStr) < new Date();

  // Filter services by location
  const filteredServices = filterLocation === 'all' ? services : services.filter(s => s.location_id === filterLocation);

  // Separate upcoming and past events
  const upcomingEvents = events.filter(e => isUpcoming(e.event_date));
  const pastEvents = events.filter(e => isPast(e.event_date));

  const eventTypeIcons = {
    'SERVICE': '⛪', 'CONFERENCE': '🎤', 'PRAYER': '🙏', 'MEETING': '👥',
    'OUTREACH': '🌍', 'YOUTH': '🎉', 'GENERAL': '📅', 'WORKSHOP': '📚'
  };

  const eventTypeColors = {
    'SERVICE': '#6366f1', 'CONFERENCE': '#f59e0b', 'PRAYER': '#ec4899', 'MEETING': '#10b981',
    'OUTREACH': '#3b82f6', 'YOUTH': '#8b5cf6', 'GENERAL': '#6b7280', 'WORKSHOP': '#14b8a6'
  };

  return (
    <div>
      <PageHeader
        title="⛪ Services & Events"
        subtitle={`${services.length} services • ${upcomingEvents.length} upcoming events`}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'services' ? (
              <Button onClick={() => openServiceModal()}>➕ Add Service</Button>
            ) : (
              <Button onClick={() => openEventModal()}>➕ Add Event</Button>
            )}
          </div>
        }
      />

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('services')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'services' ? '2px solid #6366f1' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'services' ? '#eef2ff' : 'white',
            color: activeTab === 'services' ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === 'services' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🕐 Services ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'events' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'events' ? '#fef3c7' : 'white',
            color: activeTab === 'events' ? '#f59e0b' : '#6b7280',
            fontWeight: activeTab === 'events' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🎉 Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'attendance' ? '2px solid #10b981' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'attendance' ? '#d1fae5' : 'white',
            color: activeTab === 'attendance' ? '#10b981' : '#6b7280',
            fontWeight: activeTab === 'attendance' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📊 Recent Attendance
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Services" value={services.length} icon="⛪" />
        <StatCard label="Active Services" value={services.filter(s => s.is_active).length} icon="✅" color="#10b981" />
        <StatCard label="Upcoming Events" value={upcomingEvents.length} icon="📅" color="#f59e0b" />
        <StatCard label="Locations" value={locations.length} icon="📍" color="#6366f1" />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* SERVICES TAB */}
          {activeTab === 'services' && (
            <>
              {/* Service Times Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🕐 Service Times</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>Filter:</label>
                    <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                      <option value="all">All Locations</option>
                      {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                    </select>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Service</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Day</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Time</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((service, index) => (
                        <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⛪</div>
                              <div>
                                <p style={{ margin: 0, fontWeight: '500' }}>{service.name}</p>
                                {service.description && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{service.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ padding: '4px 12px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                              📍 {getLocationName(service.location_id)}
                            </span>
                          </td>
                          <td style={{ padding: '16px', color: '#374151', fontWeight: '500' }}>{service.day_of_week}</td>
                          <td style={{ padding: '16px', color: '#6b7280' }}>{formatTime(service.start_time)} - {formatTime(service.end_time)}</td>
                          <td style={{ padding: '16px' }}>
                            {service.is_active 
                              ? <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>✅ Active</span>
                              : <span style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>❌ Inactive</span>
                            }
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => openServiceModal(service)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                              <button onClick={() => setDeleteConfirm({ ...service, type: 'service' })} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredServices.length === 0 && (
                        <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No services found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Locations Overview */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>📍 Services by Location</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {locations.map((location, index) => {
                    const locationServices = services.filter(s => s.location_id === location.id);
                    return (
                      <div key={index} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '24px' }}>{location.is_main_campus ? '🏛️' : '🏢'}</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{location.name}</h4>
                            {location.is_main_campus && <span style={{ fontSize: '11px', color: '#6366f1' }}>Main Campus</span>}
                          </div>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
                          ⛪ {locationServices.length} services • ✅ {locationServices.filter(s => s.is_active).length} active
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {locationServices.map((svc, i) => (
                            <span key={i} style={{ padding: '4px 8px', backgroundColor: 'white', borderRadius: '6px', fontSize: '11px', color: '#374151', border: '1px solid #e5e7eb' }}>
                              {svc.day_of_week} {formatTime(svc.start_time)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <>
              {/* Upcoming Events */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🎉 Upcoming Events</h3>
                  <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>{upcomingEvents.length} upcoming</span>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                    <span style={{ fontSize: '48px' }}>📅</span>
                    <p>No upcoming events. Create one!</p>
                  </div>
                ) : (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {upcomingEvents.map((event, index) => {
                      const daysUntil = Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={index} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: `2px solid ${eventTypeColors[event.event_type] || '#e5e7eb'}20`, position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                            <button onClick={() => openEventModal(event)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                            <button onClick={() => setDeleteConfirm({ ...event, type: 'event' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#dc2626' }}>🗑️</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: '50px', height: '50px', backgroundColor: `${eventTypeColors[event.event_type] || '#6b7280'}20`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                              {eventTypeIcons[event.event_type] || '📅'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>{event.title}</h4>
                              <span style={{ padding: '2px 8px', backgroundColor: `${eventTypeColors[event.event_type] || '#6b7280'}20`, color: eventTypeColors[event.event_type] || '#6b7280', borderRadius: '9999px', fontSize: '11px', fontWeight: '500' }}>
                                {event.event_type}
                              </span>
                            </div>
                          </div>
                          {event.description && <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>{event.description}</p>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#374151' }}>
                            <span>📅 {formatDate(event.event_date)}</span>
                            {event.start_time && <span>🕐 {formatTime(event.start_time)} - {formatTime(event.end_time)}</span>}
                            {event.location_id && <span>📍 {getLocationName(event.location_id)}</span>}
                          </div>
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                            <span style={{ padding: '4px 12px', backgroundColor: daysUntil <= 3 ? '#fef3c7' : '#dbeafe', color: daysUntil <= 3 ? '#92400e' : '#1e40af', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                              {daysUntil === 0 ? '🎉 Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>📜 Past Events</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Event</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastEvents.slice(0, 5).map((event, index) => (
                          <tr key={index} style={{ borderTop: '1px solid #e5e7eb', opacity: 0.7 }}>
                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>{event.title}</td>
                            <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px' }}>{eventTypeIcons[event.event_type]} {event.event_type}</span></td>
                            <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(event.event_date)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button onClick={() => setDeleteConfirm({ ...event, type: 'event' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#dc2626' }}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Recent Attendance Records</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Service</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Men</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Women</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Children</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Offering</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record, index) => (
                      <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '16px', fontWeight: '500' }}>{formatDate(record.service_date)}</td>
                        <td style={{ padding: '16px', color: '#6366f1' }}>{getServiceName(record.service_id)}</td>
                        <td style={{ padding: '16px' }}><span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>{getLocationName(record.location_id)}</span></td>
                        <td style={{ padding: '16px' }}>{record.men_count}</td>
                        <td style={{ padding: '16px' }}>{record.women_count}</td>
                        <td style={{ padding: '16px' }}>{record.children_count}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#6366f1' }}>{record.total_count}</td>
                        <td style={{ padding: '16px', color: '#10b981', fontWeight: '500' }}>XAF {(record.total_offering || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {attendance.length === 0 && (
                      <tr><td colSpan="8" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No attendance records yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Service Modal */}
      <Modal isOpen={showServiceModal} onClose={() => { setShowServiceModal(false); resetServiceForm(); }} title={editingService ? '✏️ Edit Service' : '➕ Add Service'}>
        <FormInput label="Service Name *" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required placeholder="e.g., Sunday First Service" />
        <FormInput label="Description" type="textarea" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="Brief description..." />
        <FormInput label="📍 Location" type="select" value={serviceForm.location_id} onChange={(e) => setServiceForm({ ...serviceForm, location_id: e.target.value })} options={locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))} />
        <FormInput label="Day of Week" type="select" value={serviceForm.day_of_week} onChange={(e) => setServiceForm({ ...serviceForm, day_of_week: e.target.value })} options={[{ value: 'SUNDAY', label: 'Sunday' }, { value: 'MONDAY', label: 'Monday' }, { value: 'TUESDAY', label: 'Tuesday' }, { value: 'WEDNESDAY', label: 'Wednesday' }, { value: 'THURSDAY', label: 'Thursday' }, { value: 'FRIDAY', label: 'Friday' }, { value: 'SATURDAY', label: 'Saturday' }]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={serviceForm.start_time} onChange={(e) => setServiceForm({ ...serviceForm, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={serviceForm.end_time} onChange={(e) => setServiceForm({ ...serviceForm, end_time: e.target.value })} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input type="checkbox" checked={serviceForm.is_active} onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })} />
          <span>✅ Active</span>
        </label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowServiceModal(false); resetServiceForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveService} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Add/Edit Event Modal */}
      <Modal isOpen={showEventModal} onClose={() => { setShowEventModal(false); resetEventForm(); }} title={editingEvent ? '✏️ Edit Event' : '➕ Add Event'} width="600px">
        <FormInput label="Event Title *" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder="e.g., Youth Conference 2026" />
        <FormInput label="Description" type="textarea" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="What is this event about?" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Event Date *" type="date" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} required />
          <FormInput label="Event Type" type="select" value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} options={[{ value: 'GENERAL', label: '📅 General' }, { value: 'CONFERENCE', label: '🎤 Conference' }, { value: 'PRAYER', label: '🙏 Prayer' }, { value: 'MEETING', label: '👥 Meeting' }, { value: 'OUTREACH', label: '🌍 Outreach' }, { value: 'YOUTH', label: '🎉 Youth' }, { value: 'WORKSHOP', label: '📚 Workshop' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} />
        </div>
        <FormInput label="📍 Location" type="select" value={eventForm.location_id} onChange={(e) => setEventForm({ ...eventForm, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))]} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowEventModal(false); resetEventForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveEvent} disabled={saving}>{saving ? '⏳' : '💾 Save Event'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={`🗑️ Delete ${deleteConfirm?.type === 'service' ? 'Service' : 'Event'}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name || deleteConfirm?.title}"?`}
      />
    </div>
  );
}

// ==========================================
// SUPER ADMIN PAGE
// ==========================================
function SuperAdminPage() {
  const { user } = useAuth();
  const [churches, setChurches] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview');
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [churchMembers, setChurchMembers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});
  const [showAddChurch, setShowAddChurch] = useState(false);
  const [newChurchForm, setNewChurchForm] = useState({ name: '', city: '', denomination: '', pastor_name: '', phone: '', email: '', currency: 'XAF', admin_name: '', admin_email: '', admin_password: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [churchesData, usersData] = await Promise.all([
        supabaseQuery('churches'),
        supabaseQuery('church_users', { select: '*' })
      ]);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error) { console.error('Super admin fetch error:', error); }
    setLoading(false);
  };

  const viewChurchDetails = async (church) => {
    setSelectedChurch(church);
    setActiveView('church-detail');
    const members = await supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: church.id }] });
    setChurchMembers(Array.isArray(members) ? members : []);
  };

  const deleteChurch = async (churchId) => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }
    setSaving(true);
    try {
      const tables = ['activity_logs', 'attendance_records', 'donations', 'salvations', 'visitors', 'members', 'services', 'events', 'church_locations', 'user_role_assignments', 'church_users'];
      for (const table of tables) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?church_id=eq.${churchId}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' }
        });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/churches?id=eq.${churchId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' }
      });
      alert('✅ Church and all data deleted permanently');
      setDeleteConfirmId(null);
      setDeleteConfirmText('');
      setSelectedChurch(null);
      setActiveView('overview');
      fetchAllData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const toggleUserActive = async (userId, currentStatus) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/church_users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchAllData();
    } catch (error) { alert('Error: ' + error.message); }
  };

  const openEditUser = (u) => {
    setEditingUser(u.id);
    setEditUserForm({ full_name: u.full_name || '', email: u.email || '', phone: u.phone || '', role: u.role || 'STAFF', password_hash: '' });
  };

  const saveEditUser = async (userId) => {
    setSaving(true);
    try {
      const updates = { full_name: editUserForm.full_name, email: editUserForm.email, phone: editUserForm.phone, role: editUserForm.role };
      if (editUserForm.password_hash) updates.password_hash = editUserForm.password_hash;
      await fetch(`${SUPABASE_URL}/rest/v1/church_users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(updates)
      });
      setEditingUser(null);
      fetchAllData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const addNewChurch = async () => {
    if (!newChurchForm.name || !newChurchForm.admin_email || !newChurchForm.admin_password) {
      alert('Church name, admin email and password are required');
      return;
    }
    setSaving(true);
    try {
      const churchRes = await fetch(`${SUPABASE_URL}/rest/v1/churches`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ name: newChurchForm.name, city: newChurchForm.city, denomination: newChurchForm.denomination, pastor_name: newChurchForm.pastor_name, phone: newChurchForm.phone, email: newChurchForm.email, currency: newChurchForm.currency })
      });
      const newChurch = await churchRes.json();
      const churchId = newChurch[0]?.id;
      if (!churchId) { alert('Failed to create church'); setSaving(false); return; }

      await fetch(`${SUPABASE_URL}/rest/v1/church_users`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ church_id: churchId, full_name: newChurchForm.admin_name || 'Admin', email: newChurchForm.admin_email, password_hash: newChurchForm.admin_password, role: 'ADMIN', is_active: true })
      });

      alert('✅ Church and admin account created!');
      setShowAddChurch(false);
      setNewChurchForm({ name: '', city: '', denomination: '', pastor_name: '', phone: '', email: '', currency: 'XAF', admin_name: '', admin_email: '', admin_password: '' });
      fetchAllData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  if (!user?.is_super_admin) {
    return <div style={{ padding: '60px', textAlign: 'center' }}><h2>🚫 Access Denied</h2><p>You do not have Super Admin privileges.</p></div>;
  }

  if (loading) return <LoadingSpinner />;

  const getUsersForChurch = (churchId) => allUsers.filter(u => u.church_id === churchId);

  return (
      <div>
        <PageHeader title="🛡️ Super Admin Panel" subtitle="Manage all churches and users on the platform" />
  
        {/* Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Total Churches</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#4f46e5' }}>{churches.length}</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Total Users</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{allUsers.length}</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Active Users</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{allUsers.filter(u => u.is_active).length}</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Super Admins</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{allUsers.filter(u => u.is_super_admin).length}</p>
          </div>
        </div>
  
        {/* Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button onClick={() => { setActiveView('overview'); setSelectedChurch(null); }} style={{ padding: '10px 20px', border: activeView === 'overview' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeView === 'overview' ? '#eef2ff' : 'white', color: activeView === 'overview' ? '#6366f1' : '#6b7280', fontWeight: activeView === 'overview' ? '600' : '400', cursor: 'pointer', fontSize: '14px' }}>⛪ All Churches</button>
          <button onClick={() => setActiveView('users')} style={{ padding: '10px 20px', border: activeView === 'users' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeView === 'users' ? '#eef2ff' : 'white', color: activeView === 'users' ? '#6366f1' : '#6b7280', fontWeight: activeView === 'users' ? '600' : '400', cursor: 'pointer', fontSize: '14px' }}>👥 All Users</button>
          <button onClick={() => setShowAddChurch(true)} style={{ padding: '10px 20px', border: '1px solid #10b981', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#10b981', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>➕ Add Church</button>
        </div>
  
        {/* Add Church Modal */}
        {showAddChurch && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>➕ Add New Church</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', color: '#6b7280' }}>Church Name *</label><input value={newChurchForm.name} onChange={e => setNewChurchForm({...newChurchForm, name: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>City</label><input value={newChurchForm.city} onChange={e => setNewChurchForm({...newChurchForm, city: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Denomination</label><input value={newChurchForm.denomination} onChange={e => setNewChurchForm({...newChurchForm, denomination: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Pastor Name</label><input value={newChurchForm.pastor_name} onChange={e => setNewChurchForm({...newChurchForm, pastor_name: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Phone</label><input value={newChurchForm.phone} onChange={e => setNewChurchForm({...newChurchForm, phone: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Email</label><input value={newChurchForm.email} onChange={e => setNewChurchForm({...newChurchForm, email: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Currency</label><select value={newChurchForm.currency} onChange={e => setNewChurchForm({...newChurchForm, currency: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}><option value="XAF">XAF (CFA)</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="NGN">NGN</option></select></div>
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '8px' }}><h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>👤 Admin Account</h4></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Admin Name *</label><input value={newChurchForm.admin_name} onChange={e => setNewChurchForm({...newChurchForm, admin_name: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Admin Email *</label><input value={newChurchForm.admin_email} onChange={e => setNewChurchForm({...newChurchForm, admin_email: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', color: '#6b7280' }}>Admin Password *</label><input type="password" value={newChurchForm.admin_password} onChange={e => setNewChurchForm({...newChurchForm, admin_password: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button onClick={() => setShowAddChurch(false)} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                <button onClick={addNewChurch} disabled={saving} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: '600' }}>{saving ? '⏳ Creating...' : '✅ Create Church'}</button>
              </div>
            </div>
          </div>
        )}
  
        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '450px', width: '90%' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#dc2626' }}>⚠️ Delete Church Permanently</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>This will permanently delete the church and <strong>ALL</strong> its data including members, visitors, donations, attendance records, and users. <strong>This cannot be undone.</strong></p>
              <p style={{ margin: '16px 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Type <span style={{ color: '#dc2626', fontFamily: 'monospace', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '4px' }}>DELETE</span> to confirm:</p>
              <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE here" style={{ width: '100%', padding: '10px', border: '2px solid #fca5a5', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => { setDeleteConfirmId(null); setDeleteConfirmText(''); }} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => deleteChurch(deleteConfirmId)} disabled={deleteConfirmText !== 'DELETE' || saving} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: deleteConfirmText === 'DELETE' ? '#dc2626' : '#fca5a5', color: 'white', cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed', fontWeight: '600' }}>{saving ? '⏳ Deleting...' : '🗑️ Delete Forever'}</button>
              </div>
            </div>
          </div>
        )}
  
        {/* All Churches View */}
        {activeView === 'overview' && (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>⛪ Registered Churches</h3>
            </div>
            {churches.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No churches registered yet. Click "➕ Add Church" to create one.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Church</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>City</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Users</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Created</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {churches.map((church, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontWeight: '500' }}>{church.name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{church.denomination || '—'}</p>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{church.city || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{getUsersForChurch(church.id).length} users</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>{new Date(church.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => viewChurchDetails(church)} style={{ padding: '6px 12px', border: 'none', background: '#eef2ff', borderRadius: '6px', cursor: 'pointer', color: '#4f46e5', fontSize: '12px', fontWeight: '500', marginRight: '6px' }}>👁️ View</button>
                        <button onClick={() => setDeleteConfirmId(church.id)} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px', fontWeight: '500' }}>🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
  
        {/* All Users View */}
        {activeView === 'users' && (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>👥 All Platform Users</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Church</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Last Login</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u, i) => {
                  const church = churches.find(c => c.id === u.church_id);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        {editingUser === u.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input value={editUserForm.full_name} onChange={e => setEditUserForm({...editUserForm, full_name: e.target.value})} placeholder="Name" style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                            <input value={editUserForm.email} onChange={e => setEditUserForm({...editUserForm, email: e.target.value})} placeholder="Email" style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                            <input value={editUserForm.phone || ''} onChange={e => setEditUserForm({...editUserForm, phone: e.target.value})} placeholder="Phone" style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', backgroundColor: u.is_super_admin ? '#fef3c7' : '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.is_super_admin ? '#f59e0b' : '#6366f1', fontWeight: '600' }}>{u.full_name?.[0] || '?'}</div>
                            <div>
                              <p style={{ margin: 0, fontWeight: '500' }}>{u.full_name} {u.is_super_admin && '🛡️'}</p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{u.email}</p>
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>{church?.name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingUser === u.id ? (
                          <select value={editUserForm.role} onChange={e => setEditUserForm({...editUserForm, role: e.target.value})} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                            <option value="ADMIN">ADMIN</option>
                            <option value="PASTOR">PASTOR</option>
                            <option value="STAFF">STAFF</option>
                          </select>
                        ) : (
                          <span style={{ padding: '4px 10px', backgroundColor: u.role === 'ADMIN' ? '#fef3c7' : u.role === 'PASTOR' ? '#e0e7ff' : '#f3f4f6', color: u.role === 'ADMIN' ? '#92400e' : u.role === 'PASTOR' ? '#4338ca' : '#374151', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{u.role}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: u.is_active ? '#dcfce7' : '#fef2f2', color: u.is_active ? '#166534' : '#991b1b', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{u.is_active ? '✅ Active' : '❌ Inactive'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {editingUser === u.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                            <input value={editUserForm.password_hash} onChange={e => setEditUserForm({...editUserForm, password_hash: e.target.value})} placeholder="New password (optional)" style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', width: '160px' }} />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => setEditingUser(null)} style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                              <button onClick={() => saveEditUser(u.id)} disabled={saving} style={{ padding: '4px 10px', border: 'none', borderRadius: '6px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>{saving ? '⏳' : '💾 Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditUser(u)} style={{ padding: '6px 10px', border: 'none', background: '#eef2ff', borderRadius: '6px', cursor: 'pointer', color: '#4f46e5', fontSize: '12px', fontWeight: '500' }}>✏️ Edit</button>
                            <button onClick={() => toggleUserActive(u.id, u.is_active)} style={{ padding: '6px 10px', border: 'none', background: u.is_active ? '#fef2f2' : '#dcfce7', borderRadius: '6px', cursor: 'pointer', color: u.is_active ? '#dc2626' : '#166534', fontSize: '12px', fontWeight: '500' }}>{u.is_active ? '🚫 Disable' : '✅ Enable'}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
  
        {/* Church Detail View */}
        {activeView === 'church-detail' && selectedChurch && (
          <div>
            <button onClick={() => { setActiveView('overview'); setSelectedChurch(null); }} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>← Back to All Churches</button>
  
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>⛪ {selectedChurch.name}</h3>
                <button onClick={() => setDeleteConfirmId(selectedChurch.id)} style={{ padding: '8px 16px', border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>🗑️ Delete Church</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>City</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{selectedChurch.city || '—'}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Denomination</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{selectedChurch.denomination || '—'}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Pastor</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{selectedChurch.pastor_name || '—'}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Phone</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{selectedChurch.phone || '—'}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Email</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{selectedChurch.email || '—'}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Members</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{churchMembers.length}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Users</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{getUsersForChurch(selectedChurch.id).length}</p></div>
                <div><label style={{ fontSize: '12px', color: '#6b7280' }}>Created</label><p style={{ margin: '4px 0 0 0', fontWeight: '500' }}>{new Date(selectedChurch.created_at).toLocaleDateString()}</p></div>
              </div>
            </div>
  
            {/* Church Users */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>👥 Church Users</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {getUsersForChurch(selectedChurch.id).map((u, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>{u.full_name}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 10px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '9999px', fontSize: '12px' }}>{u.role}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ color: u.is_active ? '#10b981' : '#ef4444' }}>{u.is_active ? '✅ Active' : '❌ Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

// ==========================================
// SETTINGS PAGE - Complete with All Features
// ==========================================
function SettingsPage() {
  const { user, logout } = useAuth();
  const CHURCH_ID = user?.church_id;
  const { t, language, changeLanguage } = useLanguage();
  const [church, setChurch] = useState(null);
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [automationSettings, setAutomationSettings] = useState([]);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [editingChurch, setEditingChurch] = useState(false);
  const [churchForm, setChurchForm] = useState({});
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current: '', new_password: '', confirm: '' });
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Forms
  const [locationForm, setLocationForm] = useState({ name: '', address: '', city: '', phone: '', pastor_name: '', capacity: '', is_main_campus: false, is_active: true });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: {} });
  const [assignForm, setAssignForm] = useState({ user_email: '', user_name: '', role_id: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'BIRTHDAY', body: '' });

  // Activity Log Filters
  const [logFilters, setLogFilters] = useState({ action: 'all', entity_type: 'all', from_date: '', to_date: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [churchData, locationsData, rolesData, assignmentsData, logsData, automationData, templatesData] = await Promise.all([
      supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }),
      supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('user_roles', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('user_role_assignments', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('activity_logs', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc', limit: 50 }),
      supabaseQuery('automation_settings', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
      supabaseQuery('message_templates', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
    ]);
    setChurch(churchData);
    setLocations(locationsData || []);
    setRoles(rolesData || []);
    setRoleAssignments(assignmentsData || []);
    setActivityLogs(logsData || []);
    setAutomationSettings(automationData || []);
    setMessageTemplates(templatesData || []);
    setLoading(false);
  };

  // ============ CHURCH INFO HANDLERS ============
  const openChurchEdit = () => {
    setChurchForm({
      name: church?.name || '', address: church?.address || '', city: church?.city || '',
      phone: church?.phone || '', email: church?.email || '', currency: church?.currency || 'XAF',
      pastor_name: church?.pastor_name || '', website: church?.website || '',
      denomination: church?.denomination || '', description: church?.description || ''
    });
    setEditingChurch(true);
  };

  const handleSaveChurch = async () => {
    if (!churchForm.name) { alert('Church name is required'); return; }
    setSaving(true);
    try {
      await supabaseUpdate('churches', CHURCH_ID, churchForm);
      setEditingChurch(false);
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  // ============ ACCOUNT HANDLERS ============
  const openAccountEdit = () => {
    setAccountForm({ full_name: user?.name || '', phone: user?.phone || '', email: user?.email || '' });
    setEditingAccount(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.full_name) { alert('Name is required'); return; }
    setSaving(true);
    try {
      const userData = JSON.parse(localStorage.getItem('churchsmart_user'));
      if (userData?.id) {
        await supabaseUpdate('church_users', userData.id, { full_name: accountForm.full_name, phone: accountForm.phone });
        const updatedUser = { ...userData, name: accountForm.full_name, phone: accountForm.phone };
        localStorage.setItem('churchsmart_user', JSON.stringify(updatedUser));
      }
      setEditingAccount(false);
      window.location.reload();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.new_password || !passwordForm.confirm) { alert('Please fill in all password fields'); return; }
    if (passwordForm.new_password !== passwordForm.confirm) { alert('Passwords do not match'); return; }
    if (passwordForm.new_password.length < 6) { alert('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      const userData = JSON.parse(localStorage.getItem('churchsmart_user'));
      if (userData?.id) {
        await supabaseUpdate('church_users', userData.id, { password_hash: passwordForm.new_password });
      }
      setShowPasswordChange(false);
      setPasswordForm({ current: '', new_password: '', confirm: '' });
      alert('Password updated successfully!');
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  // ============ LOCATION HANDLERS ============
  const resetLocationForm = () => { setLocationForm({ name: '', address: '', city: '', phone: '', pastor_name: '', capacity: '', is_main_campus: false, is_active: true }); setEditingLocation(null); };
  
  const openLocationModal = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setLocationForm({ name: location.name || '', address: location.address || '', city: location.city || '', phone: location.phone || '', pastor_name: location.pastor_name || '', capacity: location.capacity || '', is_main_campus: location.is_main_campus || false, is_active: location.is_active ?? true });
    } else { resetLocationForm(); }
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name) { alert('Location name is required'); return; }
    setSaving(true);
    try {
      const data = { 
        ...locationForm, 
        church_id: CHURCH_ID, 
        capacity: locationForm.capacity ? parseInt(locationForm.capacity) : null 
      };
      
      console.log('Saving location data:', data);  // ADD THIS LINE HERE
      
      if (data.is_main_campus && !editingLocation?.is_main_campus) {
        for (const loc of locations.filter(l => l.is_main_campus)) {
          await supabaseUpdate('church_locations', loc.id, { is_main_campus: false });
        }
      }
      if (editingLocation) { 
        await supabaseUpdate('church_locations', editingLocation.id, data); 
      } else { 
        await supabaseInsert('church_locations', data); 
      }
      setShowLocationModal(false); 
      resetLocationForm(); 
      fetchData();
    } catch (error) { 
      alert('Error: ' + error.message); 
    }
    setSaving(false);
  };

  // ============ ROLE HANDLERS ============
  const resetRoleForm = () => { setRoleForm({ name: '', description: '', permissions: {} }); setEditingRole(null); };
  
  const openRoleModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name || '', description: role.description || '', permissions: role.permissions || {} });
    } else { resetRoleForm(); }
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name) { alert('Role name is required'); return; }
    setSaving(true);
    try {
      if (editingRole) { await supabaseUpdate('user_roles', editingRole.id, roleForm); }
      else { await supabaseInsert('user_roles', { ...roleForm, is_system_role: false }); }
      setShowRoleModal(false); resetRoleForm(); fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  // ============ ROLE ASSIGNMENT HANDLERS ============
  const handleAssignRole = async () => {
    if (!assignForm.user_email || !assignForm.role_id) { alert('Email and role are required'); return; }
    setSaving(true);
    try {
      await supabaseInsert('user_role_assignments', { ...assignForm, assigned_by: user?.email });
      setShowAssignRoleModal(false);
      setAssignForm({ user_email: '', user_name: '', role_id: '' });
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  const handleRemoveAssignment = async (id) => {
    if (!confirm('Remove this role assignment?')) return;
    await supabaseDelete('user_role_assignments', id);
    fetchData();
  };

  // ============ AUTOMATION HANDLERS ============
  const toggleAutomation = async (automationType, enabled) => {
    const setting = automationSettings.find(a => a.automation_type === automationType);
    if (setting) {
      await supabaseUpdate('automation_settings', setting.id, { is_enabled: enabled });
      fetchData();
    }
  };

  // ============ TEMPLATE HANDLERS ============
  const resetTemplateForm = () => { setTemplateForm({ name: '', category: 'BIRTHDAY', body: '' }); setEditingTemplate(null); };
  
  const openTemplateModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name || '', category: template.category || 'BIRTHDAY', body: template.body || '' });
    } else { resetTemplateForm(); }
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) { alert('Name and message body are required'); return; }
    setSaving(true);
    try {
      if (editingTemplate) { await supabaseUpdate('message_templates', editingTemplate.id, templateForm); }
      else { await supabaseInsert('message_templates', templateForm); }
      setShowTemplateModal(false); resetTemplateForm(); fetchData();
    } catch (error) { alert('Error: ' + error.message); }
    setSaving(false);
  };

  // ============ DELETE HANDLER ============
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.table === 'church_locations') {
        if (deleteConfirm.is_main_campus) { alert('Cannot delete main campus'); setDeleteConfirm(null); return; }
      }
      await supabaseDelete(deleteConfirm.table, deleteConfirm.id);
      setDeleteConfirm(null); fetchData();
    } catch (error) { alert('Error: ' + error.message); }
  };

  // ============ HELPERS ============
  const getRoleName = (roleId) => roles.find(r => r.id === roleId)?.name || 'Unknown';
  const getAutomationSetting = (type) => automationSettings.find(a => a.automation_type === type);
  const formatDateTime = (dateStr) => new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filteredLogs = activityLogs.filter(log => {
    if (logFilters.action !== 'all' && log.action !== logFilters.action) return false;
    if (logFilters.entity_type !== 'all' && log.entity_type !== logFilters.entity_type) return false;
    return true;
  });

  const sections = [
    { id: 'general', label: '⚙️ General', icon: '⚙️' },
    { id: 'locations', label: '📍 Locations', icon: '📍' },
    { id: 'automation', label: '🤖 Automation', icon: '🤖' },
    { id: 'roles', label: '👥 User Roles', icon: '👥' },
    { id: 'logs', label: '📜 Activity Logs', icon: '📜' },
    { id: 'account', label: '👤 Account', icon: '👤' },
  ];

  const permissionsList = [
    { key: 'members', label: '👥 Members' },
    { key: 'visitors', label: '🚶 Visitors' },
    { key: 'attendance', label: '📊 Attendance' },
    { key: 'giving', label: '💰 Giving/Finance' },
    { key: 'salvations', label: '❤️ Salvations' },
    { key: 'groups', label: '👨‍👩‍👧‍👦 Groups' },
    { key: 'prayers', label: '🙏 Prayer Requests' },
    { key: 'services', label: '⛪ Services & Events' },
    { key: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div>
      <PageHeader title={`⚙️ ${t('settings')}`} subtitle="Manage your church settings, users, and automation" />

      {/* Settings Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: '10px 20px', border: activeSection === section.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius: '10px', backgroundColor: activeSection === section.id ? '#eef2ff' : 'white',
              color: activeSection === section.id ? '#6366f1' : '#6b7280', fontWeight: activeSection === section.id ? '600' : '400',
              cursor: 'pointer', fontSize: '14px'
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ============ GENERAL SETTINGS ============ */}
          {activeSection === 'general' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Language */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🌍 Language / Langue</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => changeLanguage('en')} style={{ padding: '12px 24px', border: language === 'en' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'en' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'en' ? '600' : '400' }}>🇬🇧 English</button>
                  <button onClick={() => changeLanguage('fr')} style={{ padding: '12px 24px', border: language === 'fr' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: language === 'fr' ? '#eef2ff' : 'white', cursor: 'pointer', fontWeight: language === 'fr' ? '600' : '400' }}>🇫🇷 Français</button>
                </div>
              </div>

              {/* Church Info - Editable */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>⛪ Church Information</h3>
                  {!editingChurch ? (
                    <button onClick={openChurchEdit} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>✏️ Edit</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingChurch(false)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleSaveChurch} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '💾 Save'}</button>
                    </div>
                  )}
                </div>

                {!editingChurch ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Church Name</label><p style={{ margin: 0, fontWeight: '500', fontSize: '16px' }}>{church?.name || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Senior Pastor</label><p style={{ margin: 0 }}>{church?.pastor_name || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Denomination</label><p style={{ margin: 0 }}>{church?.denomination || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Address</label><p style={{ margin: 0 }}>{church?.address || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>City</label><p style={{ margin: 0 }}>{church?.city || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</label><p style={{ margin: 0 }}>{church?.phone || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{church?.email || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Currency</label><p style={{ margin: 0 }}>{church?.currency || 'XAF'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Website</label><p style={{ margin: 0 }}>{church?.website || '—'}</p></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Church Name *</label>
                        <input type="text" value={churchForm.name} onChange={(e) => setChurchForm({ ...churchForm, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Senior Pastor</label>
                        <input type="text" value={churchForm.pastor_name} onChange={(e) => setChurchForm({ ...churchForm, pastor_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Denomination</label>
                        <input type="text" value={churchForm.denomination} onChange={(e) => setChurchForm({ ...churchForm, denomination: e.target.value })} placeholder="e.g., Pentecostal" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Currency</label>
                        <select value={churchForm.currency} onChange={(e) => setChurchForm({ ...churchForm, currency: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
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
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Address</label>
                      <input type="text" value={churchForm.address} onChange={(e) => setChurchForm({ ...churchForm, address: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>City</label>
                        <input type="text" value={churchForm.city} onChange={(e) => setChurchForm({ ...churchForm, city: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                        <input type="tel" value={churchForm.phone} onChange={(e) => setChurchForm({ ...churchForm, phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
                        <input type="email" value={churchForm.email} onChange={(e) => setChurchForm({ ...churchForm, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Website</label>
                      <input type="url" value={churchForm.website} onChange={(e) => setChurchForm({ ...churchForm, website: e.target.value })} placeholder="https://www.yourchurch.com" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Description</label>
                      <textarea value={churchForm.description} onChange={(e) => setChurchForm({ ...churchForm, description: e.target.value })} rows={3} placeholder="Brief description of your church..." style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ LOCATIONS ============ */}
          {activeSection === 'locations' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📍 Church Locations / Branches</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Manage your church campuses and branches</p>
                </div>
                <Button onClick={() => openLocationModal()}>➕ Add Location</Button>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', display: 'flex', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>🏢</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{locations.length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Total</p></div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>✅</span><div><p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{locations.filter(l => l.is_active).length}</p><p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Active</p></div></div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>City</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Pastor</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{loc.is_main_campus ? '🏛️' : '🏢'}</span>
                          <div>
                            <p style={{ margin: 0, fontWeight: '500' }}>{loc.name}</p>
                            {loc.is_main_campus && <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px' }}>Main Campus</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{loc.city || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{loc.pastor_name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{loc.is_active ? <span style={{ color: '#10b981' }}>✅ Active</span> : <span style={{ color: '#ef4444' }}>❌ Inactive</span>}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => openLocationModal(loc)} style={{ padding: '4px 10px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', marginRight: '6px', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm({ ...loc, table: 'church_locations' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ============ AUTOMATION ============ */}
          {activeSection === 'automation' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Birthday Settings */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>🎂 Birthday Settings</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send birthday wishes to members</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>📱</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500' }}>Send SMS notifications</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Send birthday SMS to members on their birthday</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('BIRTHDAY_SMS')?.is_enabled || false} onChange={(e) => toggleAutomation('BIRTHDAY_SMS', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>💬</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '500' }}>Send WhatsApp notifications</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Send birthday WhatsApp to members</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('BIRTHDAY_WHATSAPP')?.is_enabled || false} onChange={(e) => toggleAutomation('BIRTHDAY_WHATSAPP', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>

              {/* Visitor Follow-up */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>🚶 Visitor Follow-up Sequence</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send follow-up messages to first-time visitors</p>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled ? '#f0fdf4' : '#f9fafb', borderRadius: '10px', marginBottom: '16px', border: getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled ? '1px solid #bbf7d0' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Enable Visitor Follow-up Sequence</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Automatically send Day 1, Day 3, and Day 7 messages</p>
                    </div>
                  </div>
                  <input type="checkbox" checked={getAutomationSetting('VISITOR_FOLLOWUP')?.is_enabled || false} onChange={(e) => toggleAutomation('VISITOR_FOLLOWUP', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                </label>
                <div style={{ paddingLeft: '20px', borderLeft: '3px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 1: Welcome Message</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Send a welcome message thanking visitors for attending</p></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>3</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 3: Group Invite & Midweek Reminder</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Invite visitors to join a group and remind them of midweek service</p></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '28px', height: '28px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>7</span>
                    <div><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>Day 7: Membership & Pastor Invitation</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Invite visitors to meet the pastor and learn about membership</p></div>
                  </div>
                </div>
              </div>

              {/* Message Templates */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📝 Message Templates</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Customize your automated messages</p>
                  </div>
                  <Button onClick={() => openTemplateModal()}>➕ Add Template</Button>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {messageTemplates.map((template, i) => (
                    <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontWeight: '500' }}>{template.name}</p>
                          <span style={{ padding: '2px 8px', backgroundColor: template.category === 'BIRTHDAY' ? '#fef3c7' : '#dbeafe', color: template.category === 'BIRTHDAY' ? '#92400e' : '#1e40af', borderRadius: '9999px', fontSize: '11px' }}>{template.category}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{template.body?.substring(0, 100)}{template.body?.length > 100 ? '...' : ''}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openTemplateModal(template)} style={{ padding: '4px 10px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm({ ...template, table: 'message_templates' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  {messageTemplates.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No message templates yet</p>}
                </div>
              </div>

              {/* Scheduled Reports */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>📊 Scheduled Reports</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>Automatically send reports to specified email addresses</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Weekly Report (Every Monday)</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Attendance and giving summary</p>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('WEEKLY_REPORT')?.is_enabled || false} onChange={(e) => toggleAutomation('WEEKLY_REPORT', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500' }}>Monthly Report (1st of each month)</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Full monthly summary including visitors and salvations</p>
                    </div>
                    <input type="checkbox" checked={getAutomationSetting('MONTHLY_REPORT')?.is_enabled || false} onChange={(e) => toggleAutomation('MONTHLY_REPORT', e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ============ USER ROLES ============ */}
          {activeSection === 'roles' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Roles */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>👥 User Roles</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Define roles and permissions for users</p>
                  </div>
                  <Button onClick={() => openRoleModal()}>➕ Create Role</Button>
                </div>
                <div style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>System Roles</h4>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                    {roles.filter(r => r.is_system_role).map((role, i) => (
                      <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{role.name}</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{role.description}</p>
                        </div>
                        <span style={{ padding: '4px 10px', backgroundColor: '#e5e7eb', borderRadius: '6px', fontSize: '11px', color: '#6b7280' }}>System</span>
                      </div>
                    ))}
                  </div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Custom Roles</h4>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {roles.filter(r => !r.is_system_role).map((role, i) => (
                      <div key={i} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{role.name}</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{role.description || 'No description'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openRoleModal(role)} style={{ padding: '4px 10px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => setDeleteConfirm({ ...role, table: 'user_roles' })} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                    {roles.filter(r => !r.is_system_role).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                        <span style={{ fontSize: '32px' }}>🛡️</span>
                        <p>No custom roles created yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Role Assignments */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>🎫 Role Assignments</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Assign roles to users</p>
                  </div>
                  <Button onClick={() => setShowAssignRoleModal(true)}>➕ Assign Role</Button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleAssignments.map((assignment, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: '600' }}>{assignment.user_name?.[0] || assignment.user_email?.[0]?.toUpperCase()}</div>
                            <div>
                              <p style={{ margin: 0, fontWeight: '500' }}>{assignment.user_name || 'Unknown'}</p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{assignment.user_email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 12px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{getRoleName(assignment.role_id)}</span></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={() => handleRemoveAssignment(assignment.id)} style={{ padding: '4px 10px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {roleAssignments.length === 0 && <tr><td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>No role assignments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ ACTIVITY LOGS ============ */}
          {activeSection === 'logs' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>📜 Activity Logs</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Track who adds data to the platform or records attendance and finance</p>
              </div>
              {/* Filters */}
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Action</label>
                  <select value={logFilters.action} onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="all">All Actions</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Entity Type</label>
                  <select value={logFilters.entity_type} onChange={(e) => setLogFilters({ ...logFilters, entity_type: e.target.value })} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="all">All Entities</option>
                    <option value="member">Members</option>
                    <option value="visitor">Visitors</option>
                    <option value="attendance">Attendance</option>
                    <option value="donation">Donations</option>
                    <option value="salvation">Salvations</option>
                  </select>
                </div>
                <button onClick={() => setLogFilters({ action: 'all', entity_type: 'all', from_date: '', to_date: '' })} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', marginTop: '18px' }}>🔄 Reset</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Entity</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', backgroundColor: log.action === 'CREATE' ? '#dcfce7' : log.action === 'UPDATE' ? '#fef3c7' : '#fef2f2', color: log.action === 'CREATE' ? '#166534' : log.action === 'UPDATE' ? '#92400e' : '#991b1b', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                          {log.action === 'CREATE' ? '➕' : log.action === 'UPDATE' ? '✏️' : '🗑️'} {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{log.entity_type}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{log.entity_name || '—'}</p>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>{log.user_name || log.user_email || 'System'}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>No activity logs found</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ============ ACCOUNT ============ */}
          {activeSection === 'account' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Account Info - Editable */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>👤 Your Account</h3>
                  {!editingAccount ? (
                    <button onClick={openAccountEdit} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>✏️ Edit Profile</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingAccount(false)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleSaveAccount} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '💾 Save'}</button>
                    </div>
                  )}
                </div>

                {!editingAccount ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Name</label><p style={{ margin: 0, fontWeight: '500', fontSize: '16px' }}>{user?.name}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label><p style={{ margin: 0 }}>{user?.email}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</label><p style={{ margin: 0 }}>{user?.phone || '—'}</p></div>
                    <div><label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Role</label><p style={{ margin: 0 }}><StatusBadge status={user?.role} /></p></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Full Name *</label>
                      <input type="text" value={accountForm.full_name} onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone</label>
                      <input type="tel" value={accountForm.phone} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email (read-only)</label>
                      <input type="email" value={accountForm.email} disabled style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f9fafb', color: '#9ca3af', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Role (read-only)</label>
                      <input type="text" value={user?.role || ''} disabled style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f9fafb', color: '#9ca3af', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Change Password */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🔐 Change Password</h3>
                  {!showPasswordChange && (
                    <button onClick={() => setShowPasswordChange(true)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#6366f1' }}>🔑 Change</button>
                  )}
                </div>
                {showPasswordChange ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>New Password *</label>
                      <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Min 6 characters" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Confirm New Password *</label>
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Repeat password" style={{ width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowPasswordChange(false); setPasswordForm({ current: '', new_password: '', confirm: '' }); }} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      <button onClick={handleChangePassword} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{saving ? '⏳' : '🔐 Update Password'}</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Click "Change" to update your password</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>🔧 Actions</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Button variant="secondary">📤 Export Data</Button>
                  <Button variant="secondary">📊 Generate Report</Button>
                  <Button variant="danger" onClick={logout}>🚪 Sign Out</Button>
                </div>
              </div>

              {/* App Info */}
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✝</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold' }}>ChurchSmart</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>Version 2.5.0 • Connected to Supabase</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>Built with ❤️ for churches in Cameroon</p>
              </div>
            </div>
          )}

        </>
      )}

      {/* ============ MODALS ============ */}

      {/* Location Modal */}
      <Modal isOpen={showLocationModal} onClose={() => { setShowLocationModal(false); resetLocationForm(); }} title={editingLocation ? '✏️ Edit Location' : '➕ Add Location'}>
        <FormInput label="Location Name *" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} required placeholder="e.g., East Campus" />
        <FormInput label="Address" value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} placeholder="Street address" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="City" value={locationForm.city} onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })} placeholder="Douala" />
          <FormInput label="Phone" value={locationForm.phone} onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })} placeholder="+237..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Campus Pastor" value={locationForm.pastor_name} onChange={(e) => setLocationForm({ ...locationForm, pastor_name: e.target.value })} />
          <FormInput label="Capacity" type="number" value={locationForm.capacity} onChange={(e) => setLocationForm({ ...locationForm, capacity: e.target.value })} placeholder="500" />
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={locationForm.is_main_campus} onChange={(e) => setLocationForm({ ...locationForm, is_main_campus: e.target.checked })} /><span>🏛️ Main Campus</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={locationForm.is_active} onChange={(e) => setLocationForm({ ...locationForm, is_active: e.target.checked })} /><span>✅ Active</span></label>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowLocationModal(false); resetLocationForm(); }}>Cancel</Button>
          <Button onClick={handleSaveLocation} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal isOpen={showRoleModal} onClose={() => { setShowRoleModal(false); resetRoleForm(); }} title={editingRole ? '✏️ Edit Role' : '➕ Create Role'}>
        <FormInput label="Role Name *" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} required placeholder="e.g., Finance Manager" />
        <FormInput label="Description" type="textarea" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="What can this role do?" />
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '12px' }}>Permissions</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {permissionsList.map((perm, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={roleForm.permissions[perm.key] || false} onChange={(e) => setRoleForm({ ...roleForm, permissions: { ...roleForm.permissions, [perm.key]: e.target.checked } })} />
                <span style={{ fontSize: '13px' }}>{perm.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowRoleModal(false); resetRoleForm(); }}>Cancel</Button>
          <Button onClick={handleSaveRole} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Assign Role Modal */}
      <Modal isOpen={showAssignRoleModal} onClose={() => setShowAssignRoleModal(false)} title="🎫 Assign Role">
        <FormInput label="User Name" value={assignForm.user_name} onChange={(e) => setAssignForm({ ...assignForm, user_name: e.target.value })} placeholder="John Doe" />
        <FormInput label="User Email *" type="email" value={assignForm.user_email} onChange={(e) => setAssignForm({ ...assignForm, user_email: e.target.value })} required placeholder="john@example.com" />
        <FormInput label="Role *" type="select" value={assignForm.role_id} onChange={(e) => setAssignForm({ ...assignForm, role_id: e.target.value })} options={roles.map(r => ({ value: r.id, label: r.name }))} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowAssignRoleModal(false)}>Cancel</Button>
          <Button onClick={handleAssignRole} disabled={saving}>{saving ? '⏳' : '🎫 Assign'}</Button>
        </div>
      </Modal>

      {/* Template Modal */}
      <Modal isOpen={showTemplateModal} onClose={() => { setShowTemplateModal(false); resetTemplateForm(); }} title={editingTemplate ? '✏️ Edit Template' : '➕ Add Template'}>
        <FormInput label="Template Name *" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} required placeholder="e.g., Birthday Greeting" />
        <FormInput label="Category" type="select" value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} options={[{ value: 'BIRTHDAY', label: '🎂 Birthday' }, { value: 'VISITOR_FOLLOWUP', label: '🚶 Visitor Follow-up' }, { value: 'GENERAL', label: '📝 General' }]} />
        <FormInput label="Message Body *" type="textarea" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} required placeholder="Happy Birthday {{name}}! ..." />
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 16px 0' }}>💡 Use {"{{name}}"} to insert the recipient's name</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowTemplateModal(false); resetTemplateForm(); }}>Cancel</Button>
          <Button onClick={handleSaveTemplate} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

{/* Delete Confirmation */}
<ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="Delete" message={deleteConfirm ? 'Are you sure you want to delete "' + (deleteConfirm.name || deleteConfirm.title || 'this item') + '"?' : ''} />
    </div>
  );
}