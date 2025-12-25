import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import './styles/layout.css';
import MainLayout from './main/MainLayout';
import PreferencesPage, { PreferencesSection } from './preferences/PreferencesPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'preferences'>('main');
  const [preferencesSection, setPreferencesSection] = useState<PreferencesSection | undefined>(
    undefined
  );

  useEffect(() => {
    // メニューからのPreferencesイベントをリッスン
    const unlisten = listen('menu-preferences', () => {
      setPreferencesSection(undefined);
      setCurrentPage('preferences');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    const handleCopy = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          navigator.clipboard.writeText(selection.toString());
        }
      }
    };

    document.addEventListener('keydown', handleCopy);

    return () => {
      document.removeEventListener('keydown', handleCopy);
    };
  }, []);

  const handleNavigateToPreferences = (section?: PreferencesSection) => {
    setPreferencesSection(section);
    setCurrentPage('preferences');
  };

  return (
    <div className="app">
      <MainLayout onNavigateToPreferences={handleNavigateToPreferences} />
      {currentPage === 'preferences' && (
        <PreferencesPage
          onBack={() => setCurrentPage('main')}
          initialSection={preferencesSection}
        />
      )}
    </div>
  );
}

export default App;
