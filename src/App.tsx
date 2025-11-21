import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import './styles/layout.css';
import MainLayout from './main/MainLayout';
import PreferencesPage from './preferences/PreferencesPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'preferences'>('main');

  useEffect(() => {
    // メニューからのPreferencesイベントをリッスン
    const unlisten = listen('menu-preferences', () => {
      setCurrentPage('preferences');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    <div className="app">
      {currentPage === 'main' ? (
        <MainLayout />
      ) : (
        <PreferencesPage onBack={() => setCurrentPage('main')} />
      )}
    </div>
  );
}

export default App;
