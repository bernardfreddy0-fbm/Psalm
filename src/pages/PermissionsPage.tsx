import { useEffect, useState } from 'react';
import { getPermissions, savePermissions } from '@/lib/api';
import { Shield, Save, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const PERM_ROLES = [
  { role: 'pasteur', label: 'Pasteur', level: 1, color: 'bg-destructive' },
  { role: 'responsable_louange', label: 'Resp. Louange', level: 2, color: 'bg-accent' },
  { role: 'conducteur_louange', label: 'Conducteur', level: 3, color: 'bg-accent' },
  { role: 'responsable_technique', label: 'Resp. Technique', level: 4, color: 'bg-info' },
  { role: 'choriste', label: 'Choriste', level: 5, color: 'bg-success' },
  { role: 'musicien', label: 'Musicien', level: 6, color: 'bg-gold' },
  { role: 'sonorisateur', label: 'Sonorisateur', level: 7, color: 'bg-info' },
  { role: 'projectionniste', label: 'Projectionniste', level: 8, color: 'bg-warning' },
  { role: 'videaste', label: 'Vidéaste', level: 9, color: 'bg-purple-500' },
  { role: 'dev', label: 'Dev', level: 0, color: 'bg-foreground' },
];

const PERM_ACTIONS = [
  { group: 'Planning', actions: ['planning_view', 'planning_edit', 'planning_approve'] },
  { group: 'Membres', actions: ['members_view', 'members_edit', 'members_delete'] },
  { group: 'Chants', actions: ['songs_view', 'songs_edit', 'songs_delete'] },
  { group: 'Config', actions: ['config_view', 'config_edit'] },
  { group: 'Comptes', actions: ['accounts_view', 'accounts_edit', 'accounts_delete'] },
  { group: 'Permissions', actions: ['permissions_view', 'permissions_edit'] },
  { group: 'Backup', actions: ['backup_create', 'backup_restore'] },
];

const allActions = PERM_ACTIONS.flatMap(g => g.actions);
const actionLabel = (a: string) => a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPermissions().then(data => {
      // API returns {action→[roles]}, we need {role→[actions]}
      const perms = data.permissions || {};
      const roleMap: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { roleMap[r.role] = []; });
      Object.entries(perms).forEach(([action, roles]) => {
        (roles as string[]).forEach(role => {
          if (roleMap[role]) roleMap[role].push(action);
        });
      });
      setMatrix(roleMap);
    }).catch(() => {
      // Defaults
      const defaults: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { defaults[r.role] = r.level <= 2 ? [...allActions] : []; });
      setMatrix(defaults);
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, action: string) => {
    setMatrix(prev => {
      const actions = prev[role] || [];
      const next = actions.includes(action) ? actions.filter(a => a !== action) : [...actions, action];
      return { ...prev, [role]: next };
    });
    setChanged(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // Convert {role→[actions]} back to {action→[roles]}
    const actionMap: Record<string, string[]> = {};
    allActions.forEach(a => { actionMap[a] = []; });
    Object.entries(matrix).forEach(([role, actions]) => {
      actions.forEach(a => { if (actionMap[a]) actionMap[a].push(role); });
    });
    try {
      await savePermissions(actionMap);
      setChanged(false);
    } catch (e) {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔑 Permissions</h1>
        <div className="flex gap-2">
          {changed && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Hiérarchie des rôles</p>
        <div className="flex flex-wrap gap-2">
          {PERM_ROLES.map(r => (
            <span key={r.role} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-card ${r.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
              {r.label} (Niv.{r.level})
            </span>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left px-3 py-2 sticky left-0 bg-primary z-10 min-w-[140px]">Action</th>
              {PERM_ROLES.map(r => (
                <th key={r.role} className="px-2 py-2 text-center whitespace-nowrap">
                  <span className="block text-[10px]">{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_ACTIONS.map(group => (
              <>
                <tr key={group.group}>
                  <td colSpan={PERM_ROLES.length + 1} className="px-3 py-1.5 bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {group.group}
                  </td>
                </tr>
                {group.actions.map(action => (
                  <tr key={action} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10 text-foreground font-medium">{actionLabel(action)}</td>
                    {PERM_ROLES.map(r => {
                      const checked = (matrix[r.role] || []).includes(action);
                      return (
                        <td key={r.role} className="text-center px-2 py-2">
                          <button
                            onClick={() => toggle(r.role, action)}
                            className={`w-6 h-6 rounded border-2 transition-all ${
                              checked ? `${r.color} border-transparent text-card` : 'border-border bg-card hover:border-accent/50'
                            } flex items-center justify-center mx-auto`}
                          >
                            {checked && <span className="text-[10px] font-bold">✓</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
