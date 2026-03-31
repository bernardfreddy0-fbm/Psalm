import { useState } from 'react';
import { Church, Bell, Link2, Users, Shield, Wrench, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfigGeneral from '@/components/config/ConfigGeneral';
import ConfigNotifications from '@/components/config/ConfigNotifications';
import ConfigIntegrations from '@/components/config/ConfigIntegrations';
import ConfigSecurity from '@/components/config/ConfigSecurity';
import ConfigMaintenance from '@/components/config/ConfigMaintenance';

const modules = [
  { id: 'general', label: 'Général', desc: 'Informations de l\'église, horaires, langue', icon: Church, color: 'bg-primary/10 text-primary' },
  { id: 'notifications', label: 'Notifications', desc: 'Email SMTP, Push, SMS', icon: Bell, color: 'bg-warning/10 text-warning' },
  { id: 'integrations', label: 'Intégrations', desc: 'Google Calendar, Spotify, Backups', icon: Link2, color: 'bg-accent/10 text-accent' },
  { id: 'security', label: 'Sécurité', desc: 'Sessions, mots de passe, IP', icon: Shield, color: 'bg-destructive/10 text-destructive' },
  { id: 'maintenance', label: 'Maintenance', desc: 'Stats, backups, cache', icon: Wrench, color: 'bg-gold/10 text-gold' },
];

const moduleComponents: Record<string, React.FC> = {
  general: ConfigGeneral,
  notifications: ConfigNotifications,
  integrations: ConfigIntegrations,
  security: ConfigSecurity,
  maintenance: ConfigMaintenance,
};

export default function ConfigurationPage() {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  if (activeModule) {
    const Comp = moduleComponents[activeModule];
    const mod = modules.find(m => m.id === activeModule);
    return (
      <div>
        <button onClick={() => setActiveModule(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à la configuration
        </button>
        <h1 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
          {mod && <mod.icon className="w-5 h-5" />} {mod?.label}
        </h1>
        <AnimatePresence mode="wait">
          <motion.div key={activeModule} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Comp />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-foreground mb-5">⚙️ Configuration</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod, i) => (
          <motion.button key={mod.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveModule(mod.id)}
            className="bg-card border border-border rounded-lg p-5 text-left hover:shadow-md hover:border-accent/30 transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${mod.color}`}>
              <mod.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{mod.label}</h3>
            <p className="text-xs text-muted-foreground">{mod.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
