'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const APP_URL = 'https://app.churchsmartnow.com';
const SUPPORT_WHATSAPP = '+237674991704';

const TXT = {
  en: {
    loading: 'Loading…',
    joinTitle: 'Join',
    subtitle: (church) => `You've been invited to join ${church}`,
    roleLabel: (role) => `You'll join as: ${role}`,
    emailLabel: 'Email *',
    emailPlaceholder: 'your@email.com',
    nameLabel: 'Full Name *',
    namePlaceholder: 'Your first and last name',
    passwordLabel: 'Password *',
    passwordPlaceholder: 'At least 8 characters',
    confirmLabel: 'Confirm Password *',
    confirmPlaceholder: 'Re-enter password',
    passwordHint: 'Must be at least 8 characters with one uppercase letter and one number.',
    submitButton: 'Create Account & Join',
    submitting: 'Setting up your account…',
    successTitle: 'Welcome!',
    successMsg: (church) => `You've joined ${church}! Redirecting to the app…`,
    expiredTitle: 'Link Expired',
    expiredMsg: 'This invite link has expired. Please ask your church admin for a new one.',
    invalidTitle: 'Invalid Link',
    invalidMsg: 'This invite link is not valid. Please check with your church admin.',
    alreadyMember: 'You already have an account with this church. Please sign in.',
    signIn: 'Sign in instead',
    contactSupport: 'Need help? Contact us on WhatsApp',
    errorMismatch: 'Passwords do not match.',
    errorWeak: 'Password must be at least 8 characters with one uppercase and one number.',
    errorName: 'Please enter your full name.',
    errorEmail: 'Please enter a valid email.',
    errorFailed: 'Could not create your account. Please try again.',
    errorAuthExists: 'An account with this email already exists. Please sign in.',
    errorDuplicate: 'This email already belongs to another church.',
    langSwitch: 'FR 🇫🇷',
  },
  fr: {
    loading: 'Chargement…',
    joinTitle: 'Rejoindre',
    subtitle: (church) => `Vous êtes invité(e) à rejoindre ${church}`,
    roleLabel: (role) => `Vous rejoindrez en tant que : ${role}`,
    emailLabel: 'Email *',
    emailPlaceholder: 'votre@email.com',
    nameLabel: 'Nom complet *',
    namePlaceholder: 'Votre prénom et nom',
    passwordLabel: 'Mot de passe *',
    passwordPlaceholder: 'Au moins 8 caractères',
    confirmLabel: 'Confirmer le mot de passe *',
    confirmPlaceholder: 'Saisir à nouveau le mot de passe',
    passwordHint: 'Au moins 8 caractères avec une majuscule et un chiffre.',
    submitButton: 'Créer un compte et rejoindre',
    submitting: 'Configuration de votre compte…',
    successTitle: 'Bienvenue !',
    successMsg: (church) => `Vous avez rejoint ${church} ! Redirection…`,
    expiredTitle: 'Lien expiré',
    expiredMsg: "Ce lien d'invitation a expiré. Veuillez demander un nouveau lien à votre administrateur.",
    invalidTitle: 'Lien invalide',
    invalidMsg: "Ce lien n'est pas valide. Veuillez vérifier auprès de votre administrateur.",
    alreadyMember: 'Vous avez déjà un compte. Veuillez vous connecter.',
    signIn: 'Se connecter',
    contactSupport: "Besoin d'aide ? Contactez-nous sur WhatsApp",
    errorMismatch: 'Les mots de passe ne correspondent pas.',
    errorWeak: 'Le mot de passe doit contenir au moins 8 caractères avec une majuscule et un chiffre.',
    errorName: 'Veuillez saisir votre nom complet.',
    errorEmail: 'Veuillez saisir un email valide.',
    errorFailed: "Impossible de créer votre compte. Veuillez réessayer.",
    errorAuthExists: 'Un compte existe déjà pour cet email. Veuillez vous connecter.',
    errorDuplicate: 'Cet email appartient déjà à une autre église.',
    langSwitch: 'EN 🇬🇧',
  }
};

