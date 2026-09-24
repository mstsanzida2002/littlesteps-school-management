import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

import { Toaster } from '../components/ui/Toaster.jsx';
import AuthProvider from '../features/auth/components/AuthProvider.jsx';
import { queryClient } from './queryClient.js';

// Devtools are code-split and only loaded in development.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster />
      <Suspense fallback={null}>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </Suspense>
    </QueryClientProvider>
  );
}
