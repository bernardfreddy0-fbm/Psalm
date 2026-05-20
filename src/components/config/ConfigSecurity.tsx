import { useEffect, useState } from 'react';
import { getSettingsByCategory, saveSettingsBulk } from '@/lib/api';
import { Save, Lock, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';

function parseValue(val: any): string {
  if (val === null || val === undefined || val === 'null') return '';
  try { const p = JSON.parse(val); return typeof p === 'string' ? p : String(p); } catch { return String(val); }
}

const FIELDS = [
  { key: 'session_timeout', label: 'Délai d\'expiration session (minutes)', type: 'number', icon: Clock },
  { key: 'max_login_attempts', label: 'Tentatives max de connexion', type: 'number', icon: Lock },
  { key: 'password_min_length', label: 'Longueur min mot de passe', type: 'number', icon: Lock },
  { key: 'password_require_special', label: 'Caractères spéciaux requis', type: 'toggle' },
  { key: 'ip_whitelist_enabled', label: 'Restriction par IP', type: 'toggle' },
  { key: 'audit_log_enabled', label: 'Journal d\'activité', type: 'toggle' },
  { key: 'audit_log_retention_days', label: 'Rétention journaux (jours)', type: 'number', icon: Clock },
];

export default function ConfigSecurity() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ipList, setIpList] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettingsByCategory('security').then((data: any[]) => {
      const v: Record<string, string> = {};
      (data || []).forEach(s => {
        if (s.key_name === 'ip_whitelist') {
          try { setIpList(JSON.parse(s.value)?.join('\n') || ''); } catch { setIpList(''); }
        } else {
          v[s.key_name] = parseValue(s.value);
        }
      });
      setValues(v);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = FIELDS.map(f => ({
        category: 'security', key: f.key,
        value: f.type === 'toggle' ? (values[f.key] === 'true' ? 'true' : 'false') : (values[f.key] || ''),
      }));
      settings.push({ category: 'security', key: 'ip_whitelist', value: JSON.stringify(ipList.split('\n').filter(Boolean)) });
      await saveSettingsBulk(settings);
      toast.success('Sécurité sauvegardée');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Politique de sécurité
        </h2>
        <div className="space-y-4 max-w-md">
          {FIELDS.map(f => (
            <div key={f.key}>
              {f.type === 'toggle' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{f.label}</span>
                  <button onClick={() => setValues(p => ({ ...p, [f.key]: p[f.key] === 'true' ? 'false' : 'true' }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${values[f.key] === 'true' ? 'bg-accent' : 'bg-muted'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${values[f.key] === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-medium text-foreground mb-1">{f.label}</label>
                  <input type={f.type} value={values[f.key] || ''}
                    onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {values.ip_whitelist_enabled === 'true' && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" /> IPs autorisées
          </h2>
          <textarea value={ipList} onChange={e => setIpList(e.target.value)} rows={5} placeholder="Une IP par ligne (ex: 192.168.1.0/24)"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent max-w-md" />
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
