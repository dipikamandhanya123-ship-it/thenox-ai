import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import WorkersPage from './pages/WorkersPage';
import ConnectorsPage from './pages/ConnectorsPage';
import BillingPage from './pages/BillingPage';

function Guard({ children }) {
  const { user, needsProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (needsProfile) return <Navigate to="/setup" replace />;
  return children;
}

function SetupGuard({ children }) {
  const { user, needsProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!needsProfile) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route path="/setup" element={<SetupGuard><ProfileSetupPage /></SetupGuard>} />
      <Route path="/" element={<Guard><ChatPage /></Guard>} />
      <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
      <Route path="/workers" element={<Guard><WorkersPage /></Guard>} />
      <Route path="/connectors" element={<Guard><ConnectorsPage /></Guard>} />
      <Route path="/billing" element={<Guard><BillingPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" toastOptions={{
            style: { background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
          }} />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
