'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const SUPPORT_WHATSAPP = '+237674991704';

const TXT = {
  en: {
    loading: 'Loading invitation…',
    welcomeTitle: "You've been invited!",
    invalidTitle: 'Invitation unavailable',
    successTitle: 'Welcome!',
    inviteSummary: (church, role) => `You've been invited to join ${church} as ${role}.`,
    accountTypeBadge: (baseRole) => `Account type: ${baseRole}`,
    emailLabel: 'Email',
    emailHelper: 'This is the email your church admin invited.',
    fullNameLabel: 'Full Name *',
    fullNamePlaceholder: 'Your first and last name',
    passwordLabel: 'Password *',
    passwordPlaceholder: 'At least 8 characters',
    confirmLabel: 'Confirm Password *',
    confirmPlaceholder: 'Re-enter password',
    passwordHint: 'Must be at least 8 characters with one uppercase letter and one number.',
    submitButton: 'Accept Invitation',
    submitting: 'Setting up your account…',
    invalidNotFound: "We couldn't find your invitation. The link may be incorrect or the invitation was deleted.",
    invalidExpired: 'This invitation has expired. Please ask your church admin to send a new one.',
    invalidAlreadyUsed: 'This invitation has already been accepted. If this is your account, please sign in.',
    invalidRevoked: 'This invitation has been revoked by your church admin.',
    invalidGeneric: 'This invitation is no longer valid. Please contact your church admin.',
    contactSupport: 'Need help? Contact us on WhatsApp',
    backHome: '← Return to home',
    goToSignIn: 'Sign in instead',
    errorPasswordsMismatch: 'Passwords do not match.',
    errorPasswordWeak: 'Password must be at least 8 characters with one uppercase letter and one number.',
    errorFullNameRequired: 'Please enter your full name.',
    errorAcceptFailed: 'We could not accept the invitation. Please try again.',
    errorAuthExists: 'An account already exists for this email. Please sign in normally.',
    errorAuthCreate: 'We could not create your account. Please try again or contact support.',
    errorNetwork: 'Network error. Please check your connection and try again.',
    successToast: (church) => `Welcome to ${church}!`
  },
  fr: {
    loading: "Chargement de l'invitation…",
    welcomeTitle: 'Vous êtes invité(e) !',
    invalidTitle: 'Invitation indisponible',
    successTitle: 'Bienvenue !',
    inviteSummary: (church, role) => `Vous êtes invité(e) à rejoindre ${church} en tant que ${role}.`,
    accountTypeBadge: (baseRole) => `Type de compte : ${baseRole}`,
    emailLabel: 'Email',
    emailHelper: "C'est l'email auquel votre administrateur d'église vous a invité(e).",
    fullNameLabel: 'Nom complet *',
    fullNamePlaceholder: 'Votre prénom et nom',
    passwordLabel: 'Mot de passe *',
    passwordPlaceholder: 'Au moins 8 caractères',
    confirmLabel: 'Confirmer le mot de passe *',
    confirmPlaceholder: 'Saisir à nouveau le mot de passe',
    passwordHint: 'Doit contenir au moins 8 caractères avec une majuscule et un chiffre.',
    submitButton: "Accepter l'invitation",
    submitting: 'Configuration de votre compte…',
    invalidNotFound: "Nous n'avons pas trouvé votre invitation. Le lien est peut-être incorrect ou l'invitation a été supprimée.",
    invalidExpired: "Cette invitation a expiré. Veuillez demander à votre administrateur d'en envoyer une nouvelle.",
    invalidAlreadyUsed: "Cette invitation a déjà été acceptée. Si c'est votre compte, veuillez vous connecter.",
    invalidRevoked: "Cette invitation a été révoquée par votre administrateur d'église.",
    invalidGeneric: "Cette invitation n'est plus valide. Veuillez contacter votre administrateur.",
    contactSupport: "Besoin d'aide ? Contactez-nous sur WhatsApp",
    backHome: "← Retour à l'accueil",
    goToSignIn: 'Se connecter',
    errorPasswordsMismatch: 'Les mots de passe ne correspondent pas.',
    errorPasswordWeak: 'Le mot de passe doit contenir au moins 8 caractères avec une majuscule et un chiffre.',
    errorFullNameRequired: 'Veuillez saisir votre nom complet.',
    errorAcceptFailed: "Nous n'avons pas pu accepter l'invitation. Veuillez réessayer.",
    errorAuthExists: 'Un compte existe déjà pour cet email. Veuillez vous connecter normalement.',
    errorAuthCreate: "Nous n'avons pas pu créer votre compte. Veuillez réessayer ou contacter le support.",
    errorNetwork: 'Erreur réseau. Veuillez vérifier votre connexion et réessayer.',
    successToast: (church) => `Bienvenue à ${church} !`
  }
};

