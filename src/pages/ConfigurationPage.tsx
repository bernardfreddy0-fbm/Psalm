import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@/lib/api';
import { Settings, Save, Mail, Shield, Database, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'info', label: 'Informations', icon: Info },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'backup', label: 'Sauvegardes', icon: Database },
  { id: 'security', label: 'Sécurité', icon: Shield },
];

const INFO_KEYS = [
  { key: 'church_name', label: 'Nom de l\'église', type: 'text' },
  { key: 'church_email', label: 'Email de l\'église', type: 'email' },
  { key: 'cult_time', label: 'Heure du culte', type: 'text' },
  { key: 'cult_day', label: 'Jour du culte', type: 'text' },
  { key: 'verse', label: 'Verset', type: 'text' },
  { key: 'verse_ref', label: 'Référence du verset', type: 'text' },
  { key: 'timezone', label: 'Fuseau horaire', type: 'text' },
];

const EMAIL_KEYS = [
  { key: 'smtp_host', label: 'Serveur SMTP', type: 'text' },
  { key: 'smtp_port', label: 'Port SMTP', type: 'text' },
  { key: 'smtp_user', label: 'Utilisateur SMTP', type: 'text' },
  { key: 'smtp_pass', label: 'Mot de passe SMTP', type: 'password' },
  { key: 'notifications_enabled', label: 'Notifications activées', type: 'toggle' },
];

const BACKUP_KEYS = [
  { key: 'backup_auto_enabled', label: 'Backup automatique', type: 'toggle' },
  { key: 'backup_freq', label: 'Fréquence (jours)', type: 'text' },
  { key: 'backup_retention', label: 'Rétention (jours)', type: 'text' },
];

const SECURITY_KEYS = [
  { key: 'session_timeout', label: 'Timeout session (min)', type: 'text' },
  { key: 'max_attempts', label: 'Tentatives max login', type: 'text' },
  { key: 'pwd_min', label: 'Longueur min mot de passe', type: 'text' },
  { key: 'pwd_special', label: 'Caractères spéciaux requis', type: 'toggle' },
];

const TAB_KEYS: Record<string, { key: string; label: string; type: string }[]> = {
  info: INFO_KEYS,
  email: EMAIL_KEYS,
  backup: BACKUP_KEYS,
  security: SECURITY_KEYS,
};

export default function ConfigurationPage() {
  const [tab, setTab] = useState('info');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSettings().then(setSettings).catch(() => setSettings({})).finally(() => setLoading(false));
  }, []);

  const updateField = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setChanged(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const keys = TAB_KEYS[tab] || [];
    const payload = keys.map(k => ({ key: k.key, value: settings[k.key] || '' }));
    try {
      await saveSettings(payload);
      setChanged(false);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const currentKeys = TAB_KEYS[tab] || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">⚙️ Configuration</h1>
        {changed && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-accent text-accent-foreground' : 'border border-border bg-card text-foreground hover:bg-muted'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Chargement...</p> : (
        <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border border-border p-6">
          <div className="space-y-4 max-w-lg">
            {currentKeys.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-foreground mb-1.5">{field.label}</label>
                {field.type === 'toggle' ? (
                  <button
                    onClick={() => updateField(field.key, settings[field.key] === '1' ? '0' : '1')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      settings[field.key] === '1' ? 'bg-accent' : 'bg-muted'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${
                      settings[field.key] === '1' ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                ) : (
                  <input
                    type={field.type}
                    value={settings[field.key] || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
