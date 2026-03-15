import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { postData } from '@/lib/api';
import type { AuthToken, Role } from '@/lib/types';

interface AuthContextType {
  token: string | null;
  role: Role | null;
  login: (username: string, password: string) => Promise<Role>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [role, setRole] = useState<Role | null>(() => (localStorage.getItem('role') as Role | null) || null);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      role,
      login: async (username, password) => {
        const payload = await postData<AuthToken>('/api/auth/login', { username, password });
        setToken(payload.access_token);
        setRole(payload.role);
        localStorage.setItem('token', payload.access_token);
        localStorage.setItem('role', payload.role);
        return payload.role;
      },
      logout: () => {
        setToken(null);
        setRole(null);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
      },
    }),
    [role, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return ctx;
}
