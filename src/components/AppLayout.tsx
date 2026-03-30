import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Calendar, Users, Music, LogOut, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/planning', icon: Calendar, label: 'Planning' },
  { to: '/membres', icon: Users, label: 'Membres' },
  { to: '/chants', icon: Music, label: 'Louange' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] sidebar-gradient flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-11 h-11 rounded-full gold-shimmer flex items-center justify-center shrink-0">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-sidebar-foreground leading-tight">Église AEF</h2>
            <p className="text-[11px] text-sidebar-foreground/40 truncate">Admin Louange</p>
          </div>
          <button className="lg:hidden ml-auto text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="px-4 py-2 text-[10px] text-sidebar-foreground/30 border-t border-sidebar-border">
          <p>📍 10 Rue de la maison rouge</p>
          <p>77185 Lognes</p>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-primary">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
              </p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate capitalize">
                {user?.role?.replace(/_/g, ' ') || 'Membre'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/50 hover:text-destructive transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-4 lg:px-6 bg-card shrink-0">
          <button className="lg:hidden mr-3 text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-display font-semibold text-foreground">Église AEF — Admin Louange</span>
        </header>
        <div className="flex-1 p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </div>
        <footer className="px-4 lg:px-6 py-3 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Église AEF — Fait avec ❤️ pour la gloire de Dieu
          </p>
        </footer>
      </main>
    </div>
  );
}
