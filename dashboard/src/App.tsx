import { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_BASE_URL } from './services/api';
import { isSupabaseConfigured } from './services/supabase';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import './App.css';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Chats = lazy(() => import('./pages/Chats').then(m => ({ default: m.Chats })));
const Webhooks = lazy(() => import('./pages/Webhooks').then(m => ({ default: m.Webhooks })));
const Templates = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const MessageTester = lazy(() => import('./pages/MessageTester').then(m => ({ default: m.MessageTester })));
const Infrastructure = lazy(() => import('./pages/Infrastructure').then(m => ({ default: m.Infrastructure })));
const Plugins = lazy(() => import('./pages/Plugins'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function AppContent() {
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const [isAuthenticated, setIsAuthenticated] = useState(!!savedKey);
  const [, setApiKey] = useState(savedKey || '');
  const { setRole, role } = useRole();
  const [isInitializing, setIsInitializing] = useState(true);

  // Re-validate and get role on mount or auth change
  const validateToken = async (key: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
      } else {
        setRole('viewer');
      }
    } catch {
      setRole('viewer');
    }
  };

  useEffect(() => {
    const keyOnMount = sessionStorage.getItem('openwa_api_key');
    if (keyOnMount) {
      validateToken(keyOnMount);
    }

    if (!isSupabaseConfigured) {
      setIsInitializing(false);
      return;
    }
    import('./services/supabase').then(({ supabase }) => {
      if (!supabase) {
        setIsInitializing(false);
        return;
      }
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session) {
          const key = session.access_token;
          setApiKey(key);
          sessionStorage.setItem('openwa_api_key', key);
          setIsAuthenticated(true);
          validateToken(key);
        }
        setIsInitializing(false);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            const key = session.access_token;
            setApiKey(key);
            sessionStorage.setItem('openwa_api_key', key);
            setIsAuthenticated(true);
            validateToken(key);
          }
        } else if (event === 'SIGNED_OUT') {
          const currentKey = sessionStorage.getItem('openwa_api_key');
          if (currentKey && currentKey.startsWith('ey')) {
            setApiKey('');
            setIsAuthenticated(false);
            setRole(null);
            sessionStorage.removeItem('openwa_api_key');
          }
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    });
  }, []);

  const handleLogin = (key: string) => {
    setApiKey(key);
    sessionStorage.setItem('openwa_api_key', key);
    setIsAuthenticated(true);
    validateToken(key);
  };

  const handleLogout = async () => {
    setApiKey('');
    setIsAuthenticated(false);
    setRole(null);
    sessionStorage.removeItem('openwa_api_key');
    const { supabase } = await import('./services/supabase');
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
  };

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (isInitializing) {
    return loadingFallback;
  }

  if (!isAuthenticated) {
    return <Suspense fallback={loadingFallback}><Login onLogin={handleLogin} /></Suspense>;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="chats" element={<Chats />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="templates" element={<Templates />} />
            {role === 'admin' && <Route path="api-keys" element={<ApiKeys />} />}
            <Route path="logs" element={<Logs />} />
            <Route path="message-tester" element={<MessageTester />} />
            <Route path="infrastructure" element={<Infrastructure />} />
            {role === 'admin' && <Route path="plugins" element={<Plugins />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
