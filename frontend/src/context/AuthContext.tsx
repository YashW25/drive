import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

interface User {
  id: string;
  phoneNumber: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<{ phone: string; message: string; devCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('teledrive_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiRequest<{ user: User }>('/auth/me');
        setUser(res.user);
      } catch (err) {
        console.error('Session restore failed:', err);
        localStorage.removeItem('teledrive_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  const requestOtp = async (phone: string) => {
    return apiRequest<{ phone: string; message: string; devCode?: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: phone }),
    });
  };

  const verifyOtp = async (phone: string, code: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: phone, code }),
    });

    localStorage.setItem('teledrive_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('teledrive_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
