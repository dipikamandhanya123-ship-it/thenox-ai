import axios from 'axios';
import { auth } from './firebase';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://thenox-ai-backend.onrender.com';

const api = axios.create({ baseURL: BACKEND, timeout: 60000 });

api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      // Always get fresh token
      const token = await user.getIdToken(true);
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('Token error:', e.message);
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

export default api;
