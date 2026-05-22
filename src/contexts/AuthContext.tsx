import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout, getPermissions } from '@/lib/api';
import { touchActivity, isSessionExpired, clearActivity } from '@/lib/security';

// Vérification session toutes les 5 minutes
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

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
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      const data = await getPermissions();
      setPermissions(data.permissions || {});
    } catch {
      // conserver les permissions précédentes en cas d'erreur
    }
  }, []);

  // Enregistre l'activité utilisateur pour le timeout de session
  const trackActivity = useCallback(() => { touchActivity(); }, []);

  const logout = useCallback(async () => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    clearActivity();
    await apiLogout();
    setUser(null);
    setPermissions({});
  }, []);

  // Session guard — vérifie toutes les SESSION_CHECK_INTERVAL_MS
  const startSessionGuard = useCallback(() => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    sessionCheckRef.current = setInterval(async () => {
      // Timeout d'inactivité
      if (isSessionExpired()) {
        console.info('[Security] Session expirée par inactivité — déconnexion automatique');
        await logout();
        return;
      }
      // Vérification token AEFApi (token révoqué côté serveur)
      try {
        const u = await checkAuth();
        if (!u) {
          console.info('[Security] Session AEFApi invalide — déconnexion automatique');
          await logout();
        }
      } catch {
        await logout();
      }
    }, SESSION_CHECK_INTERVAL_MS);
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await checkAuth();
        setUser(u);
        if (u) {
          await loadPermissions();
          touchActivity();
          startSessionGuard();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Tracker l'activité sur les interactions utilisateur
    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    events.forEach(e => document.addEventListener(e, trackActivity, { passive: true }));

    return () => {
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
      events.forEach(e => document.removeEventListener(e, trackActivity));
    };
  }, [loadPermissions, startSessionGuard, trackActivity]);

  const hasPermission = useCallback((action: string): boolean => {
    if (!user) return false;
    // Vérification stricte du rôle 'dev' (split pour éviter les faux positifs substring)
    const userRoles = (user.role ?? '').split(',').map((r: string) => r.trim()).filter(Boolean);
    if (userRoles.includes('dev')) return true;
    // Permissions effectives calculées côté serveur (source de vérité principale)
    if (Array.isArray(user.effective_permissions) && user.effective_permissions.includes(action)) return true;
    // Fallback : vérification locale via la table permissions chargée en mémoire
    const allowedRoles = permissions[action] || [];
    return userRoles.some(r => allowedRoles.includes(r));
  }, [user, permissions]);

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    touchActivity();
    await loadPermissions();
    startSessionGuard();
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
