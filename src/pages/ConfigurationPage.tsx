import { useState } from 'react';
import { Church, Bell, Link2, Shield, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfigGeneral from '@/components/config/ConfigGeneral';
import ConfigNotifications from '@/components/config/ConfigNotifications';
import ConfigIntegrations from '@/components/config/ConfigIntegrations';
import ConfigSecurity from '@/components/config/ConfigSecurity';
import ConfigMaintenance from '@/components/config/ConfigMaintenance';

type ModuleId = 'general' | 'notifications' | 'integrations' | 'security' | 'maintenance';

interface Module {
  id: ModuleId;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  badge?: { label: string; variant: 'red' | 'orange' | 'green' };
}

const modules: Module[] = [
  {
    id: 'general',
    label: 'Général',
    desc: 'Informations de l\'église, horaires, langue',
    icon: Church,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    desc: 'Email SMTP, Push, SMS',
    icon: Bell,
  },
  {
    id: 'integrations',
    label: 'Intégrations',
    desc: 'Google Calendar, Spotify, Backups',
    icon: Link2,
  },
  {
    id: 'security',
    label: 'Sécurité',
    desc: 'Sessions, mots de passe, audit',
    icon: Shield,
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    desc: 'Stats, backups, cache',
    icon: Wrench,
  },
];

const moduleComponents: Record<ModuleId, React.FC> = {
  general: ConfigGeneral,
  notifications: ConfigNotifications,
  integrations: ConfigIntegrations,
  security: ConfigSecurity,
  maintenance: ConfigMaintenance,
};

export default function ConfigurationPage() {
  const [activeModule, setActiveModule] = useState<ModuleId>('general');

  const ActiveComp = moduleComponents[activeModule];
  const activeMod = modules.find(m => m.id === activeModule)!;

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            ⚙️ Configuration Système
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Administration · DSI</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Système opérationnel</span>
        </div>
      </div>

      {/* Layout principal : sidebar + contenu */}
      <div className="flex gap-6 flex-1">
        {/* Sidebar — navigation des modules */}
        {/* Desktop : liste verticale / Mobile : select */}
        <aside className="flex-shrink-0">
          {/* Mobile select */}
          <div className="block sm:hidden mb-4">
            <select
              value={activeModule}
              onChange={e => setActiveModule(e.target.value as ModuleId)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Desktop sidebar */}
          <nav className="hidden sm:flex flex-col gap-1 w-52">
            {modules.map(mod => {
              const isActive = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`
                    relative flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-all w-full group
                    ${isActive
                      ? 'bg-accent/10 border-l-2 border-accent pl-[10px]'
                      : 'border-l-2 border-transparent hover:bg-muted/50'
                    }
                  `}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'} transition-colors`}>
                    <mod.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-foreground'}`}>
                        {mod.label}
                      </span>
                      {mod.badge && (
                        <span className={`
                          flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                          ${mod.badge.variant === 'red' ? 'bg-destructive/15 text-destructive' : ''}
                          ${mod.badge.variant === 'orange' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' : ''}
                          ${mod.badge.variant === 'green' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : ''}
                        `}>
                          {mod.badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{mod.desc}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Zone de contenu */}
        <main className="flex-1 min-w-0">
          {/* Titre du module actif */}
          <div className="flex items-center gap-2 mb-5">
            <activeMod.icon className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{activeMod.label}</h2>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <span className="text-xs text-muted-foreground">{activeMod.desc}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <ActiveComp />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
