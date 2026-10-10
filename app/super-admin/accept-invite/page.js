"use client";

// Landing page for a sub-admin invitation link.
//
// The invitee may not have an account yet, so this page handles sign-in and
// sign-up before posting the token. Access is only granted by the API, which
// re-verifies the token's signature and that the session's email matches the
// invited address.
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const card = {
  width: '100%', maxWidth: '420px', backgroundColor: 'white', borderRadius: '16px',
  padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', boxSizing: 'border-box'
};
const input = {
  width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px',
  fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px', marginBottom: '12px'
};
const primaryBtn = (disabled) => ({
  width: '100%', padding: '14px', border: 'none', borderRadius: '10px',
  backgroundColor: disabled ? '#e5e7eb' : '#6366f1', color: disabled ? '#9ca3af' : 'white',
  fontSize: '15px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer'
});

export default function AcceptInvitePage() {
  const [token, setToken] = useState('');
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [accepted, setAccepted] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const result = supabase ? await supabase.auth.getSession() : null;
      if (cancelled) return;
      setToken(params.get('token') || '');
      setSession(result?.data?.session || null);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const accept = useCallback(async (accessToken) => {
    setBusy(true);
    setStatus({ type: null, message: '' });
    try {
      const response = await fetch('/api/super-admin/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ token })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        setAccepted(data);
      } else {
        setStatus({ type: 'error', message: data.error || `Failed to accept (${response.status})` });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    setBusy(false);
  }, [token]);

  // Once signed in with a token present, accept without another click.
  useEffect(() => {
    if (!session?.access_token || !token || accepted || busy) return;
    const id = setTimeout(() => accept(session.access_token), 0);
    return () => clearTimeout(id);
  }, [session, token, accepted, busy, accept]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setStatus({ type: null, message: '' });
    try {
      const fn = mode === 'signup' ? 'signUp' : 'signInWithPassword';
      const { data, error } = await supabase.auth[fn]({ email: form.email.trim(), password: form.password });
      if (error) {
        setStatus({ type: 'error', message: error.message });
      } else if (data?.session) {
        setSession(data.session);
      } else {
        setStatus({ type: 'info', message: 'Check your inbox to confirm your email, then reopen this link.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    setBusy(false);
  };

  const wrap = (children) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: '20px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>
      <div style={card}>{children}</div>
    </div>
  );

  if (checking) return wrap(<p style={{ margin: 0, textAlign: 'center', color: '#6b7280' }}>Loading…</p>);

  if (!token) {
    return wrap(
      <>
        <p style={{ fontSize: '40px', margin: '0 0 12px', textAlign: 'center' }}>🔗</p>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', textAlign: 'center', color: '#111827' }}>Invitation link incomplete</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          Open the link from your invitation email, including the token at the end.
        </p>
      </>
    );
  }

  if (accepted) {
    return wrap(
      <>
        <p style={{ fontSize: '40px', margin: '0 0 12px', textAlign: 'center' }}>✅</p>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', textAlign: 'center', color: '#111827' }}>
          {accepted.alreadyAccepted ? 'Already on the team' : 'Welcome to the admin team'}
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          Your role is <strong style={{ color: '#4f46e5' }}>{accepted.roleLabel}</strong>.
        </p>
        <Link href="/" style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: '10px', backgroundColor: '#6366f1', color: 'white', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
          Open ChurchSmart
        </Link>
      </>
    );
  }

  return wrap(
    <>
      <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>Accept your admin invitation</h1>
      <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#6b7280' }}>
        {session ? 'Linking your account…' : 'Sign in with the address your invitation was sent to.'}
      </p>

      {status.message && (
        <div style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', backgroundColor: status.type === 'error' ? '#fef2f2' : '#eff6ff', color: status.type === 'error' ? '#991b1b' : '#1e40af' }}>
          {status.message}
        </div>
      )}

      {!session && (
        <form onSubmit={handleAuth}>
          <input style={input} type="email" required placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={input} type="password" required placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <button type="submit" disabled={busy} style={primaryBtn(busy)}>
            {busy ? '…' : (mode === 'signup' ? 'Create account & accept' : 'Sign in & accept')}
          </button>
          <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={{ width: '100%', marginTop: '12px', border: 'none', background: 'none', color: '#6366f1', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {mode === 'signup' ? 'I already have an account' : 'I need to create an account'}
          </button>
        </form>
      )}
    </>
  );
}
