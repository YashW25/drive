import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriveProvider } from './context/DriveContext';
import { LoginPage } from './pages/LoginPage';
import { DrivePage } from './pages/DrivePage';
import { SetupProfilePage } from './pages/SetupProfilePage';
import { SharePage } from './pages/SharePage';
import { InstallPwaModal } from './components/pwa/InstallPwaModal';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-medium">
        Loading TeleDrive...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Enforce compulsory profile completion for first login
  if (!user.isProfileComplete) {
    return <SetupProfilePage />;
  }

  return <>{children}</>;
};

export const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              user.isProfileComplete ? (
                <Navigate to="/drive" replace />
              ) : (
                <SetupProfilePage />
              )
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/drive"
          element={
            <ProtectedRoute>
              <DriveProvider>
                <DrivePage />
              </DriveProvider>
            </ProtectedRoute>
          }
        />
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="*" element={<Navigate to={user ? (user.isProfileComplete ? "/drive" : "/login") : "/login"} replace />} />
      </Routes>
      <InstallPwaModal />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
