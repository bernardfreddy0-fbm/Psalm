import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, FileText, CalendarRange, Church, Users, Repeat,
  Music, LogOut, Menu, X, Settings, Shield, Key, UserCog
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const navSections = [
  {
    label: 'PRINCIPAL',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/programme', icon: FileText, label: 'Programme du culte' },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      { to: '/evenements', icon: CalendarRange, label: 'Événements' },
      { to: '/cultes', icon: Church, label: 'Cultes' },
    ],
  },
  {
    label: 'ÉQUIPES',
    items: [
      { to: '/membres', icon: Users, label: 'Membres', sub: ['Tous les membres', 'Ajouter un membre'] },
      { to: '/rotations', icon: Repeat, label: 'Rotations' },
    ],
  },
  {
    label: 'LOUANGE',
    items: [
      { to: '/chants', icon: Music, label: 'Bibliothèque', badge: '192', sub: ['Tous les chants', 'Ajouter un chant'] },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { to: '/comptes', icon: UserCog, label: 'Comptes' },
      { to: '/permissions', icon: Key, label: 'Permissions' },
      { to: '/configuration', icon: Settings, label: 'Configuration' },
    ],
  },
];

// Page subtitle mapping
const pageTitles: Record<string, string> = {
  '/': 'Espace Gestionnaire',
  '/membres': 'Membres',
  '/chants': 'Bibliothèque de Chants',
  '/cultes': 'Planning Louange',
  '/evenements': 'Événements',
  '/programme': 'Programme du culte',
  '/rotations': 'Rotations & Participation',
  '/comptes': 'Gestion des comptes',
  '/permissions': 'Permissions',
  '/configuration': 'Configuration',
  '/admin': 'Administration',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const subtitle = pageTitles[location.pathname] || '';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[240px] sidebar-gradient flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-sidebar-foreground">Église AEF</h2>
            <p className="text-[11px] text-sidebar-muted">{subtitle}</p>
          </div>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navSections.map(section => (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-sidebar-muted uppercase">
                {section.label}
              </p>
              {section.items.map(item => {
                const isActive = location.pathname === item.to;
                return (
                  <div key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {'badge' in item && item.badge && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                    {'sub' in item && item.sub && isActive && (
                      <div className="ml-9 mt-0.5 space-y-0.5">
                        {item.sub.map(s => (
                          <p key={s} className="text-[12px] text-sidebar-foreground/50 py-1 cursor-pointer hover:text-sidebar-foreground/80">
                            · {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-[11px] font-bold text-sidebar-foreground">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
              </p>
              <p className="text-[10px] text-sidebar-muted truncate capitalize">
                {user?.role?.replace(/_/g, ' ') || 'Membre'}
              </p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-[12px] text-sidebar-muted hover:text-destructive transition-colors w-full">
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 border-b border-border flex items-center px-4 lg:px-6 bg-card shrink-0">
          <button className="lg:hidden mr-3 text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 p-4 lg:p-6 animate-fade-in overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
