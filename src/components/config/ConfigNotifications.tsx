import { useEffect, useState } from 'react';
import { getSettingsByCategory, saveSettingsBulk } from '@/lib/api';
import { Save, Mail, Bell, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

function parseValue(val: any): string {
  if (val === null || val === undefined || val === 'null') return '';
  try { const p = JSON.parse(val); return typeof p === 'string' ? p : String(p); } catch { return String(val); }
}

const CHANNELS = [
  {
    id: 'email', label: 'Email SMTP', icon: Mail,
    fields: [
      { key: 'email_enabled', label: 'Activé', type: 'toggle' },
      { key: 'email_smtp_host', label: 'Serveur SMTP', type: 'text' },
      { key: 'email_smtp_port', label: 'Port', type: 'text' },
      { key: 'email_smtp_user', label: 'Utilisateur', type: 'text' },
      { key: 'email_smtp_pass', label: 'Mot de passe', type: 'password', encrypted: true },
    ],
  },
  {
    id: 'push', label: 'Push Web', icon: Bell,
    fields: [
      { key: 'push_enabled', label: 'Activé', type: 'toggle' },
      { key: 'push_vapid_public', label: 'Clé publique VAPID', type: 'text' },
      { key: 'push_vapid_private', label: 'Clé privée VAPID', type: 'password', encrypted: true },
    ],
  },
  {
    id: 'sms', label: 'SMS Twilio', icon: MessageSquare,
    fields: [
      { key: 'sms_enabled', label: 'Activé', type: 'toggle' },
      { key: 'sms_twilio_sid', label: 'Account SID', type: 'text' },
      { key: 'sms_twilio_token', label: 'Auth Token', type: 'password', encrypted: true },
      { key: 'sms_twilio_from', label: 'Numéro expéditeur', type: 'tel' },
    ],
  },
];

export default function ConfigNotifications() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettingsByCategory('notifications').then((data: any[]) => {
      const v: Record<string, string> = {};
      (data || []).forEach(s => { v[s.key_name] = s.is_encrypted && s.value === '***ENCRYPTED***' ? '' : parseValue(s.value); });
      setValues(v);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const allKeys = CHANNELS.flatMap(c => c.fields.map(f => f.key));
      const settings = allKeys.map(k => ({ category: 'notifications', key: k, value: values[k] || '' }));
      await saveSettingsBulk(settings);
      toast.success('Notifications sauvegardées');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-5">
      {CHANNELS.map(ch => {
        const enabled = values[`${ch.id}_enabled`] === 'true';
        return (
          <div key={ch.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <ch.icon className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">{ch.label}</h3>
              <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {enabled ? '🟢 Configuré' : '🔴 Désactivé'}
              </span>
            </div>
            <div className="space-y-3 max-w-md">
              {ch.fields.map(f => (
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
                      <input type={f.type} value={values[f.key] || ''} placeholder={f.encrypted ? '••••••••' : ''}
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
