import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ACCENT_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#f97316'];
const FONTS = ['Inter','Roboto','Poppins','Space Grotesk','DM Sans'];

export default function SettingsPage() {
  const { userData, user, logout, refreshUser } = useAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState(localStorage.getItem('thenox-fontsize') || '14');
  const [font, setFont] = useState(localStorage.getItem('thenox-font') || 'Inter');

  const applyFont = (f) => {
    setFont(f);
    localStorage.setItem('thenox-font', f);
    document.body.style.fontFamily = `${f}, sans-serif`;
  };

  const applyFontSize = (s) => {
    setFontSize(s);
    localStorage.setItem('thenox-fontsize', s);
    document.documentElement.style.fontSize = s + 'px';
  };

  const Section = ({ title, children }) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, sub, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: 0 }}>⚙️ Settings</h2>
      </div>

      <div style={{ padding: '16px 14px', maxWidth: 600, margin: '0 auto' }}>
        <Section title="Profile">
          <Row label={userData?.name || 'User'} sub={userData?.email || user?.email}
            right={<div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{userData?.name?.[0]?.toUpperCase() || 'U'}</div>} />
          <Row label="Plan" sub="Your current subscription"
            right={<button onClick={() => navigate('/billing')} style={{ padding: '6px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>{userData?.plan || 'free'}</button>} />
        </Section>

        <Section title="Appearance">
          <Row label="Theme" sub="Switch between dark and light"
            right={
              <div style={{ display: 'flex', gap: 6 }}>
                {['dark','light'].map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${theme===t ? 'var(--accent)' : 'var(--border)'}`, background: theme===t ? 'rgba(139,92,246,0.15)' : 'transparent', color: theme===t ? 'var(--accent2)' : 'var(--text3)', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>{t==='dark'?'🌙 ':' ☀️'}{t}</button>
                ))}
              </div>
            } />
          <Row label="Accent Color" sub="Choose your theme color"
            right={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {ACCENT_COLORS.map(c => (
                  <button key={c} onClick={() => setAccent(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: `2px solid ${accent===c ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'transform 0.15s', transform: accent===c ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
            } />
          <Row label="Font" sub="Interface font family"
            right={
              <select value={font} onChange={e => applyFont(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 8, fontSize: 12, outline: 'none' }}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            } />
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 8 }}>Font Size</div>
            <input type="range" min="12" max="18" value={fontSize} onChange={e => applyFontSize(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}><span>Small</span><span>{fontSize}px</span><span>Large</span></div>
          </div>
        </Section>

        <Section title="Workers & Connectors">
          <Row label="Manage Workers" sub={`${userData?.workers?.length || 0} active workers`}
            right={<button onClick={() => navigate('/workers')} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Manage</button>} />
          <Row label="Manage Connectors" sub={`${userData?.connectors?.length || 0} connected`}
            right={<button onClick={() => navigate('/connectors')} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12 }}>Manage</button>} />
        </Section>

        <Section title="Account">
          <Row label="Sign Out" sub="Sign out from all devices"
            right={<button onClick={logout} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Sign Out</button>} />
          <Row label="Delete Account" sub="Permanently delete your account"
            right={<button onClick={() => toast.error('Contact support@thenox.ai to delete account')} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Delete</button>} />
        </Section>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Thenox AI v1.0.0 · support@thenox.ai · © Thenox Technologies</p>
      </div>
    </div>
  );
}
