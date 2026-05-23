import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { loginGoogle, loginEmail, registerEmail } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'register') await registerEmail(form.email, form.password, form.name);
    else await loginEmail(form.email, form.password);
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.08) 0%, var(--bg) 60%)' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(124,58,237,0.3)' }}>
            <img src="/logo.png" alt="Thenox AI" style={{ width: 40, height: 40, objectFit: 'contain' }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            <span style={{ display: 'none', color: '#fff', fontSize: 28, fontWeight: 900 }}>N</span>
          </div>
          <h1 style={{ color: 'var(--text)', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Thenox AI</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Your intelligent AI assistant</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          {/* Google */}
          <button onClick={loginGoogle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 20, transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>or with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <input type="text" placeholder="Full Name" required value={form.name} onChange={e => set('name', e.target.value)}
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 10 }} />
            )}
            <input type="email" placeholder="Email" required value={form.email} onChange={e => set('email', e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 10 }} />
            <input type="password" placeholder="Password" required value={form.password} onChange={e => set('password', e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 16 }} />
            <button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? '⏳ Please wait...' : mode === 'register' ? 'Create Account →' : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
            {mode === 'register' ? 'Already have an account? ' : "Don't have account? "}
            <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')} style={{ color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {mode === 'register' ? 'Sign In' : 'Sign Up Free'}
            </button>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text3)' }}>🔒 Secured with 256-bit encryption</p>
      </div>
    </div>
  );
}
