import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'error' | 'info' | 'success';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 5000;

/**
 * Hook to show toast notifications from any component.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Provider component that manages toast notification state and renders the toast container.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idCounter = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'error') => {
      const id = String(++idCounter.current);
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), TOAST_DURATION_MS);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '48px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              maxWidth: '400px',
              wordBreak: 'break-word',
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              backgroundColor:
                toast.type === 'error'
                  ? '#dc3545'
                  : toast.type === 'success'
                    ? '#198754'
                    : '#0078d4',
              color: '#ffffff',
              animation: 'toast-slide-in 0.2s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => removeToast(toast.id)}
          >
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              aria-label="Close notification"
              onClick={e => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 2px',
                lineHeight: 1,
                opacity: 0.8,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
