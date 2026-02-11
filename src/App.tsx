import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import './App.css';
import './styles/layout.css';
import MainLayout from './main/MainLayout';
import PreferencesPage, { PreferencesSection } from './preferences/PreferencesPage';
import bmcLogo from './assets/bmc-logo-yellow.png';

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
          navigator.clipboard.writeText(selection.toString()).catch(() => {});
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
      <button
        className="bmc-button"
        onClick={() => openUrl('https://buymeacoffee.com/teru01')}
        title="Buy me a coffee"
      >
        <img src={bmcLogo} alt="Buy me a coffee" className="bmc-logo" />
      </button>
    </div>
  );
}

export default App;
