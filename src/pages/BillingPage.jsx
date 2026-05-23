import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PLANS = [
  {
    id: 'free', name: 'Free', price: 0, yearPrice: 0,
    color: 'var(--border)', highlight: false,
    features: ['100 messages/day','Last 10 messages context','Free AI workers only','5 conversations saved','Basic connectors']
  },
  {
    id: 'pro', name: 'Pro', price: 299, yearPrice: 2499,
    color: '#7c3aed', highlight: true,
    features: ['1,000 messages/day','Last 50 messages context','All free + premium workers','Unlimited conversations','All connectors','Priority response','File & image support']
  },
  {
    id: 'ultra', name: 'Ultra', price: 799, yearPrice: 6999,
    color: '#f59e0b', highlight: false,
    features: ['Unlimited messages','Full conversation context','All AI workers','Unlimited everything','Fastest response','Team sharing (5 members)','API key management','Custom workers']
  }
];

export default function BillingPage() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const plan = userData?.plan || 'free';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: 0 }}>⭐ Plans & Billing</h2>
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {/* Current plan */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Current Plan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{plan} Plan</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
            {userData?.messagesUsedToday || 0} messages used today
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
          <span style={{ fontSize: 13, color: !yearly ? 'var(--text)' : 'var(--text3)', fontWeight: !yearly ? 600 : 400 }}>Monthly</span>
          <button onClick={() => setYearly(y => !y)} style={{ width: 44, height: 24, borderRadius: 12, background: yearly ? '#7c3aed' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: yearly ? 23 : 3, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 13, color: yearly ? 'var(--text)' : 'var(--text3)', fontWeight: yearly ? 600 : 400 }}>Yearly</span>
          <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 10 }}>Save ~30%</span>
        </div>

        {/* Plans */}
        {PLANS.map(p => (
          <div key={p.id} style={{ background: 'var(--bg2)', border: `2px solid ${p.highlight ? p.color : 'var(--border)'}`, borderRadius: 16, padding: 20, marginBottom: 14, position: 'relative', boxShadow: p.highlight ? `0 0 24px rgba(124,58,237,0.15)` : 'none' }}>
            {p.highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20 }}>MOST POPULAR</div>}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
                  {p.price === 0 ? 'Free' : `₹${yearly ? p.yearPrice : p.price}`}
                  {p.price > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text3)' }}>{yearly ? '/year' : '/month'}</span>}
                </div>
                {p.price > 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>No auto-renewal · Manual only</div>}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {plan === p.id
                  ? <span style={{ padding: '7px 16px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Current</span>
                  : <button onClick={() => toast('Payment coming soon! Razorpay will be activated shortly.')} style={{ padding: '7px 16px', background: p.price === 0 ? 'transparent' : 'linear-gradient(135deg,#7c3aed,#a855f7)', border: p.price === 0 ? '1px solid var(--border)' : 'none', borderRadius: 8, color: p.price === 0 ? 'var(--text2)' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {p.price === 0 ? 'Downgrade' : `Get ${p.name}`}
                    </button>
                }
              </div>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.features.map(f => <li key={f} style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>{f}</li>)}
            </ul>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>All prices in INR ₹ · Payments secured by Razorpay · GDPR compliant</p>
      </div>
    </div>
  );
}
