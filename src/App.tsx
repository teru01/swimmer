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

  const handleNavigateToPreferences = (section?: PreferencesSection) => {
    setPreferencesSection(section);
    setCurrentPage('preferences');
  };

  return (
    <div className="app">
      {currentPage === 'main' ? (
        <MainLayout onNavigateToPreferences={handleNavigateToPreferences} />
      ) : (
        <PreferencesPage
          onBack={() => setCurrentPage('main')}
          initialSection={preferencesSection}
        />
      )}
    </div>
  );
}

export default App;
