import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import api from '../api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const { user, userData, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renamVal, setRenamVal] = useState('');
  const [thinking, setThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { loadConvs(); }, [user]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  const loadConvs = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'conversations'), where('userId','==',user.uid), orderBy('updatedAt','desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConvs(list);
    } catch {}
  };

  const openConv = async (conv) => {
    setActiveConv(conv);
    setSidebarOpen(false);
    setShowMenu(null);
    try {
      const q = query(collection(db, 'messages'), where('convId','==',conv.id), orderBy('createdAt','asc'));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setMsgs([]); }
  };

  const newChat = async () => {
    try {
      const ref = await addDoc(collection(db,'conversations'),{ userId:user.uid, title:'New Chat', pinned:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      const conv = { id:ref.id, title:'New Chat', pinned:false };
      setConvs(p => [conv,...p]);
      setActiveConv(conv);
      setMsgs([]);
      setSidebarOpen(false);
    } catch(e) { toast.error(e.message); }
  };

  const deleteConv = async (id) => {
    await deleteDoc(doc(db,'conversations',id));
    setConvs(p => p.filter(c => c.id !== id));
    if (activeConv?.id === id) { setActiveConv(null); setMsgs([]); }
    setShowMenu(null);
  };

  const pinConv = async (conv) => {
    await updateDoc(doc(db,'conversations',conv.id), { pinned: !conv.pinned });
    setConvs(p => p.map(c => c.id===conv.id ? {...c,pinned:!c.pinned} : c));
    setShowMenu(null);
  };

  const doRename = async (id) => {
    if (!renamVal.trim()) return;
    await updateDoc(doc(db,'conversations',id), { title: renamVal.trim() });
    setConvs(p => p.map(c => c.id===id ? {...c,title:renamVal.trim()} : c));
    if (activeConv?.id===id) setActiveConv(a => ({...a,title:renamVal.trim()}));
    setRenaming(null);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const plan = userData?.plan || 'free';
    const used = userData?.messagesUsedToday || 0;
    const limits = { free:100, pro:1000, ultra:99999 };
    if (used >= limits[plan]) { toast.error('Daily limit reached! Upgrade your plan.'); return; }

    let convId = activeConv?.id;
    if (!convId) {
      const ref = await addDoc(collection(db,'conversations'),{ userId:user.uid, title:input.slice(0,40)||'New Chat', pinned:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      convId = ref.id;
      const conv = { id:convId, title:input.slice(0,40)||'New Chat', pinned:false };
      setConvs(p => [conv,...p]);
      setActiveConv(conv);
    }

    const userMsg = { id: Date.now()+'u', role:'user', content:input, convId, userId:user.uid, createdAt:new Date() };
    await addDoc(collection(db,'messages'), { role:'user', content:input, convId, userId:user.uid, createdAt:serverTimestamp() });
    setMsgs(p => [...p, userMsg]);
    const sentInput = input;
    setInput('');
    setSending(true);

    try {
      const history = msgs.slice(-10).map(m => ({ role: m.role==='assistant'?'assistant':'user', content: m.content }));
      const res = await api.post('/api/ai/chat', { message: sentInput, history, workers: userData?.workers||[], webSearch, thinking });
      const aiMsg = { id:Date.now()+'a', role:'assistant', content:res.data.reply, model:res.data.model, convId, userId:user.uid, createdAt:new Date() };
      await addDoc(collection(db,'messages'), { role:'assistant', content:res.data.reply, model:res.data.model||'', convId, userId:user.uid, createdAt:serverTimestamp() });
      setMsgs(p => [...p, aiMsg]);
      await updateDoc(doc(db,'conversations',convId), { title: sentInput.slice(0,40), updatedAt:serverTimestamp() });
      setConvs(p => p.map(c => c.id===convId ? {...c,title:sentInput.slice(0,40)} : c));
      refreshUser();
    } catch(e) {
      toast.error(e.message);
      setMsgs(p => [...p, { id:Date.now()+'e', role:'assistant', content:`❌ ${e.message}`, convId }]);
    }
    setSending(false);
  };

  const plan = userData?.plan || 'free';
  const used = userData?.messagesUsedToday || 0;
  const limits = { free:100, pro:1000, ultra:99999 };
  const pct = Math.min(100, (used/limits[plan])*100);
  const pinnedConvs = convs.filter(c=>c.pinned);
  const otherConvs = convs.filter(c=>!c.pinned);

  const S = { // styles shorthand
    sidebar: { position:'fixed', top:0, left:0, height:'100%', width:280, background:'var(--bg2)', borderRight:'1px solid var(--border)', zIndex:50, transform:sidebarOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.25s ease', display:'flex', flexDirection:'column' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40 },
    convItem: (active,pinned) => ({ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:10, cursor:'pointer', background:active?'rgba(139,92,246,0.12)':'transparent', border:active?'1px solid rgba(139,92,246,0.2)':'1px solid transparent', marginBottom:2, position:'relative' }),
    iconBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, padding:'3px 5px', borderRadius:5 },
    tag: (on) => ({ fontSize:11, padding:'4px 10px', borderRadius:20, cursor:'pointer', background:on?'rgba(139,92,246,0.2)':'transparent', border:`1px solid ${on?'rgba(139,92,246,0.4)':'var(--border)'}`, color:on?'var(--accent2)':'var(--text3)' }),
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {/* OVERLAY */}
      {sidebarOpen && <div style={S.overlay} onClick={()=>setSidebarOpen(false)}/>}

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        {/* Logo */}
        <div style={{ padding:'16px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:14, flexShrink:0, boxShadow:'0 4px 12px rgba(124,58,237,0.3)' }}>N</div>
          <span style={{ color:'var(--text)', fontWeight:700, fontSize:15, flex:1 }}>Thenox AI</span>
          <button onClick={()=>setSidebarOpen(false)} style={{...S.iconBtn, fontSize:18}}>✕</button>
        </div>

        {/* New chat */}
        <div style={{ padding:'10px 10px 6px' }}>
          <button onClick={newChat} style={{ width:'100%', padding:'9px 14px', background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8, justifyContent:'center', boxShadow:'0 4px 12px rgba(124,58,237,0.25)' }}>
            ✏️ New Chat
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex:1, overflowY:'auto', padding:'4px 8px' }}>
          {pinnedConvs.length>0 && <div style={{ fontSize:10, color:'var(--text3)', padding:'8px 6px 3px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>📌 Pinned</div>}
          {[...pinnedConvs,...otherConvs].map(conv=>(
            <div key={conv.id} style={S.convItem(activeConv?.id===conv.id, conv.pinned)} onClick={()=>openConv(conv)}>
              {renaming===conv.id ? (
                <input value={renamVal} onChange={e=>setRenamVal(e.target.value)} onBlur={()=>doRename(conv.id)} onKeyDown={e=>e.key==='Enter'&&doRename(conv.id)} autoFocus onClick={e=>e.stopPropagation()}
                  style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--accent)', borderRadius:6, color:'var(--text)', padding:'3px 7px', fontSize:12, outline:'none' }}/>
              ) : (
                <span style={{ flex:1, fontSize:13, color:activeConv?.id===conv.id?'var(--text)':'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conv.pinned?'📌 ':''}{conv.title}</span>
              )}
              <div style={{ position:'relative', flexShrink:0 }}>
                <button onClick={e=>{e.stopPropagation();setShowMenu(showMenu===conv.id?null:conv.id);}} style={S.iconBtn}>⋯</button>
                {showMenu===conv.id && (
                  <div style={{ position:'absolute', right:0, top:24, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, zIndex:100, minWidth:140, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', overflow:'hidden' }}>
                    {[{label:'✏️ Rename',fn:()=>{setRenaming(conv.id);setRenamVal(conv.title);setShowMenu(null);}},{label:conv.pinned?'📌 Unpin':'📌 Pin',fn:()=>pinConv(conv)},{label:'🗑️ Delete',fn:()=>deleteConv(conv.id)}].map(item=>(
                      <button key={item.label} onClick={e=>{e.stopPropagation();item.fn();}} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', color:'var(--text2)', fontSize:13, textAlign:'left' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg2)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>{item.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {convs.length===0 && <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)', fontSize:13 }}>No conversations yet</div>}
        </div>

        {/* Footer nav */}
        <div style={{ padding:'10px 8px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:4 }}>
          {[{icon:'🤖',label:'Workers',path:'/workers'},{icon:'🔌',label:'Connectors',path:'/connectors'},{icon:'⚙️',label:'Settings',path:'/settings'}].map(item=>(
            <button key={item.path} onClick={()=>{navigate(item.path);setSidebarOpen(false);}} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'none', border:'1px solid var(--border)', borderRadius:9, color:'var(--text2)', cursor:'pointer', fontSize:13, transition:'all 0.15s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--text2)';}}>
              {item.icon} {item.label}
            </button>
          ))}
          <button onClick={()=>{navigate('/billing');setSidebarOpen(false);}} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', borderRadius:9, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, marginTop:2 }}>
            ⭐ Upgrade Plan
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
          <button onClick={()=>setSidebarOpen(true)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--text2)', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>☰</button>
          <button onClick={newChat} style={{ background:'none', border:'1px solid var(--border)', color:'var(--text2)', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} title="New Chat">✏️</button>
          <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeConv?.title||'Thenox AI'}</span>
          <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} style={{ background:'none', border:'1px solid var(--border)', color:'var(--text2)', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>{theme==='dark'?'☀️':'🌙'}</button>
          <button onClick={()=>navigate('/settings')} style={{ width:34, height:34, borderRadius:8, background:'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>{userData?.name?.[0]?.toUpperCase()||'U'}</button>
        </div>

        {/* Usage bar */}
        <div style={{ padding:'5px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{plan.toUpperCase()} · {used}/{plan==='ultra'?'∞':limits[plan]} msgs</span>
          <div style={{ flex:1, height:3, background:'var(--border)', borderRadius:2 }}>
            <div style={{ height:'100%', background:pct>80?'#ef4444':'var(--accent)', borderRadius:2, width:pct+'%', transition:'width 0.3s' }}/>
          </div>
          {plan==='free' && <button onClick={()=>navigate('/billing')} style={{ fontSize:10, color:'var(--accent2)', background:'none', border:'none', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>↑ Upgrade</button>}
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 12px', display:'flex', flexDirection:'column', gap:14 }}>
          {msgs.length===0 && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'#fff', marginBottom:20, boxShadow:'0 8px 24px rgba(124,58,237,0.3)' }}>N</div>
              <h2 style={{ color:'var(--text)', fontSize:20, fontWeight:700, marginBottom:8 }}>How can I help you today?</h2>
              <p style={{ color:'var(--text3)', fontSize:13, maxWidth:280, lineHeight:1.6 }}>Ask me anything — coding, writing, analysis, math, and much more</p>
              <div style={{ display:'flex', gap:8, marginTop:20, flexWrap:'wrap', justifyContent:'center' }}>
                {['Write code','Explain a concept','Analyze data','Creative writing'].map(s=>(
                  <button key={s} onClick={()=>{setInput(s);inputRef.current?.focus();}} style={{ padding:'7px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, color:'var(--text2)', cursor:'pointer', fontSize:12 }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map(msg=>(
            <div key={msg.id} style={{ display:'flex', flexDirection:msg.role==='user'?'row-reverse':'row', gap:10, alignItems:'flex-start' }}>
              {msg.role==='assistant' && (
                <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', marginTop:2 }}>N</div>
              )}
              <div style={{ maxWidth:'78%', minWidth:60 }}>
                <div style={{ padding:'10px 14px', borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', background:msg.role==='user'?'linear-gradient(135deg,#7c3aed,#a855f7)':'var(--bg2)', border:msg.role==='user'?'none':'1px solid var(--border)', color:msg.role==='user'?'#fff':'var(--text)', fontSize:14, lineHeight:1.6, wordBreak:'break-word' }}>
                  {msg.role==='assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      code({inline,children}) {
                        return inline
                          ? <code style={{ background:'rgba(139,92,246,0.15)', padding:'1px 5px', borderRadius:4, fontFamily:'JetBrains Mono,monospace', fontSize:12 }}>{children}</code>
                          : <pre style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', overflowX:'auto', margin:'8px 0', fontSize:12, fontFamily:'JetBrains Mono,monospace' }}><code>{children}</code></pre>
                      },
                      p({children}){return <p style={{margin:'4px 0'}}>{children}</p>},
                      ul({children}){return <ul style={{paddingLeft:20,margin:'6px 0'}}>{children}</ul>},
                      ol({children}){return <ol style={{paddingLeft:20,margin:'6px 0'}}>{children}</ol>},
                    }}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                </div>
                {msg.role==='assistant' && (
                  <div style={{ display:'flex', gap:6, marginTop:5, alignItems:'center' }}>
                    <button onClick={()=>{navigator.clipboard.writeText(msg.content);toast.success('Copied!');}} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:11, padding:'2px 7px', borderRadius:5, display:'flex', alignItems:'center', gap:3 }}>📋 Copy</button>
                    {msg.model && <span style={{ fontSize:10, color:'var(--text3)', padding:'2px 7px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:5 }}>{msg.model}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#7c3aed,#a855f7)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff', fontWeight:700, marginTop:2 }}>N</div>
              <div style={{ padding:'12px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'16px 16px 16px 4px', display:'flex', gap:5, alignItems:'center' }}>
                {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)', animation:`bounce 1.2s ${i*0.2}s infinite` }}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign:'center', padding:'3px 14px', fontSize:11, color:'var(--text3)' }}>Thenox AI can make mistakes. Please double-check important responses.</div>

        {/* Input */}
        <div style={{ padding:'8px 12px 12px', background:'var(--bg)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:7, flexWrap:'wrap' }}>
            <button onClick={()=>setThinking(t=>!t)} style={S.tag(thinking)}>🧠 Think</button>
            <button onClick={()=>setWebSearch(w=>!w)} style={S.tag(webSearch)}>🔍 Web Search</button>
            <button onClick={()=>navigate('/workers')} style={S.tag(false)}>🤖 Workers ({userData?.workers?.length||0})</button>
            <button onClick={()=>navigate('/connectors')} style={S.tag(false)}>🔌 Connectors</button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'8px 10px' }}>
            <button onClick={()=>fileRef.current?.click()} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:20, flexShrink:0, padding:'2px 4px' }} title="Attach">＋</button>
            <input ref={fileRef} type="file" multiple style={{ display:'none' }}/>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
              placeholder="Message Thenox AI..." rows={1}
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:14, resize:'none', maxHeight:120, lineHeight:1.5, fontFamily:'Inter,sans-serif' }}
              onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
            />
            <button onClick={send} disabled={sending||!input.trim()} style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', color:'#fff', width:34, height:34, borderRadius:8, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, opacity:sending?0.5:1, transition:'opacity 0.2s' }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
