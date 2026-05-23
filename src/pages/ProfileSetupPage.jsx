import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CURRENT_YEAR = new Date().getFullYear();

export default function ProfileSetupPage() {
  const { completeProfile, user } = useAuth();
  const [form, setForm] = useState({ name: user?.displayName || '', dob: '', agreed: false });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validateDob = (dob) => {
    if (!dob) return 'Date of birth is required';
    const d = new Date(dob);
    const year = d.getFullYear();
    const age = CURRENT_YEAR - year;
    if (year < 1920) return 'Please enter a valid year (after 1920)';
    if (year > CURRENT_YEAR - 5) return 'You must be at least 5 years old';
    if (age > 120) return 'Please enter a valid date of birth';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    const dobErr = validateDob(form.dob);
    if (dobErr) errs.dob = dobErr;
    if (!form.agreed) errs.agreed = 'Please accept terms & conditions';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    await completeProfile({ name: form.name.trim(), dob: form.dob });
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
          <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Complete your profile</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Just a few more details to get started</p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name"
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: `1px solid ${errors.name ? '#ef4444' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              {errors.name && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{errors.name}</p>}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Birth</label>
              <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                min="1920-01-01" max={`${CURRENT_YEAR - 5}-12-31`}
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: `1px solid ${errors.dob ? '#ef4444' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              {errors.dob && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{errors.dob}</p>}
            </div>

            {/* Terms */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20, maxHeight: 160, overflowY: 'auto', fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Terms & Conditions</strong>
              <p>• Thenox AI provides AI assistant services. By using this platform, you agree to use it only for legal purposes.</p>
              <p>• <strong>No illegal content</strong> — gambling, adult content, phishing, malware, hate speech is strictly prohibited.</p>
              <p>• <strong>API Keys</strong> — If you provide any API key, you do so at your own risk. Thenox AI stores them encrypted but takes no responsibility for their use.</p>
              <p>• <strong>No liability</strong> — Thenox AI is not responsible if the app is hacked or data is compromised.</p>
              <p>• <strong>AI Mistakes</strong> — AI can make mistakes. Always double-check important responses.</p>
              <p>• <strong>Billing</strong> — Plans are monthly/yearly. No auto-renewal. Refunds subject to policy.</p>
              <p>• <strong>Data</strong> — We do not sell your data. Governed by Indian IT Act 2000.</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={form.agreed} onChange={e => set('agreed', e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--accent)', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>I have read and agree to the <span style={{ color: 'var(--accent2)' }}>Terms & Conditions</span></span>
            </label>
            {errors.agreed && <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 12 }}>{errors.agreed}</p>}

            <button type="submit" disabled={busy} style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
              {busy ? '⏳ Saving...' : 'Get Started with Thenox AI ✨'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
