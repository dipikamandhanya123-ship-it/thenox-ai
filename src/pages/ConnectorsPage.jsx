import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const CONNECTORS = [
  { id:'github', name:'GitHub', icon:'🐙', desc:'Access repos, create files, manage code', category:'Development', free:true },
  { id:'gdrive', name:'Google Drive', icon:'📁', desc:'Read and write Google Drive files', category:'Storage', free:true },
  { id:'gmail', name:'Gmail', icon:'📧', desc:'Read and send emails', category:'Communication', free:true },
  { id:'slack', name:'Slack', icon:'💬', desc:'Send messages, read channels', category:'Communication', free:true },
  { id:'notion', name:'Notion', icon:'📝', desc:'Read and write Notion pages', category:'Productivity', free:true },
  { id:'jira', name:'Jira', icon:'🎯', desc:'Manage issues and sprints', category:'Development', free:true },
  { id:'linear', name:'Linear', icon:'⚡', desc:'Track issues and projects', category:'Development', free:true },
  { id:'asana', name:'Asana', icon:'✅', desc:'Manage tasks and projects', category:'Productivity', free:true },
  { id:'trello', name:'Trello', icon:'📋', desc:'Manage boards and cards', category:'Productivity', free:true },
  { id:'figma', name:'Figma', icon:'🎨', desc:'Access design files', category:'Design', free:true },
  { id:'vercel', name:'Vercel', icon:'▲', desc:'Deploy and manage projects', category:'Development', free:true },
  { id:'netlify', name:'Netlify', icon:'🌐', desc:'Deploy web applications', category:'Development', free:true },
  { id:'supabase', name:'Supabase', icon:'🔥', desc:'Database and auth management', category:'Development', free:true },
  { id:'stripe', name:'Stripe', icon:'💳', desc:'Payment management', category:'Finance', free:false },
  { id:'hubspot', name:'HubSpot', icon:'🔶', desc:'CRM and marketing', category:'Business', free:false },
  { id:'salesforce', name:'Salesforce', icon:'☁️', desc:'CRM platform', category:'Business', free:false },
  { id:'youtube', name:'YouTube', icon:'📺', desc:'Manage YouTube content', category:'Media', free:true },
  { id:'twitter', name:'Twitter/X', icon:'🐦', desc:'Post and read tweets', category:'Social', free:false },
  { id:'instagram', name:'Instagram', icon:'📷', desc:'Manage Instagram content', category:'Social', free:false },
  { id:'discord', name:'Discord', icon:'🎮', desc:'Manage Discord servers', category:'Communication', free:true },
  { id:'whatsapp', name:'WhatsApp Business', icon:'💬', desc:'Business messaging', category:'Communication', free:false },
  { id:'telegram', name:'Telegram', icon:'✈️', desc:'Bot and messaging', category:'Communication', free:true },
  { id:'dropbox', name:'Dropbox', icon:'📦', desc:'File storage and sharing', category:'Storage', free:true },
  { id:'onedrive', name:'OneDrive', icon:'🔷', desc:'Microsoft file storage', category:'Storage', free:true },
  { id:'shopify', name:'Shopify', icon:'🛍️', desc:'E-commerce management', category:'Business', free:false },
  { id:'wordpress', name:'WordPress', icon:'🌐', desc:'Content management', category:'Content', free:true },
  { id:'airtable', name:'Airtable', icon:'📊', desc:'Database and spreadsheets', category:'Productivity', free:true },
  { id:'mongodb', name:'MongoDB', icon:'🍃', desc:'Database operations', category:'Development', free:true },
  { id:'aws-s3', name:'AWS S3', icon:'☁️', desc:'Cloud storage', category:'Storage', free:false },
  { id:'custom', name:'Custom API', icon:'🔧', desc:'Add your own API endpoint', category:'Custom', free:true },
];

const CATEGORIES = ['All', 'Development', 'Storage', 'Communication', 'Productivity', 'Design', 'Business', 'Finance', 'Social', 'Media', 'Content', 'Custom'];

export default function ConnectorsPage() {
  const { user, userData, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [myConns, setMyConns] = useState(userData?.connectors || []);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', url: '', key: '' });

  const filtered = CONNECTORS.filter(c => {
    const ms = c.name.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase());
    const mc = cat === 'All' || c.category === cat;
    return ms && mc;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aAdded = myConns.includes(a.id) ? 1 : 0;
    const bAdded = myConns.includes(b.id) ? 1 : 0;
    if (aAdded !== bAdded) return bAdded - aAdded;
    return a.name.localeCompare(b.name);
  });

  const toggle = async (connId) => {
    const has = myConns.includes(connId);
    const updated = has ? myConns.filter(c => c !== connId) : [...myConns, connId];
    setMyConns(updated);
    try {
      await updateDoc(doc(db, 'users', user.uid), { connectors: updated });
      toast.success(has ? 'Connector removed' : 'Connector added! ✅');
      refreshUser();
    } catch { toast.error('Failed'); }
  };

  const addCustom = async () => {
    if (!customForm.name || !customForm.url) return toast.error('Name and URL required');
    const id = 'custom_' + Date.now();
    const updated = [...myConns, id];
    setMyConns(updated);
    try {
      await updateDoc(doc(db, 'users', user.uid), { connectors: updated, [`customConnectors.${id}`]: customForm });
      toast.success('Custom connector added!');
      setShowCustom(false);
      setCustomForm({ name: '', url: '', key: '' });
      refreshUser();
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: 0 }}>🔌 Connectors</h2>
          <p style={{ color: 'var(--text3)', fontSize: 12, margin: 0 }}>{myConns.length} connected · {CONNECTORS.length} available</p>
        </div>
        <button onClick={() => setShowCustom(true)} style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Custom</button>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search connectors..."
          style={{ width: '100%', padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: cat === c ? 'var(--accent)' : 'transparent', border: `1px solid ${cat === c ? 'var(--accent)' : 'var(--border)'}`, color: cat === c ? '#fff' : 'var(--text3)' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {sorted.map(c => {
          const active = myConns.includes(c.id);
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: active ? 'rgba(139,92,246,0.08)' : 'var(--bg2)', border: `1px solid ${active ? 'rgba(139,92,246,0.25)' : 'var(--border)'}`, borderRadius: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text3)' }}>{c.category}</span>
                  {!c.free && <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 4 }}>PRO</span>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{c.desc}</p>
              </div>
              <button onClick={() => toggle(c.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: active ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#7c3aed,#a855f7)', color: active ? '#ef4444' : '#fff', flexShrink: 0 }}>
                {active ? 'Remove' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>

      {showCustom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380 }}>
            <h3 style={{ color: 'var(--text)', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>🔧 Add Custom Connector</h3>
            <input placeholder="Name" value={customForm.name} onChange={e => setCustomForm(f => ({...f,name:e.target.value}))}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 }} />
            <input placeholder="API Endpoint URL" value={customForm.url} onChange={e => setCustomForm(f => ({...f,url:e.target.value}))}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 }} />
            <input placeholder="API Key (optional)" value={customForm.key} onChange={e => setCustomForm(f => ({...f,key:e.target.value}))}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 16 }} />
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>⚠️ By adding an API key, you accept full responsibility for its use.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCustom(false)} style={{ flex: 1, padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={addCustom} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
