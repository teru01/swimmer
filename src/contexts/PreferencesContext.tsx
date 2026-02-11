import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Preferences, defaultPreferences } from '../lib/preferences';
import { loadPreferences, savePreferences } from '../lib/fs';
import { commands } from '../api/commands';

interface PreferencesContextType {
  preferences: Preferences;
  updatePreferences: (preferences: Preferences) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  useEffect(() => {
    async function loadPrefs() {
      try {
        const prefs = await loadPreferences();
        setPreferences(prefs);
        if (prefs.general.kubeconfigPath) {
          await commands.setKubeconfigPath(prefs.general.kubeconfigPath);
        }
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
    loadPrefs();
  }, []);

  useEffect(() => {
    const theme = preferences.general.theme;
    const applyTheme = (resolved: 'dark' | 'light') => {
      document.documentElement.setAttribute('data-theme', resolved);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [preferences.general.theme]);

  const updatePreferences = async (newPreferences: Preferences) => {
    await savePreferences(newPreferences);
    setPreferences(newPreferences);
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