const LANG_STORAGE_KEY = 'churchsmart_accept_invite_lang';

function readStoredLang() {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return (v === 'en' || v === 'fr') ? v : null;
  } catch { return null; }
}

function writeStoredLang(lang) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
}

function isStrongPassword(pwd) {
  return typeof pwd === 'string' && pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd);
}

export default function AcceptInvitePage() {
  const [lang, setLangState] = useState('en');
  const [phase, setPhase] = useState('loading'); // 'loading' | 'invalid' | 'valid' | 'submitting' | 'success'
  const [token, setToken] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [invalidReason, setInvalidReason] = useState(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const userOverrideRef = useRef(false);
  const t = TXT[lang];

  // setLang wraps setLangState to mark user override + persist to localStorage.
  const setLang = (newLang) => {
    setLangState(newLang);
    userOverrideRef.current = true;
    writeStoredLang(newLang);
  };

  // Read token + adopt previously stored language (if any).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredLang();
    if (stored) {
      setLangState(stored);
      userOverrideRef.current = true;
    }
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    setToken(tok);
    if (!tok) {
      setPhase('invalid');
      setInvalidReason('not_found');
    }
  }, []);

  // Validate the invitation
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/team/validate-invitation?token=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.valid) {
          setPhase('invalid');
          setInvalidReason(data.reason || 'not_found');
          return;
        }
        // Adopt church.default_language only if user hasn't manually overridden.
        // Spec: church default is the primary source; localStorage override wins; fallback EN.
        if (!userOverrideRef.current && data.church_default_language === 'fr') {
          setLangState('fr');
        }
        setInvitation({
          church_name: data.church_name,
          email: data.email,
          base_role: data.base_role,
          role_name: data.role_name,
          expires_at: data.expires_at
        });
        setFullName(data.user_name || '');
        setPhase('valid');
      } catch (err) {
        if (cancelled) return;
        setPhase('invalid');
        setInvalidReason('not_found');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const onSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!fullName.trim()) { setError(t.errorFullNameRequired); return; }
    if (!isStrongPassword(password)) { setError(t.errorPasswordWeak); return; }
    if (password !== confirm) { setError(t.errorPasswordsMismatch); return; }

    setPhase('submitting');
    try {
      const response = await fetch('/api/team/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, full_name: fullName.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        const code = data?.code;
        if (code === 'WEAK_PASSWORD') {
          setError(t.errorPasswordWeak);
        } else if (code === 'AUTH_USER_EXISTS') {
          setError(t.errorAuthExists);
        } else if (code === 'AUTH_USER_CREATION_FAILED') {
          setError(t.errorAuthCreate);
        } else if (code === 'INVALID_OR_EXPIRED') {
          setPhase('invalid');
          setInvalidReason('expired');
          return;
        } else {
          setError(data.error || t.errorAcceptFailed);
        }
        setPhase('valid');
        return;
      }

      // Auto sign-in so the user lands on / with an active session.
      // If this fails (or supabase client is null), fall back to redirect — they'll see LoginPage.
      if (supabase && invitation?.email) {
        try {
          await supabase.auth.signInWithPassword({
            email: invitation.email.toLowerCase(),
            password
          });
        } catch (signInErr) {
          console.error('[accept-invite] auto-signin failed:', signInErr);
        }
      }

      setPhase('success');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = data.redirect_url || '/';
        }
      }, 1200);
    } catch (err) {
      setError(t.errorNetwork);
      setPhase('valid');
    }
  };

  const passwordOk = isStrongPassword(password);
  const confirmOk = password === confirm && confirm.length > 0;
  const formValid = fullName.trim().length > 0 && passwordOk && confirmOk;
  const submitting = phase === 'submitting';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* Language toggle (≥44px touch target per HIG) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 12 }}>
          <button onClick={() => setLang('en')} style={{ padding: '0 16px', minHeight: 44, border: 'none', borderRadius: 8, backgroundColor: lang === 'en' ? '#eef2ff' : 'transparent', color: lang === 'en' ? '#4f46e5' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>EN</button>
          <button onClick={() => setLang('fr')} style={{ padding: '0 16px', minHeight: 44, border: 'none', borderRadius: 8, backgroundColor: lang === 'fr' ? '#eef2ff' : 'transparent', color: lang === 'fr' ? '#4f46e5' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>FR</button>
        </div>

        {/* Card (mobile-first padding; works at 320–1920px without media queries) */}
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cs-spin 0.7s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500, margin: 0 }}>{t.loading}</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>{t.invalidTitle}</h2>
              <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: 15, lineHeight: 1.6 }}>
                {invalidReason === 'expired' ? t.invalidExpired :
                  invalidReason === 'already_used' ? t.invalidAlreadyUsed :
                    invalidReason === 'revoked' ? t.invalidRevoked :
                      invalidReason === 'not_found' ? t.invalidNotFound :
                        t.invalidGeneric}
              </p>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: '0 24px', background: '#25D366', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 12 }}
              >
                💬 {t.contactSupport}
              </a>
              <div style={{ marginTop: 8 }}>
                {invalidReason === 'already_used' ? (
                  <a href="/" style={{ color: '#6366f1', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{t.goToSignIn}</a>
                ) : (
                  <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}>{t.backHome}</a>
                )}
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 700, color: '#1f2937' }}>{t.successTitle}</h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 15 }}>{t.successToast(invitation?.church_name || '')}</p>
            </div>
          )}

          {(phase === 'valid' || submitting) && invitation && (
            <form onSubmit={onSubmit}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⛪</div>
                <h1 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 700, color: '#1f2937' }}>{t.welcomeTitle}</h1>
                <p style={{ margin: 0, color: '#6b7280', fontSize: 15, lineHeight: 1.6 }}>
                  {t.inviteSummary(invitation.church_name, invitation.role_name || invitation.base_role)}
                </p>
                <span style={{ display: 'inline-block', marginTop: 12, padding: '4px 12px', backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                  {t.accountTypeBadge(invitation.base_role)}
                </span>
              </div>

              {error && (
                <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.emailLabel}</label>
                <input type="email" value={invitation.email} readOnly style={{ width: '100%', padding: '14px', minHeight: 48, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', backgroundColor: '#f9fafb', color: '#6b7280', boxSizing: 'border-box' }} />
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#9ca3af' }}>{t.emailHelper}</p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.fullNameLabel}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  autoFocus
                  style={{ width: '100%', padding: '14px', minHeight: 48, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.passwordLabel}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    style={{ width: '100%', padding: '14px', paddingRight: 56, minHeight: 48, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#6366f1', fontSize: 18, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: passwordOk ? '#10b981' : '#9ca3af' }}>
                  {passwordOk ? '✓ ' : ''}{t.passwordHint}
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.confirmLabel}</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t.confirmPlaceholder}
                  style={{
                    width: '100%', padding: '14px', minHeight: 48, borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box',
                    border: confirm.length > 0 ? `1px solid ${confirmOk ? '#10b981' : '#fca5a5'}` : '1px solid #e5e7eb'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !formValid}
                style={{
                  width: '100%', padding: 16, minHeight: 52,
                  background: (submitting || !formValid) ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600,
                  cursor: (submitting || !formValid) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                }}
              >
                {submitting ? `⏳ ${t.submitting}` : t.submitButton}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            Powered by <span style={{ fontWeight: 600, color: '#6366f1' }}>ChurchSmart</span>
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes cs-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
    </div>
  );
}
