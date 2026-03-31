import { useEffect, useState } from 'react';
import { getSettingsByCategory, saveSettingsBulk } from '@/lib/api';
import { Save, Calendar, Music2, Cloud } from 'lucide-react';
import { toast } from 'sonner';

function parseValue(val: any): string {
  if (val === null || val === undefined || val === 'null') return '';
  try { const p = JSON.parse(val); return typeof p === 'string' ? p : String(p); } catch { return String(val); }
}

const INTEGRATIONS = [
  {
    id: 'google', label: 'Google Calendar', icon: Calendar,
    fields: [
      { key: 'google_calendar_enabled', label: 'Activé', type: 'toggle' },
      { key: 'google_client_id', label: 'Client ID', type: 'text' },
      { key: 'google_client_secret', label: 'Client Secret', type: 'password' },
      { key: 'google_calendar_id', label: 'Calendar ID', type: 'text' },
    ],
  },
  {
    id: 'spotify', label: 'Spotify', icon: Music2,
    fields: [
      { key: 'spotify_enabled', label: 'Activé', type: 'toggle' },
      { key: 'spotify_client_id', label: 'Client ID', type: 'text' },
      { key: 'spotify_client_secret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    id: 'backup', label: 'Backup Cloud', icon: Cloud,
    fields: [
      { key: 'backup_auto_enabled', label: 'Backup automatique', type: 'toggle' },
      { key: 'backup_frequency', label: 'Fréquence', type: 'select', options: ['daily', 'weekly', 'monthly'] },
      { key: 'backup_retention_days', label: 'Rétention (jours)', type: 'number' },
    ],
  },
];

export default function ConfigIntegrations() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettingsByCategory('integrations').then((data: any[]) => {
      const v: Record<string, string> = {};
      (data || []).forEach(s => { v[s.key_name] = s.is_encrypted && s.value === '***ENCRYPTED***' ? '' : parseValue(s.value); });
      setValues(v);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const allKeys = INTEGRATIONS.flatMap(i => i.fields.map(f => f.key));
      const settings = allKeys.map(k => ({ category: 'integrations', key: k, value: values[k] || '' }));
      await saveSettingsBulk(settings);
      toast.success('Intégrations sauvegardées');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-5">
      {INTEGRATIONS.map(integ => {
        const enabled = values[`${integ.id}_calendar_enabled`] === 'true' || values[`${integ.id}_enabled`] === 'true' || values[`${integ.id}_auto_enabled`] === 'true';
        return (
          <div key={integ.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <integ.icon className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">{integ.label}</h3>
              <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {enabled ? '🟢 Connecté' : '🔴 Non configuré'}
              </span>
            </div>
            <div className="space-y-3 max-w-md">
              {integ.fields.map(f => (
                <div key={f.key}>
                  {f.type === 'toggle' ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{f.label}</span>
                      <button onClick={() => setValues(p => ({ ...p, [f.key]: p[f.key] === 'true' ? 'false' : 'true' }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${values[f.key] === 'true' ? 'bg-accent' : 'bg-muted'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${values[f.key] === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ) : f.type === 'select' ? (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">{f.label}</label>
                      <select value={values[f.key] || ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                        {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">{f.label}</label>
                      <input type={f.type} value={values[f.key] || ''} placeholder={f.type === 'password' ? '••••••••' : ''}
                        onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