const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function JoinPage({ params }) {
  const { code } = use(params);
  const [lang, setLang] = useState('en');
  const [status, setStatus] = useState('loading'); // loading | form | expired | invalid | success
  const [linkInfo, setLinkInfo] = useState(null);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = TXT[lang];

  useEffect(() => {
    validateLink();
  }, [code]);

  const validateLink = async () => {
    if (!supabase || !code) { setStatus('invalid'); return; }
    try {
      const { data, error: err } = await supabase
        .from('church_invite_links')
        .select('id, church_id, base_role, role_id, expires_at, is_active, churches(name, default_language)')
        .eq('link_code', code)
        .maybeSingle();

      if (err || !data) { setStatus('invalid'); return; }
      if (!data.is_active) { setStatus('invalid'); return; }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

      setLinkInfo(data);
      if (data.churches?.default_language === 'FRENCH') setLang('fr');
      setStatus('form');
    } catch {
      setStatus('invalid');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { email, full_name, password, confirm } = form;

    if (!full_name.trim()) { setError(t.errorName); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t.errorEmail); return; }
    if (!passwordRegex.test(password)) { setError(t.errorWeak); return; }
    if (password !== confirm) { setError(t.errorMismatch); return; }

    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Check if already a member of any church
      const { data: existing } = await supabase
        .from('church_users')
        .select('church_id')
        .ilike('email', normalizedEmail)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (existing.church_id === linkInfo.church_id) {
          setError(t.alreadyMember);
        } else {
          setError(t.errorDuplicate);
        }
        setSubmitting(false);
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: full_name.trim() } }
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          setError(t.errorAuthExists);
        } else {
          setError(t.errorFailed);
        }
        setSubmitting(false);
        return;
      }

      const authId = authData?.user?.id;

      // Create church_users entry
      const { error: cuError } = await supabase
        .from('church_users')
        .insert({
          church_id: linkInfo.church_id,
          email: normalizedEmail,
          full_name: full_name.trim(),
          role: linkInfo.base_role || 'VOLUNTEER',
          is_active: true,
          auth_id: authId || null
        });

      if (cuError) {
        console.error('church_users insert error:', cuError);
        setError(t.errorFailed);
        setSubmitting(false);
        return;
      }

      // If role_id, create assignment
      if (linkInfo.role_id) {
        await supabase
          .from('user_role_assignments')
          .insert({
            church_id: linkInfo.church_id,
            user_email: normalizedEmail,
            user_name: full_name.trim(),
            role_id: linkInfo.role_id,
            status: 'active',
            pending_base_role: linkInfo.base_role || 'VOLUNTEER',
            accepted_at: new Date().toISOString()
          });
      }

      // Increment uses_count
      await supabase.rpc('increment_invite_link_uses', { link_id: linkInfo.id }).catch(() => {
        // Fallback: direct update
        supabase
          .from('church_invite_links')
          .update({ uses_count: (linkInfo.uses_count || 0) + 1 })
          .eq('id', linkInfo.id)
          .then(() => {});
      });

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          church_id: linkInfo.church_id,
          user_email: normalizedEmail,
          action: 'member_joined_via_link',
          entity_type: 'church_user',
          entity_name: full_name.trim(),
          details: JSON.stringify({ base_role: linkInfo.base_role, link_code: code })
        }).catch(() => {});

      setStatus('success');

      // Auto sign in and redirect
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      setTimeout(() => {
        window.location.href = signInError ? APP_URL : APP_URL;
      }, 2000);
    } catch (err) {
      console.error('Join error:', err);
      setError(t.errorFailed);
      setSubmitting(false);
    }
  };

  // Shared styles
  const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '40px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
  const inputStyle = { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' };
  const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#374151' };
  const btnStyle = { width: '100%', padding: '14px', border: 'none', borderRadius: '12px', backgroundColor: '#6366f1', color: 'white', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' };

  // Loading
  if (status === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  // Expired
  if (status === 'expired') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#1f2937' }}>{t.expiredTitle}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>{t.expiredMsg}</p>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`} style={{ display: 'inline-block', marginTop: '20px', color: '#25D366', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
            💬 {t.contactSupport}
          </a>
        </div>
      </div>
    );
  }

  // Invalid
  if (status === 'invalid') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#1f2937' }}>{t.invalidTitle}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>{t.invalidMsg}</p>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`} style={{ display: 'inline-block', marginTop: '20px', color: '#25D366', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
            💬 {t.contactSupport}
          </a>
        </div>
      </div>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#1f2937' }}>{t.successTitle}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            {t.successMsg(linkInfo?.churches?.name || 'your church')}
          </p>
        </div>
      </div>
    );
  }

  // Registration Form
  const churchName = linkInfo?.churches?.name || 'Church';

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Language toggle */}
        <div style={{ textAlign: 'right', marginBottom: '8px' }}>
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} style={{ padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
            {t.langSwitch}
          </button>
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '56px', height: '56px', margin: '0 auto 12px', borderRadius: '14px', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
              <path d="M36 20.5C33.8 18.9 31 18 28 18C21.9 18 17 22.9 17 29C17 35.1 21.9 40 28 40C31 40 33.8 39.1 36 37.5" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M39 24C41.8 24 44 26.2 44 29C44 31.8 41.8 34 39 34H33.5C31 34 29 32 29 29C29 26 31 24 33.5 24H39Z" fill="#F59E0B"/>
            </svg>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: '#1f2937' }}>
            {t.joinTitle} {churchName}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            {t.subtitle(churchName)}
          </p>
          <span style={{ display: 'inline-block', marginTop: '10px', padding: '4px 14px', backgroundColor: '#eef2ff', color: '#6366f1', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
            {t.roleLabel(linkInfo?.base_role || 'VOLUNTEER')}
          </span>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.nameLabel}</label>
            <input style={inputStyle} type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder={t.namePlaceholder} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.emailLabel}</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t.emailPlaceholder} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.passwordLabel}</label>
            <input style={inputStyle} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={t.passwordPlaceholder} />
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>{t.passwordHint}</p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{t.confirmLabel}</label>
            <input style={inputStyle} type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder={t.confirmPlaceholder} />
          </div>

          <button type="submit" disabled={submitting} style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? '⏳ ' + t.submitting : '🚀 ' + t.submitButton}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a href={APP_URL} style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
            {t.signIn}
          </a>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`} style={{ color: '#25D366', fontSize: '12px', textDecoration: 'none' }}>
            💬 {t.contactSupport}
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
            ChurchSmart · A product by DigiSmart Africa
          </p>
        </div>
      </div>
    </div>
  );
}
