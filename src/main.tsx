import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PreferencesProvider } from './contexts/PreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PreferencesProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
