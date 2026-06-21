import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './app/ThemeContext';
import { DensityProvider } from './app/DensityContext';
import { ToastProvider } from './app/ToastContext';
import { CartProvider } from './features/pos/useCart';
import { AppRouter } from './app/router';
import './styles/index.css';

// Single shared client. Most lists poll every 10-15s per frontend-final.md §7;
// retry:false at the query level (useSession) overrides this default where a
// 401 should not be retried. No global base URL — apiClient is always relative.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DensityProvider>
          <ToastProvider>
            <CartProvider>
              <AppRouter />
            </CartProvider>
          </ToastProvider>
        </DensityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
