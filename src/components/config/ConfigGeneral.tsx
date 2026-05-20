import { useEffect, useState } from 'react';
import { getSettingsByCategory, saveSettingsBulk } from '@/lib/api';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'church_name', label: 'Nom de l\'église', type: 'text' },
  { key: 'church_email', label: 'Email de contact', type: 'email' },
  { key: 'church_address', label: 'Adresse', type: 'text' },
  { key: 'church_phone', label: 'Téléphone', type: 'tel' },
  { key: 'timezone', label: 'Fuseau horaire', type: 'select', options: ['Europe/Paris', 'Europe/London', 'America/New_York', 'Africa/Douala'] },
  { key: 'default_language', label: 'Langue', type: 'select', options: ['fr', 'en'], optionLabels: { fr: 'Français', en: 'English' } },
  { key: 'cult_day', label: 'Jour du culte', type: 'select', options: ['sunday', 'saturday', 'friday'], optionLabels: { sunday: 'Dimanche', saturday: 'Samedi', friday: 'Vendredi' } },
  { key: 'cult_time', label: 'Heure du culte', type: 'time' },
  { key: 'cult_duration', label: 'Durée (min)', type: 'number' },
];

const FEATURE_TOGGLES = [
  { key: 'planning_enabled', label: 'Module Planning' },
  { key: 'songs_library_enabled', label: 'Bibliothèque de chants' },
  { key: 'notifications_enabled', label: 'Notifications' },
  { key: 'export_pdf_enabled', label: 'Export PDF' },
  { key: 'export_ical_enabled', label: 'Export iCal' },
  { key: 'dev_space_enabled', label: 'Espace DEV' },
  { key: 'maintenance_mode', label: 'Mode maintenance', category: 'general' },
];

function parseValue(val: any): string {
  if (val === null || val === undefined) return '';
  try { const p = JSON.parse(val); return typeof p === 'string' ? p : String(p); } catch { return String(val); }
}

export default function ConfigGeneral() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getSettingsByCategory('general'),
      getSettingsByCategory('features'),
    ]).then(([gen, feat]) => {
      const v: Record<string, string> = {};
      (gen || []).forEach((s: any) => { v[s.key_name] = parseValue(s.value); });
      setValues(v);
      const f: Record<string, boolean> = {};
      (feat || []).forEach((s: any) => { f[s.key_name] = parseValue(s.value) === 'true'; });
      setFeatures(f);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = [
        ...FIELDS.map(f => ({ category: 'general', key: f.key, value: values[f.key] || '' })),
        ...FEATURE_TOGGLES.map(f => ({ category: f.category || 'features', key: f.key, value: features[f.key] ? 'true' : 'false' })),
      ];
      await saveSettingsBulk(settings);
      toast.success('Paramètres sauvegardés');
    } catch { toast.error('Erreur de sauvegarde'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* General fields */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Informations de l'église</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-foreground mb-1.5">{f.label}</label>
              {f.type === 'select' ? (
                <select value={values[f.key] || ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  {f.options?.map(o => <option key={o} value={o}>{(f as any).optionLabels?.[o] ?? o}</option>)}
                </select>
              ) : (
                <input type={f.type} value={values[f.key] || ''}
                  onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Feature toggles */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Fonctionnalités</h2>
        <div className="space-y-3 max-w-lg">
          {FEATURE_TOGGLES.map(f => (
            <div key={f.key} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{f.label}</span>
              <button onClick={() => setFeatures(p => ({ ...p, [f.key]: !p[f.key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${features[f.key] ? 'bg-accent' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${features[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
