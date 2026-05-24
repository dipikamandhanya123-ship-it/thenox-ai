import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import api from '../api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync with backend using fresh token
        try {
          await u.getIdToken(true); // Force refresh token
          const res = await api.post('/api/auth/sync');
          if (res.data.user) {
            setUserData(res.data.user);
            if (!res.data.user.profileComplete) setNeedsProfile(true);
            else setNeedsProfile(false);
          }
        } catch {
          // Fallback to Firestore direct
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            setUserData(snap.data());
            if (!snap.data().profileComplete) setNeedsProfile(true);
          } else {
            setNeedsProfile(true);
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });
  }, []);

  const createUserDoc = async (u, extra = {}) => {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const data = {
        uid: u.uid, email: u.email,
        name: u.displayName || extra.name || u.email?.split('@')[0] || 'User',
        avatar: u.photoURL || '',
        plan: 'free', messagesUsedToday: 0, tokensUsedToday: 0,
        workers: [], connectors: [], profileComplete: false,
        theme: 'dark', accentColor: '#8b5cf6',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        ...extra
      };
      await setDoc(ref, data);
      setUserData(data);
    } else {
      setUserData(snap.data());
    }
    const d = (await getDoc(ref)).data();
    if (!d?.profileComplete) setNeedsProfile(true);
  };

  const loginGoogle = async () => {
    try {
      const r = await signInWithPopup(auth, googleProvider);
      await createUserDoc(r.user, { provider: 'google' });
    } catch (e) { toast.error(e.message); }
  };

  const loginEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back! ✅');
    } catch (e) { toast.error(e.message); }
  };

  const registerEmail = async (email, password, name) => {
    try {
      const r = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(r.user, { displayName: name });
      await createUserDoc(r.user, { name, provider: 'email' });
    } catch (e) { toast.error(e.message); }
  };

  const completeProfile = async (profileData) => {
    try {
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { ...profileData, profileComplete: true, updatedAt: serverTimestamp() });
      const snap = await getDoc(ref);
      setUserData(snap.data());
      setNeedsProfile(false);
      toast.success('Welcome to Thenox AI! ✨');
    } catch (e) { toast.error(e.message); }
  };

  const logout = async () => { await signOut(auth); toast.success('Signed out'); };

  const refreshUser = async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setUserData(snap.data());
  };

  return (
    <Ctx.Provider value={{ user, userData, loading, needsProfile, loginGoogle, loginEmail, registerEmail, completeProfile, logout, refreshUser }}>
      {!loading && children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
