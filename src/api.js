import axios from 'axios';
import { auth } from './firebase';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://thenox-ai-backend.onrender.com';

const api = axios.create({ baseURL: BACKEND, timeout: 60000 });

api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken(true);
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

api.interceptors.response.use(
  res => res,
  err => Promise.reject(new Error(err.response?.data?.error || err.message || 'Something went wrong'))
);

export default api;
