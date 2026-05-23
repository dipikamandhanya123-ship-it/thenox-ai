import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import api from '../api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';

const DISCLAIMER = 'Thenox AI can make mistakes. Please double-check important responses.';

export default function ChatPage() {
  const { user, userData, refreshUser } = useAuth();
  const { theme, setTheme, accent } = useTheme();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renamVal, setRenamVal] = useState('');
  const [showWorkerPick, setShowWorkerPick] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { loadConversations(); }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'conversations'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConversations(convs);
      if (convs.length > 0 && !activeConv) {
        openConv(convs[0]);
      }
    } catch {}
  };

  const openConv = async (conv) => {
    setActiveConv(conv);
    setSidebarOpen(false);
    try {
      const q = query(collection(db, 'messages'), where('convId', '==', conv.id), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setMessages([]); }
  };

  const newChat = async () => {
    try {
      const ref = await addDoc(collection(db, 'conversations'), {
        userId: user.uid, title: 'New Chat',
        pinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      const conv = { id: ref.id, title: 'New Chat', pinned: false };
      setConversations(p => [conv, ...p]);
      setActiveConv(conv);
      setMessages([]);
      setSidebarOpen(false);
    } catch (e) { toast.error(e.message); }
  };

  const deleteConv = async (convId) => {
    try {
      await deleteDoc(doc(db, 'conversations', convId));
      setConversations(p => p.filter(c => c.id !== convId));
      if (activeConv?.id === convId) { setActiveConv(null); setMessages([]); }
    } catch (e) { toast.error(e.message); }
  };

  const pinConv = async (conv) => {
    try {
      await updateDoc(doc(db, 'conversations', conv.id), { pinned: !conv.pinned });
      setConversations(p => p.map(c => c.id === conv.id ? { ...c, pinned: !c.pinned } : c));
    } catch {}
  };

  const renameConv = async (convId) => {
    if (!renamVal.trim()) return;
    try {
      await updateDoc(doc(db, 'conversations', convId), { title: renamVal.trim() });
      setConversations(p => p.map(c => c.id === convId ? { ...c, title: renamVal.trim() } : c));
      if (activeConv?.id === convId) setActiveConv(a => ({ ...a, title: renamVal.trim() }));
      setRenaming(null);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() && files.length === 0) return;
    if (sending) return;

    const plan = userData?.plan || 'free';
    const used = userData?.messagesUsedToday || 0;
    const limits = { free: 100, pro: 1000, ultra: 99999 };
    if (used >= limits[plan]) {
      toast.error(`Daily limit reached! Upgrade your plan.`);
      return;
    }

    let convId = activeConv?.id;
    if (!convId) {
      const ref = await addDoc(collection(db, 'conversations'), {
        userId: user.uid, title: input.slice(0, 40) || 'New Chat',
        pinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      convId = ref.id;
      const conv = { id: convId, title: input.slice(0, 40) || 'New Chat', pinned: false };
      setConversations(p => [conv, ...p]);
      setActiveConv(conv);
    }

    const userMsg = { role: 'user', content: input, convId, userId: user.uid, createdAt: new Date() };
    await addDoc(collection(db, 'messages'), { ...userMsg, createdAt: serverTimestamp() });
    setMessages(p => [...p, { ...userMsg, id: Date.now().toString() }]);
    setInput('');
    setFiles([]);
    setSending(true);
    if (thinking) setThinking(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await api.post('/api/ai/chat', {
        message: input, history,
        workers: userData?.workers || [],
        webSearch, thinking
      });

      const aiMsg = { role: 'assistant', content: res.data.reply, model: res.data.model, convId, userId: user.uid, createdAt: new Date() };
      await addDoc(collection(db, 'messages'), { ...aiMsg, createdAt: serverTimestamp() });
      setMessages(p => [...p, { ...aiMsg, id: Date.now().toString() + '1' }]);

      await updateDoc(doc(db, 'conversations', convId), { title: input.slice(0, 40), updatedAt: serverTimestamp() });
      await api.post('/api/usage/increment', {});
      refreshUser();
    } catch (e) {
      toast.error(e.message);
      setMessages(p => [...p, { id: Date.now().toString() + '2', role: 'assistant', content: `❌ ${e.message}`, convId }]);
    }
    setSending(false);
  };

  const copyMsg = (content) => { navigator.clipboard.writeText(content); toast.success('Copied!'); };

  const sortedConvs = [...conversations].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const plan = userData?.plan || 'free';
  const used = userData?.messagesUsedToday || 0;
  const limits = { free: 100, pro: 1000, ultra: 99999 };
  const limit = limits[plan];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

      {/* SIDEBAR */}
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} onClick={() => setSidebarOpen(false)} />}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 280,
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        zIndex: 50, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column'
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>N</span>
          </div>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, flex: 1 }}>Thenox AI</span>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* New chat */}
        <div style={{ padding: '10px 10px 6px' }}>
          <button onClick={newChat} style={{ width: '100%', padding: '9px 14px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            ✏️ New Chat
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {sortedConvs.map(conv => (
            <div key={conv.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', background: activeConv?.id === conv.id ? 'rgba(139,92,246,0.12)' : 'transparent', marginBottom: 2, border: activeConv?.id === conv.id ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent' }}
              onClick={() => openConv(conv)}>
              {conv.pinned && <span style={{ fontSize: 10 }}>📌</span>}
              {renaming === conv.id ? (
                <input value={renamVal} onChange={e => setRenamVal(e.target.value)}
                  onBlur={() => renameConv(conv.id)}
                  onKeyDown={e => e.key === 'Enter' && renameConv(conv.id)}
                  autoFocus onClick={e => e.stopPropagation()}
                  style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', padding: '3px 6px', fontSize: 12, outline: 'none' }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, color: activeConv?.id === conv.id ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</span>
              )}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); pinConv(conv); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: '2px 4px', borderRadius: 4 }} title={conv.pinned ? 'Unpin' : 'Pin'}>📌</button>
                <button onClick={e => { e.stopPropagation(); setRenaming(conv.id); setRenamVal(conv.title); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: '2px 4px', borderRadius: 4 }} title="Rename">✏️</button>
                <button onClick={e => { e.stopPropagation(); deleteConv(conv.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: '2px 4px', borderRadius: 4 }} title="Delete">🗑️</button>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 }}>No conversations yet</div>
          )}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: '10px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => { navigate('/workers'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>🤖 Workers</button>
          <button onClick={() => { navigate('/connectors'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>🔌 Connectors</button>
          <button onClick={() => { navigate('/settings'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>⚙️ Settings</button>
          <button onClick={() => { navigate('/billing'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⭐ Upgrade Plan</button>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>☰</button>
          <button onClick={newChat} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }} title="New Chat">✏️</button>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConv?.title || 'Thenox AI'}</span>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} title="Toggle theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={() => navigate('/settings')} style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{userData?.name?.[0]?.toUpperCase() || 'U'}</button>
        </div>

        {/* Token bar */}
        <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{plan.toUpperCase()} · {used}/{limit === 99999 ? '∞' : limit} messages today</span>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ height: '100%', background: used/limit > 0.8 ? '#ef4444' : 'var(--accent)', borderRadius: 2, width: `${Math.min(100, (used/limit)*100)}%`, transition: 'width 0.3s' }} />
          </div>
          {plan === 'free' && <button onClick={() => navigate('/billing')} style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Upgrade</button>}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
              <h2 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>How can I help you today?</h2>
              <p style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.6 }}>Ask me anything — code, analysis, writing, images, and much more</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }} className="fade-in">
              {msg.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>N</div>
              )}
              <div style={{ maxWidth: '80%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'var(--bg2)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 14, lineHeight: 1.6
                }}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        code({inline, children}) {
                          return inline
                            ? <code style={{ background: 'rgba(139,92,246,0.15)', padding: '1px 5px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{children}</code>
                            : <pre style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, overflowX: 'auto', margin: '8px 0' }}><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{children}</code></pre>
                        }
                      }}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <button onClick={() => copyMsg(msg.content)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>📋 Copy</button>
                    {msg.model && <span style={{ fontSize: 10, color: 'var(--text3)', padding: '2px 6px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4 }}>{msg.model}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} className="fade-in">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>N</div>
              <div style={{ padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: 'center', padding: '4px 14px', fontSize: 11, color: 'var(--text3)' }}>{DISCLAIMER}</div>

        {/* Input area */}
        <div style={{ padding: '10px 14px 14px', background: 'var(--bg)' }}>
          {/* Mode toggles */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setThinking(t => !t)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: thinking ? 'rgba(139,92,246,0.2)' : 'transparent', border: `1px solid ${thinking ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`, color: thinking ? 'var(--accent2)' : 'var(--text3)', cursor: 'pointer' }}>🧠 Think</button>
            <button onClick={() => setWebSearch(w => !w)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: webSearch ? 'rgba(139,92,246,0.2)' : 'transparent', border: `1px solid ${webSearch ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`, color: webSearch ? 'var(--accent2)' : 'var(--text3)', cursor: 'pointer' }}>🔍 Web Search</button>
            <button onClick={() => navigate('/workers')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer' }}>🤖 Workers</button>
          </div>

          {/* Input box */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 10px', transition: 'border-color 0.2s' }}
            onFocus={() => {}} >
            <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, flexShrink: 0, padding: '2px 4px', borderRadius: 6 }} title="Attach file">＋</button>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files))} />
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message Thenox AI..." rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, resize: 'none', maxHeight: 120, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            />
            {files.length > 0 && <span style={{ fontSize: 11, color: 'var(--accent2)', flexShrink: 0 }}>{files.length} file{files.length > 1 ? 's' : ''}</span>}
            <button onClick={sendMessage} disabled={sending || (!input.trim() && files.length === 0)} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, opacity: sending ? 0.6 : 1, transition: 'opacity 0.2s' }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
