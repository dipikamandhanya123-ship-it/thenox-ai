import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [userData,    setUserData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [needsProfile,setNeedsProfile]= useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Direct Firestore — no backend needed
        const ref  = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setUserData(d);
          setNeedsProfile(!d.profileComplete);
        } else {
          // New user — create doc
          const newUser = {
            uid: u.uid, email: u.email,
            name: u.displayName || u.email?.split('@')[0] || 'User',
            avatar: u.photoURL || '',
            plan: 'free', messagesUsedToday: 0,
            workers: [], connectors: [], profileComplete: false,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          };
          await setDoc(ref, newUser);
          setUserData(newUser);
          setNeedsProfile(true);
        }
      } else {
        setUser(null);
        setUserData(null);
        setNeedsProfile(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') toast.error(e.message);
    }
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
    } catch (e) { toast.error(e.message); }
  };

  const completeProfile = async (data) => {
    try {
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { ...data, profileComplete: true, updatedAt: serverTimestamp() });
      const snap = await getDoc(ref);
      setUserData(snap.data());
      setNeedsProfile(false);
      toast.success('Welcome to Thenox AI! ✨');
    } catch (e) { toast.error(e.message); }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null); setUserData(null);
  };

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
