import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Preferences, defaultPreferences } from '../lib/preferences';
import { loadPreferences, savePreferences } from '../lib/fs';

interface PreferencesContextType {
  preferences: Preferences;
  updatePreferences: (preferences: Preferences) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  useEffect(() => {
    async function loadPrefs() {
      const prefs = await loadPreferences();
      setPreferences(prefs);
    }
    loadPrefs();
  }, []);

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
