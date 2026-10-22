'use client';
import { useState, useEffect } from 'react';
import { supabase, isValidEmail } from '../lib/cs-shared';
import { useAuth } from '../lib/cs-contexts';
import { useToast } from '../lib/cs-contexts';
import { PLAN_PRICING } from '../lib/featureGating';

// ==========================================
// MODERN LANDING PAGE
// ==========================================

export default function LandingPage() {
  const { login, forgotPassword, passwordRecovery, setPasswordRecovery } = useAuth();
  const toast = useToast();

  // UI state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [lang, setLang] = useState('en');
  const [scrolled, setScrolled] = useState(false);

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(passwordRecovery || false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', confirm_password: ''
  });

  // Detect scroll for navbar shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Detect password reset redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true' || window.location.hash?.includes('type=recovery')) {
      setShowResetForm(true);
      setShowAuthModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Pre-selected plan from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const planParam = params.get('plan');
      if (planParam && ['starter', 'growth', 'pro'].includes(planParam.toLowerCase())) {
        localStorage.setItem('selected_plan', planParam.toLowerCase());
      }
      const billingParam = params.get('billing');
      if (billingParam && ['monthly', 'annual'].includes(billingParam.toLowerCase())) {
        localStorage.setItem('selected_billing', billingParam.toLowerCase());
        setBillingPeriod(billingParam.toLowerCase());
      }
    }
  }, []);

  // ==========================================
  // TRANSLATIONS
  // ==========================================
  const txt = {
    en: {
      nav: { features: 'Features', pricing: 'Pricing', signIn: 'Sign In', getStarted: 'Get Started Free' },
      hero: {
        badge: 'Built for African Churches',
        title: 'Manage Your Church',
        titleHighlight: 'Smarter',
        subtitle: 'The all-in-one platform to manage members, track giving, send messages, and grow your congregation — designed specifically for churches in Africa.',
        cta1: 'Start Free Today',
        cta2: 'See Pricing',
        stat1: '500+', stat1Label: 'Churches',
        stat2: '50K+', stat2Label: 'Members Managed',
        stat3: '10+', stat3Label: 'Countries'
      },
      features: {
        badge: 'Everything You Need',
        title: 'Powerful Tools for Your Church',
        subtitle: 'From member management to financial tracking, ChurchSmart has everything your church needs to operate efficiently.'
      },
      featureList: [
        { icon: '👥', title: 'Member Management', desc: 'Track members, visitors, and groups across all your locations with detailed profiles and attendance history.' },
        { icon: '💰', title: 'Financial Tracking', desc: 'Manage tithes, offerings, and expenses. Generate detailed reports and track giving trends over time.' },
        { icon: '📊', title: 'Smart Reports', desc: 'Real-time analytics and insights for attendance, giving patterns, and church growth metrics.' },
        { icon: '💬', title: 'SMS & WhatsApp', desc: 'Send automated birthday messages, event reminders, and bulk communications to your congregation.' },
        { icon: '🙋‍♂️', title: 'Volunteer Management', desc: 'Organize ministry teams, manage schedules, and coordinate volunteer activities effortlessly.' },
        { icon: '🌍', title: 'Multi-Location', desc: 'Manage multiple campuses from a single dashboard with location-specific reports and settings.' }
      ],
      pricing: {
        badge: 'Simple Pricing',
        title: 'Plans That Grow With Your Church',
        subtitle: 'Start free, upgrade when you need more. All plans include a 30-day free trial.',
        monthly: 'Monthly',
        annual: 'Annual',
        annualSave: 'Save 2 months',
        perMonth: '/month',
        perYear: '/year',
        currentPlan: 'Current Plan',
        getStarted: 'Get Started',
        popular: 'Most Popular',
        features: 'Features included:'
      },
      plans: {
        free: { name: 'Free', desc: 'For small churches just getting started', features: ['Up to 50 members', '1 admin user', 'Basic attendance tracking', 'Simple giving records', 'Dashboard & reports'] },
        starter: { name: 'Starter', desc: 'Essential tools for growing churches', features: ['Up to 200 members', '2 admin users', 'Visitor management', 'Email messaging (100/mo)', 'Groups & volunteers', 'Data import/export'] },
        growth: { name: 'Growth', desc: 'Advanced features for established churches', features: ['Unlimited members', '5 admin users', 'WhatsApp messaging', 'Multi-location (3 sites)', 'Advanced reports', 'Auto birthday messages'] },
        pro: { name: 'Pro', desc: 'Full power for large ministries', features: ['Unlimited everything', 'Unlimited admins', 'SMS messaging', 'Unlimited locations', 'Custom reports', 'Priority support'] }
      },
      cta: {
        title: 'Ready to Transform Your Church Management?',
        subtitle: 'Join 500+ churches already using ChurchSmart. Start free — no credit card required.',
        btn: 'Get Started Free'
      },
      footer: {
        tagline: 'Empowering African churches with smart technology.',
        product: 'Product', features: 'Features', pricing: 'Pricing', security: 'Security',
        company: 'Company', about: 'About Us', contact: 'Contact', blog: 'Blog',
        support: 'Support', docs: 'Documentation', help: 'Help Center', status: 'System Status',
        copy: '© 2026 ChurchSmart by DigiSmart Africa. All rights reserved.'
      },
      auth: {
        welcome: 'Welcome back!', signInDesc: 'Sign in to your church dashboard',
        createAccount: 'Create your account', getStarted: 'Get started with ChurchSmart today',
        signIn: 'Sign In', register: 'Register', email: 'Email Address', password: 'Password',
        fullName: 'Full Name', phone: 'Phone', confirmPassword: 'Confirm Password',
        rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
        signingIn: 'Please wait...', signInBtn: 'Sign In', createBtn: 'Send Verification Code',
        secure: 'Secure • Encrypted • GDPR Compliant',
        orContinueWith: 'or continue with', googleSignIn: 'Sign in with Google',
        forgotTitle: 'Reset Password', forgotDesc: 'Enter your email and we\'ll send a reset link',
        sendResetLink: 'Send Reset Link', backToLogin: 'Back to Login',
        resetSent: 'Password reset link sent! Check your email.',
        newPasswordTitle: 'Set New Password', newPasswordDesc: 'Enter your new password below',
        newPassword: 'New Password', confirmNewPassword: 'Confirm New Password',
        updatePassword: 'Update Password', passwordUpdated: 'Password updated! You can now sign in.',
        otpTitle: 'Verify Your Email', otpDesc: 'We sent an 8-digit code to',
        otpPlaceholder: '00000000', verifyCode: 'Verify Code', verifying: 'Verifying...',
        resendCode: 'Resend code', codeSent: 'New code sent!', invalidCode: 'Invalid code. Please try again.',
        step1: 'Sign Up', step2: 'Verify'
      }
    },
    fr: {
      nav: { features: 'Fonctionnalités', pricing: 'Tarifs', signIn: 'Connexion', getStarted: 'Commencer Gratuitement' },
      hero: {
        badge: 'Conçu pour les Églises Africaines',
        title: 'Gérez Votre Église',
        titleHighlight: 'Intelligemment',
        subtitle: 'La plateforme tout-en-un pour gérer les membres, suivre les dons, envoyer des messages et développer votre congrégation — conçue pour les églises d\'Afrique.',
        cta1: 'Commencer Gratuitement',
        cta2: 'Voir les Tarifs',
        stat1: '500+', stat1Label: 'Églises',
        stat2: '50K+', stat2Label: 'Membres Gérés',
        stat3: '10+', stat3Label: 'Pays'
      },
      features: {
        badge: 'Tout ce dont vous avez besoin',
        title: 'Des Outils Puissants pour Votre Église',
        subtitle: 'De la gestion des membres au suivi financier, ChurchSmart a tout ce dont votre église a besoin.'
      },
      featureList: [
        { icon: '👥', title: 'Gestion des Membres', desc: 'Suivez les membres, visiteurs et groupes avec des profils détaillés et l\'historique de présence.' },
        { icon: '💰', title: 'Suivi Financier', desc: 'Gérez les dîmes, offrandes et dépenses. Générez des rapports détaillés et suivez les tendances.' },
        { icon: '📊', title: 'Rapports Intelligents', desc: 'Analyses en temps réel pour la fréquentation, les dons et les métriques de croissance.' },
        { icon: '💬', title: 'SMS & WhatsApp', desc: 'Messages d\'anniversaire automatiques, rappels d\'événements et communications en masse.' },
        { icon: '🙋‍♂️', title: 'Gestion des Bénévoles', desc: 'Organisez les équipes de ministère, gérez les horaires et coordonnez les activités.' },
        { icon: '🌍', title: 'Multi-Sites', desc: 'Gérez plusieurs campus depuis un seul tableau de bord avec des rapports par site.' }
      ],
      pricing: {
        badge: 'Tarification Simple',
        title: 'Des Plans Qui Grandissent Avec Votre Église',
        subtitle: 'Commencez gratuitement, évoluez selon vos besoins. Essai gratuit de 30 jours.',
        monthly: 'Mensuel',
        annual: 'Annuel',
        annualSave: '2 mois gratuits',
        perMonth: '/mois',
        perYear: '/an',
        currentPlan: 'Plan Actuel',
        getStarted: 'Commencer',
        popular: 'Le Plus Populaire',
        features: 'Fonctionnalités incluses :'
      },
      plans: {
        free: { name: 'Gratuit', desc: 'Pour les petites églises qui débutent', features: ['Jusqu\'à 50 membres', '1 administrateur', 'Suivi de présence basique', 'Registres de dons simples', 'Tableau de bord & rapports'] },
        starter: { name: 'Starter', desc: 'Outils essentiels pour les églises en croissance', features: ['Jusqu\'à 200 membres', '2 administrateurs', 'Gestion des visiteurs', 'Email (100/mois)', 'Groupes & bénévoles', 'Import/export de données'] },
        growth: { name: 'Growth', desc: 'Fonctionnalités avancées pour les églises établies', features: ['Membres illimités', '5 administrateurs', 'Messagerie WhatsApp', 'Multi-sites (3 campus)', 'Rapports avancés', 'Messages anniversaire auto'] },
        pro: { name: 'Pro', desc: 'Toute la puissance pour les grands ministères', features: ['Tout illimité', 'Admins illimités', 'Messagerie SMS', 'Sites illimités', 'Rapports personnalisés', 'Support prioritaire'] }
      },
      cta: {
        title: 'Prêt à Transformer la Gestion de Votre Église ?',
        subtitle: 'Rejoignez 500+ églises utilisant déjà ChurchSmart. Commencez gratuitement — pas de carte requise.',
        btn: 'Commencer Gratuitement'
      },
      footer: {
        tagline: 'Donner aux églises africaines les moyens de la technologie intelligente.',
        product: 'Produit', features: 'Fonctionnalités', pricing: 'Tarifs', security: 'Sécurité',
        company: 'Entreprise', about: 'À Propos', contact: 'Contact', blog: 'Blog',
        support: 'Support', docs: 'Documentation', help: 'Centre d\'Aide', status: 'État du Système',
        copy: '© 2026 ChurchSmart par DigiSmart Africa. Tous droits réservés.'
      },
      auth: {
        welcome: 'Bon retour!', signInDesc: 'Connectez-vous à votre tableau de bord',
        createAccount: 'Créer votre compte', getStarted: 'Commencez avec ChurchSmart',
        signIn: 'Connexion', register: 'S\'inscrire', email: 'Adresse Email', password: 'Mot de passe',
        fullName: 'Nom Complet', phone: 'Téléphone', confirmPassword: 'Confirmer le mot de passe',
        rememberMe: 'Se souvenir de moi', forgotPassword: 'Mot de passe oublié?',
        signingIn: 'Veuillez patienter...', signInBtn: 'Connexion', createBtn: 'Envoyer le Code',
        secure: 'Sécurisé • Chiffré • Conforme RGPD',
        orContinueWith: 'ou continuer avec', googleSignIn: 'Se connecter avec Google',
        forgotTitle: 'Réinitialiser le mot de passe', forgotDesc: 'Entrez votre email pour recevoir un lien',
        sendResetLink: 'Envoyer le lien', backToLogin: 'Retour à la connexion',
        resetSent: 'Lien envoyé! Vérifiez votre email.',
        newPasswordTitle: 'Nouveau mot de passe', newPasswordDesc: 'Entrez votre nouveau mot de passe',
        newPassword: 'Nouveau mot de passe', confirmNewPassword: 'Confirmer le mot de passe',
        updatePassword: 'Mettre à jour', passwordUpdated: 'Mot de passe mis à jour!',
        otpTitle: 'Vérifiez votre email', otpDesc: 'Nous avons envoyé un code à 8 chiffres à',
        otpPlaceholder: '00000000', verifyCode: 'Vérifier le code', verifying: 'Vérification...',
        resendCode: 'Renvoyer le code', codeSent: 'Nouveau code envoyé!', invalidCode: 'Code invalide. Réessayez.',
        step1: 'Inscription', step2: 'Vérifier'
      }
    }
  };
  const t = txt[lang];

  // ==========================================
  // AUTH HANDLERS (same logic as before)
  // ==========================================
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
        if (!isValidEmail(form.email)) { setError(lang === 'fr' ? 'Format d\'email invalide' : 'Invalid email format'); return; }
        if (form.password !== form.confirm_password) { setError(lang === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match'); return; }
        if (form.password.length < 8) { setError(lang === 'fr' ? 'Le mot de passe doit contenir au moins 8 caractères' : 'Password must be at least 8 characters'); return; }
        if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError(lang === 'fr' ? 'Le mot de passe doit contenir une majuscule et un chiffre' : 'Password must include an uppercase letter and a number'); return; }
        setLoading(true);
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.email.trim().toLowerCase(),
            password: form.password,
            options: { data: { full_name: form.full_name }, emailRedirectTo: undefined }
          });
          if (authError) {
            if (authError.message?.includes('already registered')) {
              setError(lang === 'fr' ? 'Cet email est déjà enregistré. Connectez-vous.' : 'This email is already registered. Please sign in.');
            } else { setError(authError.message); }
            setLoading(false);
            return;
          }
          setOtpEmail(form.email.trim().toLowerCase());
          setStep(2);
        } catch (err) { setError('Failed to send verification code'); }
        setLoading(false);
      } else if (step === 2) {
        if (!otpCode || otpCode.length !== 8) { setError(lang === 'fr' ? 'Entrez le code à 8 chiffres' : 'Enter the 8-digit code'); return; }
        setLoading(true);
        try {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            email: otpEmail, token: otpCode, type: 'signup'
          });
          if (verifyError) { setError(t.auth.invalidCode); setLoading(false); return; }
          if (verifyData?.session) { await supabase.auth.setSession(verifyData.session); }
          window.location.reload();
          return;
        } catch (err) { setError(err.message || 'Verification failed'); }
        setLoading(false);
      }
    }
  };

  const handleResendOTP = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: otpEmail });
      if (error) { setError(error.message); } else { setSuccess(t.auth.codeSent); }
    } catch (err) { setError('Failed to resend code'); }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: window.location.origin }
      });
      if (error) { setError(error.message); setLoading(false); }
    } catch (err) { setError('Google sign-in failed.'); setLoading(false); }
  };

  const openAuth = (mode) => {
    setIsLogin(mode === 'login');
    setShowAuthModal(true);
    setError(''); setSuccess(''); setStep(1);
    setShowForgotPassword(false);
  };

  const handlePlanSelect = (planKey) => {
    if (planKey === 'free') {
      openAuth('register');
    } else {
      localStorage.setItem('selected_plan', planKey);
      localStorage.setItem('selected_billing', billingPeriod);
      openAuth('register');
    }
  };

  // ==========================================
  // STYLES
  // ==========================================
  const inputStyle = { width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', transition: 'all 0.2s', outline: 'none', backgroundColor: '#f9fafb', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };
  const btnPrimary = { padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' };
  const btnSecondary = { padding: '14px 28px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(10px)' };

  // ==========================================
  // PRICING DATA
  // ==========================================
  const planKeys = ['free', 'starter', 'growth', 'pro'];
  const planData = planKeys.map(key => ({
    key,
    ...t.plans[key],
    monthlyUsd: PLAN_PRICING[key].monthlyUsd,
    annualUsd: PLAN_PRICING[key].annualUsd,
    monthlyXaf: PLAN_PRICING[key].monthlyXaf,
    annualXaf: PLAN_PRICING[key].annualXaf,
    popular: key === 'growth'
  }));

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ====== NAVBAR ====== */}
      <nav className="cs-landing-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 24px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/churchsmart-logo.svg" alt="ChurchSmart" style={{ height: '32px', width: 'auto' }} />
          </div>
          <div className="cs-landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#features" style={{ fontSize: '15px', fontWeight: '500', color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', transition: 'color 0.3s' }}>{t.nav.features}</a>
            <a href="#pricing" style={{ fontSize: '15px', fontWeight: '500', color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', transition: 'color 0.3s' }}>{t.nav.pricing}</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Language Toggle */}
            <div style={{ display: 'flex', gap: '2px', backgroundColor: scrolled ? '#f3f4f6' : 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '2px' }}>
              <button onClick={() => setLang('en')} style={{ padding: '5px 10px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'en' ? (scrolled ? 'white' : 'rgba(255,255,255,0.25)') : 'transparent', color: scrolled ? (lang === 'en' ? '#4f46e5' : '#6b7280') : 'white', fontWeight: lang === 'en' ? '600' : '400', fontSize: '12px', cursor: 'pointer' }}>EN</button>
              <button onClick={() => setLang('fr')} style={{ padding: '5px 10px', border: 'none', borderRadius: '6px', backgroundColor: lang === 'fr' ? (scrolled ? 'white' : 'rgba(255,255,255,0.25)') : 'transparent', color: scrolled ? (lang === 'fr' ? '#4f46e5' : '#6b7280') : 'white', fontWeight: lang === 'fr' ? '600' : '400', fontSize: '12px', cursor: 'pointer' }}>FR</button>
            </div>
            <button onClick={() => openAuth('login')} className="cs-landing-signin-btn" style={{ padding: '10px 20px', backgroundColor: 'transparent', color: scrolled ? '#4f46e5' : 'white', border: scrolled ? '2px solid #e5e7eb' : '2px solid rgba(255,255,255,0.3)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>{t.nav.signIn}</button>
            <button onClick={() => openAuth('register')} className="cs-landing-cta-btn" style={{ padding: '10px 20px', background: scrolled ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.2)', color: 'white', border: scrolled ? 'none' : '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s' }}>{t.nav.getStarted}</button>
          </div>
        </div>
      </nav>

      {/* ====== HERO SECTION ====== */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4f46e5 50%, #7c3aed 75%, #6d28d9 100%)',
        position: 'relative', overflow: 'hidden', padding: '120px 24px 80px'
      }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', top: '-200px', right: '-200px', width: '600px', height: '600px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-300px', left: '-200px', width: '800px', height: '800px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '20%', left: '10%', width: '200px', height: '200px', backgroundColor: 'rgba(139, 92, 246, 0.15)', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '300px', height: '300px', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: '50%', filter: 'blur(80px)' }} />

        <div style={{ maxWidth: '900px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.15)', marginBottom: '32px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '14px' }}>⛪</span>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>{t.hero.badge}</span>
          </div>

          {/* Headline */}
          <h1 style={{ margin: '0 0 24px 0', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: '800', color: 'white', lineHeight: '1.1', letterSpacing: '-0.02em' }}>
            {t.hero.title}{' '}
            <span style={{ background: 'linear-gradient(135deg, #c4b5fd, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t.hero.titleHighlight}
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ margin: '0 auto 40px', fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', maxWidth: '680px' }}>
            {t.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="cs-landing-hero-btns" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px', flexWrap: 'wrap' }}>
            <button onClick={() => openAuth('register')} style={{ ...btnPrimary, padding: '16px 36px', fontSize: '17px', backgroundColor: 'white', background: 'white', color: '#4f46e5', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
              {t.hero.cta1} →
            </button>
            <a href="#pricing" style={{ ...btnSecondary, padding: '16px 36px', fontSize: '17px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              {t.hero.cta2}
            </a>
          </div>

          {/* Stats */}
          <div className="cs-landing-stats" style={{ display: 'flex', justifyContent: 'center', gap: '60px', flexWrap: 'wrap' }}>
            {[
              { val: t.hero.stat1, label: t.hero.stat1Label },
              { val: t.hero.stat2, label: t.hero.stat2Label },
              { val: t.hero.stat3, label: t.hero.stat3Label }
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '36px', fontWeight: '800', color: 'white' }}>{s.val}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== FEATURES SECTION ====== */}
      <section id="features" style={{ padding: '100px 24px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-block', padding: '6px 16px', backgroundColor: '#eef2ff', borderRadius: '50px', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4f46e5' }}>{t.features.badge}</span>
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em' }}>
              {t.features.title}
            </h2>
            <p style={{ margin: '0 auto', fontSize: '18px', color: '#6b7280', maxWidth: '600px', lineHeight: '1.6' }}>
              {t.features.subtitle}
            </p>
          </div>

          {/* Feature cards */}
          <div className="cs-landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {t.featureList.map((f, i) => (
              <div key={i} style={{
                padding: '32px', borderRadius: '20px', border: '1px solid #f3f4f6',
                backgroundColor: '#fafafa', transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              className="cs-dash-card"
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '20px' }}>
                  {f.icon}
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#6b7280', lineHeight: '1.6' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PRICING SECTION ====== */}
      <section id="pricing" style={{ padding: '100px 24px', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-block', padding: '6px 16px', backgroundColor: '#eef2ff', borderRadius: '50px', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4f46e5' }}>{t.pricing.badge}</span>
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em' }}>
              {t.pricing.title}
            </h2>
            <p style={{ margin: '0 auto 32px', fontSize: '18px', color: '#6b7280', maxWidth: '550px', lineHeight: '1.6' }}>
              {t.pricing.subtitle}
            </p>

            {/* Billing toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '4px', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <button onClick={() => setBillingPeriod('monthly')} style={{
                padding: '10px 24px', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: billingPeriod === 'monthly' ? '#4f46e5' : 'transparent',
                color: billingPeriod === 'monthly' ? 'white' : '#6b7280'
              }}>{t.pricing.monthly}</button>
              <button onClick={() => setBillingPeriod('annual')} style={{
                padding: '10px 24px', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: billingPeriod === 'annual' ? '#4f46e5' : 'transparent',
                color: billingPeriod === 'annual' ? 'white' : '#6b7280',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                {t.pricing.annual}
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '50px', backgroundColor: billingPeriod === 'annual' ? 'rgba(255,255,255,0.2)' : '#dcfce7', color: billingPeriod === 'annual' ? 'white' : '#16a34a' }}>{t.pricing.annualSave}</span>
              </button>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="cs-landing-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', alignItems: 'start' }}>
            {planData.map((plan) => {
              const price = billingPeriod === 'monthly' ? plan.monthlyUsd : plan.annualUsd;
              const priceXaf = billingPeriod === 'monthly' ? plan.monthlyXaf : plan.annualXaf;
              const period = billingPeriod === 'monthly' ? t.pricing.perMonth : t.pricing.perYear;

              return (
                <div key={plan.key} style={{
                  position: 'relative', padding: plan.popular ? '32px 24px' : '28px 24px',
                  borderRadius: '20px', backgroundColor: 'white',
                  border: plan.popular ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  boxShadow: plan.popular ? '0 8px 30px rgba(79, 70, 229, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transform: plan.popular ? 'scale(1.02)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {plan.popular && (
                    <div style={{
                      position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                      padding: '6px 20px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      borderRadius: '50px', fontSize: '12px', fontWeight: '700', color: 'white',
                      whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                    }}>{t.pricing.popular}</div>
                  )}

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>{plan.name}</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{plan.desc}</p>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '40px', fontWeight: '800', color: '#111827', letterSpacing: '-0.02em' }}>
                        {price === 0 ? (lang === 'fr' ? 'Gratuit' : 'Free') : `$${price}`}
                      </span>
                      {price > 0 && <span style={{ fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>{period}</span>}
                    </div>
                    {priceXaf > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#9ca3af' }}>
                        {priceXaf.toLocaleString()} XAF{period}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handlePlanSelect(plan.key)}
                    style={{
                      width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
                      fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '24px',
                      transition: 'all 0.2s',
                      background: plan.popular ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'white',
                      color: plan.popular ? 'white' : '#4f46e5',
                      border: plan.popular ? 'none' : '2px solid #e5e7eb',
                      boxShadow: plan.popular ? '0 4px 14px rgba(79, 70, 229, 0.3)' : 'none'
                    }}
                  >
                    {t.pricing.getStarted} →
                  </button>

                  <div>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.pricing.features}</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {plan.features.map((feature, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '6px 0', fontSize: '14px', color: '#374151' }}>
                          <span style={{ color: '#4f46e5', fontSize: '16px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== CTA SECTION ====== */}
      <section style={{
        padding: '80px 24px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
        <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '800', color: 'white', letterSpacing: '-0.02em' }}>
            {t.cta.title}
          </h2>
          <p style={{ margin: '0 0 36px', fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
            {t.cta.subtitle}
          </p>
          <button onClick={() => openAuth('register')} style={{ ...btnPrimary, padding: '16px 40px', fontSize: '17px', backgroundColor: 'white', background: 'white', color: '#4f46e5', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            {t.cta.btn} →
          </button>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer style={{ padding: '60px 24px 32px', backgroundColor: '#111827' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="cs-landing-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '40px' }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <img src="/churchsmart-logo.svg" alt="ChurchSmart" style={{ height: '28px', width: 'auto', filter: 'brightness(2)' }} />
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af', lineHeight: '1.6', maxWidth: '280px' }}>
                {t.footer.tagline}
              </p>
            </div>
            {/* Links */}
            {[
              { title: t.footer.product, links: [t.footer.features, t.footer.pricing, t.footer.security] },
              { title: t.footer.company, links: [t.footer.about, t.footer.contact, t.footer.blog] },
              { title: t.footer.support, links: [t.footer.docs, t.footer.help, t.footer.status] }
            ].map((col, i) => (
              <div key={i}>
                <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.title}</h4>
                {col.links.map((link, j) => (
                  <p key={j} style={{ margin: '0 0 10px' }}>
                    <a href="#" style={{ fontSize: '14px', color: '#9ca3af', textDecoration: 'none', transition: 'color 0.2s' }}>{link}</a>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: '24px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{t.footer.copy}</p>
          </div>
        </div>
      </footer>

      {/* ====== AUTH MODAL ====== */}
      {showAuthModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}
        onClick={(e) => { if (e.target === e.currentTarget) { setShowAuthModal(false); setError(''); setSuccess(''); } }}
        >
          <div className="cs-landing-auth-modal" style={{
            width: '100%', maxWidth: '440px', backgroundColor: 'white', borderRadius: '24px',
            padding: '36px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative'
          }}>
            {/* Close button */}
            <button onClick={() => { setShowAuthModal(false); setError(''); setSuccess(''); }}
              style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <img src="/churchsmart-logo.svg" alt="ChurchSmart" style={{ height: '32px', width: 'auto', margin: '0 auto 12px' }} />
              <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: '#111827' }}>
                {showResetForm ? t.auth.newPasswordTitle : showForgotPassword ? t.auth.forgotTitle : isLogin ? t.auth.welcome : t.auth.createAccount}
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                {showResetForm ? t.auth.newPasswordDesc : showForgotPassword ? t.auth.forgotDesc : isLogin ? t.auth.signInDesc : t.auth.getStarted}
              </p>
            </div>

            {/* Tab Toggle (only when not in forgot/reset mode) */}
            {!showForgotPassword && !showResetForm && (
              <div style={{ display: 'flex', marginBottom: '20px', backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '4px' }}>
                <button onClick={() => { setIsLogin(true); setError(''); setSuccess(''); setStep(1); }}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', backgroundColor: isLogin ? 'white' : 'transparent', color: isLogin ? '#4f46e5' : '#6b7280', fontWeight: isLogin ? '600' : '400', fontSize: '14px', cursor: 'pointer', boxShadow: isLogin ? '0 1px 4px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s' }}
                >{t.auth.signIn}</button>
                <button onClick={() => { setIsLogin(false); setError(''); setSuccess(''); setStep(1); }}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', backgroundColor: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#4f46e5' : '#6b7280', fontWeight: !isLogin ? '600' : '400', fontSize: '14px', cursor: 'pointer', boxShadow: !isLogin ? '0 1px 4px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s' }}
                >{t.auth.register}</button>
              </div>
            )}

            {/* Step indicator for registration */}
            {!isLogin && !showForgotPassword && !showResetForm && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</span>
                  <span style={{ fontSize: '13px', color: step === 1 ? '#4f46e5' : '#6b7280', fontWeight: step === 1 ? '600' : '400' }}>{t.auth.step1}</span>
                </div>
                <div style={{ flex: 1, height: '2px', backgroundColor: step >= 2 ? '#4f46e5' : '#e5e7eb' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step >= 2 ? '#4f46e5' : '#e5e7eb', color: step >= 2 ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>2</span>
                  <span style={{ fontSize: '13px', color: step === 2 ? '#4f46e5' : '#6b7280', fontWeight: step === 2 ? '600' : '400' }}>{t.auth.step2}</span>
                </div>
              </div>
            )}

            {/* Error / Success */}
            {error && <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '14px', color: '#dc2626', fontSize: '14px' }}>{error}</div>}
            {success && <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '14px', color: '#166534', fontSize: '14px' }}>{success}</div>}

            {/* RESET PASSWORD FORM */}
            {showResetForm ? (
              <div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>{t.auth.newPassword}</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>{t.auth.confirmNewPassword}</label>
                  <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <button
                  onClick={async () => {
                    setError(''); setSuccess('');
                    if (!newPassword || newPassword.length < 8) { setError(lang === 'fr' ? 'Le mot de passe doit contenir au moins 8 caractères' : 'Password must be at least 8 characters'); return; }
                    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { setError(lang === 'fr' ? 'Le mot de passe doit contenir une majuscule et un chiffre' : 'Password must include an uppercase letter and a number'); return; }
                    if (newPassword !== confirmNewPassword) { setError(lang === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match'); return; }
                    setLoading(true);
                    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
                    if (updateErr) { setError(updateErr.message); }
                    else {
                      setSuccess(t.auth.passwordUpdated);
                      setShowResetForm(false);
                      if (setPasswordRecovery) setPasswordRecovery(false);
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session?.user?.email) { window.location.href = '/'; }
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '...' : t.auth.updatePassword}
                </button>
              </div>
            ) : showForgotPassword ? (
              <div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>{t.auth.email}</label>
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@church.com" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                </div>
                <button
                  onClick={async () => {
                    setLoading(true); setError(''); setSuccess('');
                    const result = await forgotPassword(resetEmail);
                    if (result.success) { setSuccess(t.auth.resetSent); } else { setError(result.error); }
                    setLoading(false);
                  }}
                  disabled={loading}
                  style={{ ...btnPrimary, width: '100%', marginBottom: '12px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '...' : t.auth.sendResetLink}
                </button>
                <button onClick={() => { setShowForgotPassword(false); setError(''); setSuccess(''); }}
                  style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#6366f1', border: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                  ← {t.auth.backToLogin}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit}>
                  {/* LOGIN */}
                  {isLogin && (
                    <>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>{t.auth.email}</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>{t.auth.password}</label>
                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inputStyle}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
                          <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#6366f1' }} /> {t.auth.rememberMe}
                        </label>
                        <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPassword(true); setError(''); setSuccess(''); setResetEmail(form.email); }}
                          style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>{t.auth.forgotPassword}</a>
                      </div>
                    </>
                  )}

                  {/* REGISTER STEP 1 */}
                  {!isLogin && step === 1 && (
                    <>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>{t.auth.fullName} *</label>
                        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Pastor John Doe" style={inputStyle}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>{t.auth.email} *</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@church.com" style={inputStyle}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>{t.auth.phone}</label>
                        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+237 6XX XXX XXX" style={inputStyle}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        <div>
                          <label style={labelStyle}>{t.auth.password} *</label>
                          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                        <div>
                          <label style={labelStyle}>{t.auth.confirmPassword} *</label>
                          <input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="••••••" style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#e5e7eb'} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* REGISTER STEP 2 - OTP */}
                  {!isLogin && step === 2 && (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>📧</div>
                        <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>{t.auth.otpTitle}</h3>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{t.auth.otpDesc} <strong>{otpEmail}</strong></p>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <input
                          type="text" value={otpCode} maxLength={8}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder={t.auth.otpPlaceholder}
                          style={{ width: '100%', padding: '14px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '24px', textAlign: 'center', letterSpacing: '10px', fontWeight: '700', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f9fafb' }}
                          onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          autoFocus
                        />
                      </div>
                      <p style={{ textAlign: 'center', margin: '0 0 12px' }}>
                        <button type="button" onClick={handleResendOTP} disabled={loading}
                          style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }}>
                          {t.auth.resendCode}
                        </button>
                      </p>
                    </>
                  )}

                  {/* Submit buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {!isLogin && step === 2 && (
                      <button type="button" onClick={() => setStep(step - 1)}
                        style={{ flex: 1, padding: '14px', backgroundColor: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                        ←
                      </button>
                    )}
                    <button type="submit" disabled={loading}
                      style={{ ...btnPrimary, flex: 1, width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                      {loading ? '...' : isLogin ? t.auth.signInBtn : step === 1 ? t.auth.createBtn : t.auth.verifyCode}
                    </button>
                  </div>
                </form>

                {/* Google Sign-In */}
                {isLogin && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                      <span style={{ fontSize: '13px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{t.auth.orContinueWith}</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                    </div>
                    <button onClick={handleGoogleSignIn} disabled={loading}
                      style={{
                        width: '100%', padding: '12px', backgroundColor: '#f9fafb', border: '2px solid #e5e7eb',
                        borderRadius: '12px', fontSize: '15px', fontWeight: '500', color: '#374151',
                        cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '10px', transition: 'all 0.2s', opacity: loading ? 0.7 : 1
                      }}>
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t.auth.googleSignIn}
                    </button>
                  </div>
                )}
              </>
            )}

            <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>🔒 {t.auth.secure}</p>
          </div>
        </div>
      )}

    </div>
  );
}
