import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

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
        const data = await loadUser(u.uid);
        if (!data?.profileComplete) setNeedsProfile(true);
        else setNeedsProfile(false);
      } else {
        setUserData(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });
  }, []);

  const loadUser = async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) { setUserData(snap.data()); return snap.data(); }
    } catch {}
    return null;
  };

  const createUserDoc = async (u, extra = {}) => {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const data = {
        uid: u.uid, email: u.email,
        name: u.displayName || extra.name || '',
        avatar: u.photoURL || '',
        plan: 'free',
        tokensUsedToday: 0,
        tokensUsedMonth: 0,
        messagesUsedToday: 0,
        lastTokenReset: serverTimestamp(),
        profileComplete: false,
        theme: 'dark',
        accentColor: '#8b5cf6',
        workers: [],
        connectors: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...extra
      };
      await setDoc(ref, data);
      setUserData(data);
      setNeedsProfile(true);
      return data;
    } else {
      const d = snap.data();
      setUserData(d);
      if (!d.profileComplete) setNeedsProfile(true);
      return d;
    }
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
      await loadUser(user.uid);
      setNeedsProfile(false);
      toast.success('Profile saved! Welcome to Thenox AI ✨');
    } catch (e) { toast.error(e.message); }
  };

  const logout = async () => { await signOut(auth); toast.success('Signed out'); };
  const refreshUser = () => user && loadUser(user.uid);

  return (
    <Ctx.Provider value={{ user, userData, loading, needsProfile, loginGoogle, loginEmail, registerEmail, completeProfile, logout, refreshUser }}>
      {!loading && children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
