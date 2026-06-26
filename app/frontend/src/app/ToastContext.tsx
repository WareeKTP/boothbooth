import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ToastHost, type ToastItem } from '../components/ToastHost';
import type { DotStatus } from '../components/Dot';

interface ToastContextValue {
  toast: (text: string, status?: DotStatus) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((text: string, status?: DotStatus) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts, { id, text, status }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastHost toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
