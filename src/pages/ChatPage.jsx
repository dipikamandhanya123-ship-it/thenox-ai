import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, query, where,
  orderBy, updateDoc, deleteDoc, doc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { askAI } from '../ai';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const { user, userData, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [lightMode, setLightMode] = useState(
    () => localStorage.getItem('thenox-theme') === 'light'
  );
  const [convs,       setConvs]       = useState([]);
  const [activeConv,  setActiveConv]  = useState(null);
  const [msgs,        setMsgs]        = useState([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [sidebar,     setSidebar]     = useState(false);
  const [renaming,    setRenaming]    = useState(null);
  const [renamVal,    setRenamVal]    = useState('');
  const [thinking,    setThinking]    = useState(false);
  const [webSearch,   setWebSearch]   = useState(false);
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);

  // Apply theme
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
    localStorage.setItem('thenox-theme', lightMode ? 'light' : 'dark');
  }, [lightMode]);

  useEffect(() => { if (user) loadConvs(); }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  const loadConvs = async () => {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );
      const snap = await getDocs(q);
      setConvs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.warn(e.message); }
  };

  const openConv = async (conv) => {
    setActiveConv(conv); setSidebar(false); setCtxMenu(null);
    try {
      const q = query(
        collection(db, 'messages'),
        where('convId', '==', conv.id),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setMsgs([]); }
  };

  const newChat = async () => {
    try {
      const ref = await addDoc(collection(db, 'conversations'), {
        userId: user.uid, title: 'New Chat',
        pinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      const c = { id: ref.id, title: 'New Chat', pinned: false };
      setConvs(p => [c, ...p]); setActiveConv(c); setMsgs([]);
      setSidebar(false); inputRef.current?.focus();
    } catch (e) { toast.error(e.message); }
  };

  const delConv = async (id) => {
    try { await deleteDoc(doc(db, 'conversations', id)); } catch {}
    setConvs(p => p.filter(c => c.id !== id));
    if (activeConv?.id === id) { setActiveConv(null); setMsgs([]); }
    setCtxMenu(null);
  };

  const togglePin = async (conv) => {
    try { await updateDoc(doc(db, 'conversations', conv.id), { pinned: !conv.pinned }); } catch {}
    setConvs(p => p.map(c => c.id === conv.id ? { ...c, pinned: !c.pinned } : c));
    setCtxMenu(null);
  };

  const doRename = async (id) => {
    const t = renamVal.trim(); if (!t) return setRenaming(null);
    try { await updateDoc(doc(db, 'conversations', id), { title: t }); } catch {}
    setConvs(p => p.map(c => c.id === id ? { ...c, title: t } : c));
    if (activeConv?.id === id) setActiveConv(a => ({ ...a, title: t }));
    setRenaming(null);
  };

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending) return;
    const plan = userData?.plan || 'free';
    const used = userData?.messagesUsedToday || 0;
    const lim = { free: 100, pro: 1000, ultra: 99999 }[plan] || 100;
    if (used >= lim) { toast.error('Daily limit reached! Upgrade plan.'); return; }

    let convId = activeConv?.id;
    if (!convId) {
      try {
        const ref = await addDoc(collection(db, 'conversations'), {
          userId: user.uid, title: txt.slice(0, 40),
          pinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        convId = ref.id;
        const c = { id: convId, title: txt.slice(0, 40), pinned: false };
        setConvs(p => [c, ...p]); setActiveConv(c);
      } catch (e) { toast.error(e.message); return; }
    }

    const uMsg = { id: Date.now() + 'u', role: 'user', content: txt, convId };
    setMsgs(p => [...p, uMsg]);
    setInput('');
    setSending(true);
    try { await addDoc(collection(db, 'messages'), { role: 'user', content: txt, convId, userId: user.uid, createdAt: serverTimestamp() }); } catch {}

    try {
      const hist = [...msgs, uMsg].slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
      const res = await askAI(hist, { thinking, webSearch });
      const aMsg = { id: Date.now() + 'a', role: 'assistant', content: res.reply, model: res.model, convId };
      setMsgs(p => [...p, aMsg]);
      try {
        await addDoc(collection(db, 'messages'), { role: 'assistant', content: res.reply, model: res.model || '', convId, userId: user.uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'conversations', convId), { title: txt.slice(0, 40), updatedAt: serverTimestamp() });
        setConvs(p => p.map(c => c.id === convId ? { ...c, title: txt.slice(0, 40) } : c));
        const uRef = doc(db, 'users', user.uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) await updateDoc(uRef, { messagesUsedToday: (uSnap.data().messagesUsedToday || 0) + 1 });
        refreshUser();
      } catch {}
    } catch (e) {
      toast.error(e.message);
      setMsgs(p => [...p, { id: Date.now() + 'e', role: 'assistant', content: `❌ ${e.message}`, convId }]);
    }
    setSending(false);
  };

  // Styles
  const bg = (c) => ({ background: c });
  const plan = userData?.plan || 'free';
  const used = userData?.messagesUsedToday || 0;
  const lim  = { free: 100, pro: 1000, ultra: 99999 }[plan] || 100;
  const pct  = Math.min(100, (used / lim) * 100);
  const pinned = convs.filter(c => c.pinned);
  const others = convs.filter(c => !c.pinned);

  const Btn = ({ onClick, children, style }) => (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', ...style }}>{children}</button>
  );

  const Tag = ({ on, onClick, children }) => (
    <button onClick={onClick} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${on ? 'rgba(139,92,246,0.5)' : 'var(--border)'}`, background: on ? 'rgba(139,92,246,0.15)' : 'transparent', color: on ? 'var(--accent2)' : 'var(--text3)', fontFamily: 'Inter,sans-serif' }}>{children}</button>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

      {/* Overlay */}
      {sidebar && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40, backdropFilter: 'blur(2px)' }} onClick={() => setSidebar(false)} />}

      {/* ───── SIDEBAR ───── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 272,
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: sidebar ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)'
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 16, flexShrink: 0, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>N</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>Thenox AI</div>
            <div style={{ color: 'var(--text3)', fontSize: 11 }}>{plan.toUpperCase()} plan</div>
          </div>
          <Btn onClick={() => setSidebar(false)} style={{ color: 'var(--text3)', fontSize: 18, padding: '4px 6px', borderRadius: 6 }}>×</Btn>
        </div>

        {/* New chat */}
        <div style={{ padding: '12px 12px 8px' }}>
          <button onClick={newChat} style={{ width: '100%', padding: '10px 16px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            <span style={{ fontSize: 15 }}>+</span> New Chat
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {pinned.length > 0 && <div style={{ fontSize: 10, color: 'var(--text3)', padding: '8px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Pinned</div>}
          {[...pinned, ...others].map(conv => (
            <div key={conv.id} onClick={() => openConv(conv)}
              style={{ display: 'flex', alignItems: 'center', padding: '9px 10px', borderRadius: 10, cursor: 'pointer', background: activeConv?.id === conv.id ? 'rgba(139,92,246,0.12)' : 'transparent', border: `1px solid ${activeConv?.id === conv.id ? 'rgba(139,92,246,0.25)' : 'transparent'}`, marginBottom: 2, gap: 8, position: 'relative' }}>
              {renaming === conv.id
                ? <input value={renamVal} onChange={e => setRenamVal(e.target.value)} onBlur={() => doRename(conv.id)} onKeyDown={e => e.key === 'Enter' && doRename(conv.id)} autoFocus onClick={e => e.stopPropagation()} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', padding: '3px 8px', fontSize: 12, outline: 'none' }} />
                : <span style={{ flex: 1, fontSize: 13, color: activeConv?.id === conv.id ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.pinned ? '📌 ' : ''}{conv.title}</span>
              }
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Btn onClick={e => { e.stopPropagation(); setCtxMenu(ctxMenu === conv.id ? null : conv.id); }} style={{ color: 'var(--text3)', fontSize: 16, padding: '2px 6px', borderRadius: 6 }}>⋯</Btn>
                {ctxMenu === conv.id && (
                  <div style={{ position: 'absolute', right: 0, top: 28, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 100, minWidth: 148, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                    {[
                      { l: '✏️ Rename', f: () => { setRenaming(conv.id); setRenamVal(conv.title); setCtxMenu(null); } },
                      { l: conv.pinned ? '📌 Unpin' : '📌 Pin', f: () => togglePin(conv) },
                      { l: '🗑️ Delete', f: () => delConv(conv.id), red: true }
                    ].map(x => (
                      <button key={x.l} onClick={e => { e.stopPropagation(); x.f(); }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: x.red ? '#ef4444' : 'var(--text2)', fontSize: 13, textAlign: 'left', fontFamily: 'Inter,sans-serif' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>{x.l}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {convs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text3)', fontSize: 13 }}>No chats yet
Start one below ↓</div>}
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { i: '🤖', l: 'Workers',    p: '/workers' },
            { i: '🔌', l: 'Connectors', p: '/connectors' },
            { i: '⚙️', l: 'Settings',   p: '/settings' },
            { i: '💳', l: 'Billing',    p: '/billing' }
          ].map(x => (
            <button key={x.p} onClick={() => { navigate(x.p); setSidebar(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text2)', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; }}>
              {x.i} {x.l}
            </button>
          ))}
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9, color: '#ef4444', cursor: 'pointer', fontSize: 13, marginTop: 2, fontFamily: 'Inter,sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>🚪 Sign Out</button>
        </div>
      </aside>

      {/* ───── MAIN ───── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, minHeight: 52 }}>
          <button onClick={() => setSidebar(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 9, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>☰</button>
          <button onClick={newChat} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 9, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="New Chat">✏️</button>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConv?.title || 'Thenox AI'}</span>
          <button onClick={() => setLightMode(l => !l)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 9, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lightMode ? '🌙' : '☀️'}</button>
          <div onClick={() => navigate('/settings')} style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>{userData?.name?.[0]?.toUpperCase() || 'U'}</div>
        </div>

        {/* Usage */}
        <div style={{ padding: '4px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 26 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{plan.toUpperCase()} · {used}/{plan === 'ultra' ? '∞' : lim} msgs</span>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ height: '100%', background: pct > 80 ? '#ef4444' : 'var(--accent)', borderRadius: 2, width: pct + '%', transition: 'width 0.4s' }} />
          </div>
          {plan === 'free' && <button onClick={() => navigate('/billing')} style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif' }}>↑ Upgrade</button>}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {msgs.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }} className="fade-in">
              <div style={{ width: 70, height: 70, borderRadius: 22, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#fff', marginBottom: 22, boxShadow: '0 8px 28px rgba(124,58,237,0.35)' }}>N</div>
              <h2 style={{ color: 'var(--text)', fontSize: 21, fontWeight: 700, marginBottom: 8 }}>How can I help you today?</h2>
              <p style={{ color: 'var(--text3)', fontSize: 13, maxWidth: 290, lineHeight: 1.65 }}>Ask me anything — coding, writing, math, analysis, and much more</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['Write code', 'Explain something', 'Analyze data', 'Creative writing'].map(s => (
                  <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    style={{ padding: '7px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter,sans-serif' }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map(msg => (
            <div key={msg.id} className="fade-in" style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 1 }}>N</div>
              )}
              <div style={{ maxWidth: '78%' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'var(--bg2)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 14, lineHeight: 1.65, wordBreak: 'break-word'
                }}>
                  {msg.role === 'assistant'
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        code({ inline, children }) {
                          return inline
                            ? <code style={{ background: 'rgba(139,92,246,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{children}</code>
                            : <pre style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', margin: '8px 0', fontSize: 12, fontFamily: 'JetBrains Mono,monospace' }}><code>{children}</code></pre>;
                        },
                        p({ children }) { return <p style={{ margin: '3px 0' }}>{children}</p>; },
                        ul({ children }) { return <ul style={{ paddingLeft: 20, margin: '5px 0' }}>{children}</ul>; },
                        ol({ children }) { return <ol style={{ paddingLeft: 20, margin: '5px 0' }}>{children}</ol>; },
                        li({ children }) { return <li style={{ margin: '2px 0' }}>{children}</li>; },
                      }}>{msg.content}</ReactMarkdown>
                    : msg.content
                  }
                </div>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied!'); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 5, fontFamily: 'Inter,sans-serif' }}>📋 Copy</button>
                    {msg.model && <span style={{ fontSize: 10, color: 'var(--text3)', padding: '2px 7px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 5 }}>{msg.model}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="fade-in" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 1 }}>N</div>
              <div style={{ padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px 16px 16px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: 'center', padding: '3px 14px', fontSize: 11, color: 'var(--text3)' }}>Thenox AI can make mistakes. Please double-check important responses.</div>

        {/* Input */}
        <div style={{ padding: '8px 12px 14px', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <Tag on={thinking} onClick={() => setThinking(t => !t)}>🧠 Think</Tag>
            <Tag on={webSearch} onClick={() => setWebSearch(w => !w)}>🔍 Web Search</Tag>
            <Tag on={false} onClick={() => navigate('/workers')}>🤖 Workers{userData?.workers?.length > 0 ? ` (${userData.workers.length})` : ''}</Tag>
            <Tag on={false} onClick={() => navigate('/connectors')}>🔌 Connectors</Tag>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 10px' }}>
            <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 22, flexShrink: 0, padding: '1px 4px', lineHeight: 1 }} title="Attach">＋</button>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} />
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message Thenox AI..." rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, resize: 'none', maxHeight: 140, lineHeight: 1.55, fontFamily: 'Inter,sans-serif' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
            />
            <button onClick={send} disabled={sending || !input.trim()}
              style={{ background: input.trim() && !sending ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'var(--bg3)', border: `1px solid ${input.trim() && !sending ? 'transparent' : 'var(--border)'}`, color: input.trim() && !sending ? '#fff' : 'var(--text3)', width: 36, height: 36, borderRadius: 9, cursor: input.trim() && !sending ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s' }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
