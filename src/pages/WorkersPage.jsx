import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ALL_WORKERS = [
  // Free Top Models
  { id:'gemini-2-flash', name:'Gemini 2.0 Flash', company:'Google', category:'General', free:true, tags:['fast','code','analysis'], rating:4.8 },
  { id:'gemini-flash-1-5', name:'Gemini 1.5 Flash', company:'Google', category:'General', free:true, tags:['fast','multimodal'], rating:4.7 },
  { id:'llama-3-3-70b', name:'Llama 3.3 70B', company:'Meta', category:'General', free:true, tags:['fast','code'], rating:4.7 },
  { id:'llama-3-1-8b', name:'Llama 3.1 8B', company:'Meta', category:'General', free:true, tags:['fast','lightweight'], rating:4.4 },
  { id:'deepseek-r1', name:'DeepSeek R1', company:'DeepSeek', category:'Reasoning', free:true, tags:['reasoning','math','code'], rating:4.9 },
  { id:'deepseek-v3', name:'DeepSeek V3', company:'DeepSeek', category:'General', free:true, tags:['code','analysis'], rating:4.8 },
  { id:'mistral-7b', name:'Mistral 7B', company:'Mistral AI', category:'General', free:true, tags:['fast','code'], rating:4.3 },
  { id:'mixtral-8x7b', name:'Mixtral 8x7B', company:'Mistral AI', category:'General', free:true, tags:['code','analysis'], rating:4.5 },
  { id:'qwen-3-72b', name:'Qwen 3 72B', company:'Alibaba', category:'General', free:true, tags:['multilingual','code'], rating:4.7 },
  { id:'qwen-3-8b', name:'Qwen 3 8B', company:'Alibaba', category:'General', free:true, tags:['fast','multilingual'], rating:4.4 },
  { id:'phi-4', name:'Phi-4', company:'Microsoft', category:'Reasoning', free:true, tags:['reasoning','math'], rating:4.6 },
  { id:'phi-3-mini', name:'Phi-3 Mini', company:'Microsoft', category:'General', free:true, tags:['fast','lightweight'], rating:4.3 },
  { id:'nous-hermes', name:'Nous Hermes 2', company:'Nous Research', category:'General', free:true, tags:['instruction','chat'], rating:4.4 },
  { id:'zephyr-7b', name:'Zephyr 7B', company:'HuggingFace', category:'General', free:true, tags:['chat','instruction'], rating:4.3 },
  // Premium
  { id:'gpt-4o', name:'GPT-4o', company:'OpenAI', category:'General', free:false, tags:['powerful','multimodal','code'], rating:4.9 },
  { id:'gpt-4-turbo', name:'GPT-4 Turbo', company:'OpenAI', category:'General', free:false, tags:['powerful','analysis'], rating:4.8 },
  { id:'claude-opus-4', name:'Claude Opus 4', company:'Anthropic', category:'Reasoning', free:false, tags:['reasoning','writing','code'], rating:4.9 },
  { id:'claude-sonnet-4', name:'Claude Sonnet 4', company:'Anthropic', category:'General', free:false, tags:['balanced','code','analysis'], rating:4.8 },
  { id:'gemini-ultra', name:'Gemini Ultra', company:'Google', category:'General', free:false, tags:['powerful','multimodal'], rating:4.9 },
  { id:'grok-3', name:'Grok 3', company:'xAI', category:'General', free:false, tags:['real-time','analysis'], rating:4.7 },
];

const CATEGORIES = ['All', 'General', 'Reasoning', 'Coding', 'Multimodal'];

export default function WorkersPage() {
  const { user, userData, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [freeOnly, setFreeOnly] = useState(false);
  const [myWorkers, setMyWorkers] = useState(userData?.workers || []);

  const filtered = ALL_WORKERS.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.company.toLowerCase().includes(search.toLowerCase()) ||
      w.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filter === 'All' || w.category === filter;
    const matchFree = !freeOnly || w.free;
    return matchSearch && matchCat && matchFree;
  }).sort((a, b) => b.rating - a.rating);

  const toggle = async (workerId) => {
    const has = myWorkers.includes(workerId);
    const updated = has ? myWorkers.filter(w => w !== workerId) : [...myWorkers, workerId];
    setMyWorkers(updated);
    try {
      await updateDoc(doc(db, 'users', user.uid), { workers: updated });
      toast.success(has ? 'Worker removed' : 'Worker added! ✅');
      refreshUser();
    } catch { toast.error('Failed to update workers'); }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: 0 }}>🤖 Workers</h2>
          <p style={{ color: 'var(--text3)', fontSize: 12, margin: 0 }}>{myWorkers.length} active · {ALL_WORKERS.length} available</p>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, or task (e.g. 'free', 'code', 'image')..."
          style={{ width: '100%', padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: filter === c ? 'var(--accent)' : 'transparent', border: `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`, color: filter === c ? '#fff' : 'var(--text3)', transition: 'all 0.15s' }}>{c}</button>
          ))}
          <button onClick={() => setFreeOnly(f => !f)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: freeOnly ? 'rgba(34,197,94,0.2)' : 'transparent', border: `1px solid ${freeOnly ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, color: freeOnly ? '#22c55e' : 'var(--text3)', marginLeft: 'auto' }}>✅ Free only</button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p>No workers found for "{search}"</p>
          </div>
        )}
        {filtered.map(w => {
          const active = myWorkers.includes(w.id);
          return (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: active ? 'rgba(139,92,246,0.08)' : 'var(--bg2)', border: `1px solid ${active ? 'rgba(139,92,246,0.25)' : 'var(--border)'}`, borderRadius: 12, marginBottom: 8, transition: 'all 0.15s' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{w.name}</span>
                  {w.free ? <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, fontWeight: 600 }}>FREE</span>
                    : <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4, fontWeight: 600 }}>PAID</span>}
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>⭐ {w.rating}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{w.company} · {w.category}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {w.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text3)' }}>{t}</span>)}
                </div>
              </div>
              <button onClick={() => toggle(w.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: active ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#7c3aed,#a855f7)', color: active ? '#ef4444' : '#fff', transition: 'all 0.15s', flexShrink: 0 }}>
                {active ? 'Remove' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
