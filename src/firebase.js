import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDW5u1q3QqkywbA9GFv29a24XZl7qBtAoM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'thenox-ai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'thenox-ai',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'thenox-ai.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '647423675228',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:647423675228:web:9ece86fc017f4a443b4f99',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export default app;
