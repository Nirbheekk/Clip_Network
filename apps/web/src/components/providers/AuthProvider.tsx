'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiRequest,
  type PlanDef,
  type SaasUser,
  type SaasWorkspace,
} from '@/lib/saas-types';

const TOKEN_STORAGE_KEY = 'clip_network_session_token';
const THEME_STORAGE_KEY = 'clip_network_theme';

export interface ToastNotice {
  id: string;
  tone: 'info' | 'success' | 'error';
  message: string;
}

interface AuthContextValue {
  booting: boolean;
  token: string | null;
  user: SaasUser | null;
  workspace: SaasWorkspace | null;
  workspaceRole: string | null;
  plans: PlanDef[];
  devVerificationToken: string | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  notify: (message: string, tone?: 'info' | 'success' | 'error') => void;
  setSession: (payload: {
    token: string;
    user: SaasUser;
    workspace: SaasWorkspace;
    devVerificationToken?: string;
  }) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SaasUser | null>(null);
  const [workspace, setWorkspace] = useState<SaasWorkspace | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const notify = useCallback((message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    const savedTheme =
      typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const hydrateMe = useCallback(async (authToken: string) => {
    const res = await apiRequest<{
      user: SaasUser;
      workspace: SaasWorkspace;
      workspaceRole: string;
    }>('/api/v1/auth/me', { token: authToken });
    if (!res.ok || !res.json.data) {
      if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setWorkspace(null);
      setWorkspaceRole(null);
      return;
    }
    setUser(res.json.data.user);
    setWorkspace(res.json.data.workspace);
    setWorkspaceRole(res.json.data.workspaceRole);
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      const plansRes = await apiRequest<PlanDef[]>('/api/v1/billing/plans');
      if (active && plansRes.ok && plansRes.json.data) {
        setPlans(plansRes.json.data);
      }
      const savedToken =
        typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (savedToken) {
        if (active) setToken(savedToken);
        await hydrateMe(savedToken);
      }
      if (active) setBooting(false);
    }
    void boot();
    return () => {
      active = false;
    };
  }, [hydrateMe]);

  const setSession = useCallback(
    async (payload: {
      token: string;
      user: SaasUser;
      workspace: SaasWorkspace;
      devVerificationToken?: string;
    }) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      }
      setToken(payload.token);
      setUser(payload.user);
      setWorkspace(payload.workspace);
      if (payload.devVerificationToken) {
        setDevVerificationToken(payload.devVerificationToken);
      }
      await hydrateMe(payload.token);
    },
    [hydrateMe],
  );

  const refreshSession = useCallback(async () => {
    if (token) await hydrateMe(token);
  }, [token, hydrateMe]);

  const logout = useCallback(async () => {
    if (token) {
      await apiRequest('/api/v1/auth/logout', { method: 'POST', token });
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setToken(null);
    setUser(null);
    setWorkspace(null);
    setWorkspaceRole(null);
    setDevVerificationToken(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        booting,
        token,
        user,
        workspace,
        workspaceRole,
        plans,
        devVerificationToken,
        theme,
        toggleTheme,
        notify,
        setSession,
        refreshSession,
        logout,
      }}
    >
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-md border px-3.5 py-2.5 text-xs font-medium shadow-lg backdrop-blur ${
                t.tone === 'error'
                  ? 'border-destructive/60 bg-background text-destructive'
                  : t.tone === 'success'
                    ? 'border-primary/60 bg-background text-foreground'
                    : 'border-border bg-card text-foreground'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
