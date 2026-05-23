import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('thenox-theme') || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem('thenox-accent') || '#8b5cf6');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    localStorage.setItem('thenox-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    localStorage.setItem('thenox-accent', accent);
  }, [accent]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
