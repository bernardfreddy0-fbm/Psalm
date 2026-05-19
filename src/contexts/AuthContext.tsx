import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout, getPermissions } from '@/lib/api';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  permissions: Record<string, string[]>;
  hasPermission: (action: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  permissions: {},
  hasPermission: () => false,
  login: async () => { throw new Error('Auth context unavailable'); },
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  const loadPermissions = useCallback(async () => {
    try {
      const data = await getPermissions();
      setPermissions(data.permissions || {});
    } catch {
      // conserver les permissions précédentes en cas d'erreur
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await checkAuth();
        setUser(u);
        if (u) await loadPermissions();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadPermissions]);

  const hasPermission = useCallback((action: string): boolean => {
    if (!user) return false;
    // dev a toujours accès à tout
    if (user.role === 'dev' || user.role?.includes('dev')) return true;
    const allowedRoles = permissions[action] || [];
    return user.role?.split(',').some((r: string) => allowedRoles.includes(r.trim())) ?? false;
  }, [user, permissions]);

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    await loadPermissions();
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setPermissions({});
  };

  return (
    <AuthContext.Provider value={{ user, loading, permissions, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
