import { useEffect, useState } from 'react';
import { getSettingsByCategory, saveSettingsBulk } from '@/lib/api';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['pasteur', 'responsable_louange', 'responsable_technique', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste'];
const ACTIONS = [
  'planning_view', 'planning_edit', 'members_view', 'members_create', 'members_edit', 'members_delete',
  'songs_view', 'songs_edit', 'exports_view', 'exports_all', 'config_view', 'config_edit', 'dev_access',
];

function parseMatrix(data: any[]): Record<string, string[]> {
  const item = data?.find((s: any) => s.key_name === 'matrix');
  if (!item) return {};
  try {
    const val = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
    return typeof val === 'object' ? val : {};
  } catch { return {}; }
}

export default function ConfigTeams() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettingsByCategory('permissions').then(data => {
      setMatrix(parseMatrix(data));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, action: string) => {
    setMatrix(prev => {
      const perms = prev[role] || [];
      if (role === 'pasteur') return prev; // pasteur always has *
      const has = perms.includes(action) || perms.includes('*');
      return { ...prev, [role]: has ? perms.filter(a => a !== action) : [...perms, action] };
    });
  };

  const hasPermission = (role: string, action: string) => {
    const perms = matrix[role] || [];
    return perms.includes('*') || perms.includes(action);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettingsBulk([{ category: 'permissions', key: 'matrix', value: JSON.stringify(matrix) }]);
      toast.success('Permissions sauvegardées');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-foreground sticky left-0 bg-card z-10">Action</th>
              {ROLES.map(r => (
                <th key={r} className="p-2 font-medium text-foreground text-center whitespace-nowrap">
                  {r.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map(action => (
              <tr key={action} className="border-b border-border hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground sticky left-0 bg-card">{action.replace(/_/g, ' ')}</td>
                {ROLES.map(role => (
                  <td key={role} className="p-2 text-center">
                    <button onClick={() => toggle(role, action)}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        hasPermission(role, action)
                          ? 'bg-accent text-accent-foreground'
                          : 'border border-border hover:bg-muted'
                      }`}>
                      {hasPermission(role, action) && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
