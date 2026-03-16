import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppRouter } from '@/app/router';
import { ConfirmProvider } from '@/components/feedback/confirm-provider';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/auth-context';
import { I18nProvider } from '@/features/i18n/i18n-context';
import '@/index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
            <Toaster />
          </ConfirmProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
);
