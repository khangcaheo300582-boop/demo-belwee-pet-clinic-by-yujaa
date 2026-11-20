"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accessToken: string, user: AuthUser) => void;
  logout: () => void;
  setAccessToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    // Read from memory only on client (cookies handled by middleware/server)
    return typeof window !== 'undefined' ? (sessionStorage.getItem('belwee_access_token') ?? null) : null;
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((token: string, authUser: AuthUser) => {
    setAccessTokenState(token);
    setUser(authUser);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('belwee_access_token', token);
      sessionStorage.setItem('belwee_user', JSON.stringify(authUser));
    }
  }, []);

  const logout = useCallback(() => {
    setAccessTokenState(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('belwee_access_token');
      sessionStorage.removeItem('belwee_user');
    }
  }, []);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (typeof window !== 'undefined') {
      if (token) sessionStorage.setItem('belwee_access_token', token);
      else sessionStorage.removeItem('belwee_access_token');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    const storedToken = sessionStorage.getItem('belwee_access_token');
    const storedUser = sessionStorage.getItem('belwee_user');
    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setAccessTokenState(storedToken);
      } catch {
        sessionStorage.removeItem('belwee_access_token');
        sessionStorage.removeItem('belwee_user');
      }
    }
    setIsLoading(false);
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!accessToken && !!user,
    login,
    logout,
    setAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
