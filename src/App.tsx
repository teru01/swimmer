import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
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
        className="sponsor-button"
        onClick={() => openUrl('https://github.com/sponsors/teru01')}
        title="Sponsor"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M7.655 14.916v-.001l-.006-.003-.018-.01a7.2 7.2 0 0 1-.268-.15 21 21 0 0 1-3.023-2.12C2.56 11.106.5 8.85.5 5.5c0-2.5 1.986-4.5 4.75-4.5 1.47 0 2.56.636 3.25 1.38.69-.744 1.78-1.38 3.25-1.38 2.764 0 4.75 2 4.75 4.5 0 3.35-2.06 5.606-3.938 7.132a21 21 0 0 1-3.291 2.27 13 13 0 0 1-.244.138l-.018.01-.006.003z" />
        </svg>
      </button>
    </div>
  );
}

export default App;
