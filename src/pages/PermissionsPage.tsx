import React, { useEffect, useState } from 'react';
import { getPermissions, savePermissions } from '@/lib/api';
import { Save, RotateCcw, Info } from 'lucide-react';

// Rôles réels présents en base de données
const PERM_ROLES = [
  { role: 'dev',                       label: 'Développeur',          level: 0, color: 'bg-zinc-700' },
  { role: 'pasteur',                   label: 'Pasteur',              level: 1, color: 'bg-red-600' },
  { role: 'responsable_louange',       label: 'Resp. Louange',        level: 2, color: 'bg-blue-600' },
  { role: 'responsable_video',         label: 'Resp. Vidéo (AEFV)',   level: 2, color: 'bg-rose-600' },
  { role: 'referent_planning_video',   label: 'Réf. Planning AEFV',   level: 2, color: 'bg-red-500' },
  { role: 'referent_technique_video',  label: 'Réf. Technique AEFV',  level: 2, color: 'bg-orange-600' },
  { role: 'choriste',                  label: 'Choriste',             level: 3, color: 'bg-amber-500' },
  { role: 'bassiste',                  label: 'Bassiste',             level: 3, color: 'bg-emerald-600' },
  { role: 'batteur',                   label: 'Batteur',              level: 3, color: 'bg-cyan-600' },
  { role: 'guitariste_electrique',     label: 'Guitariste élec.',     level: 3, color: 'bg-violet-600' },
  { role: 'guitariste_acoustique',     label: 'Guitariste acou.',     level: 3, color: 'bg-purple-600' },
  { role: 'pianiste',                  label: 'Pianiste',             level: 3, color: 'bg-pink-600' },
  { role: 'sonorisateur',              label: 'Sonorisateur',         level: 4, color: 'bg-orange-500' },
  { role: 'projectionniste',           label: 'Projectionniste',      level: 4, color: 'bg-teal-600' },
  { role: 'videaste',                  label: 'Vidéaste',             level: 4, color: 'bg-indigo-500' },
];

const PERM_ACTIONS = [
  { group: '📅 Planning', actions: ['planning_view', 'planning_edit'] },
  { group: '👥 Membres',  actions: ['members_view', 'members_manage'] },
  { group: '🎼 Chants',   actions: ['songs_view', 'songs_manage'] },
  { group: '🎬 AEFV', actions: ['archives_view', 'archives_edit', 'video_planning_edit'] },
  { group: '📄 Exports',  actions: ['exports_pdf'] },
  { group: '⚙️ Administration', actions: ['config_view', 'config_edit', 'dev_access'] },
];

const ACTION_LABELS: Record<string, string> = {
  planning_view:  'Voir le planning d\'équipe',
  planning_edit:  'Modifier le planning',
  members_view:   'Voir la liste des membres',
  members_manage: 'Gérer les membres',
  songs_view:     'Accès bibliothèque de chants',
  songs_manage:   'Gérer les chants',
  archives_view:        'Voir AEFV',
  archives_edit:        'Gérer fiches AEFV',
  video_planning_edit:  'Planning vidéo mensuel',
  exports_pdf:    'Exporter en PDF',
  config_view:    'Section Prédication (espace membre)',
  config_edit:    'Modifier la configuration',
  dev_access:     'Accès développeur',
};

const ACTION_DESC: Record<string, string> = {
  planning_view:   'Onglet "Vue équipe" dans Mon Planning (espace membre)',
  planning_edit:   'Page "Gestion planning" + bouton Modifier dans l\'espace membre',
  members_view:    'Accès à la liste des membres (espace admin)',
  members_manage:  'Ajout / suppression de membres (espace admin)',
  songs_view:      'Module Bibliothèque de chants dans l\'espace membre',
  songs_manage:    'Ajout / modification de chants (espace admin)',
  archives_view:        'Accès au module AEFV (responsable_video, referent_planning_video, referent_technique_video, videaste)',
  archives_edit:        'Saisie et modification des fiches vidéo (métadonnées, checklist, statut)',
  video_planning_edit:  'Gérer qui filme quel dimanche (responsable_video, referent_planning_video)',
  exports_pdf:     'Export PDF du planning (espace admin)',
  config_view:     'Module Prédication dans l\'espace membre',
  config_edit:     'Modification des paramètres système (espace admin)',
  dev_access:      'Accès complet en mode développeur',
};

const allActions = PERM_ACTIONS.flatMap(g => g.actions);

export default function PermissionsPage() {
  // matrix: { role → [actions] }
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadPermissions = () => {
    setLoading(true);
    getPermissions().then(data => {
      // API returns { action → [roles] }, convert to { role → [actions] }
      const perms = data.permissions || {};
      const roleMap: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { roleMap[r.role] = []; });
      Object.entries(perms).forEach(([action, roles]) => {
        (roles as string[]).forEach(role => {
          if (roleMap[role] !== undefined) roleMap[role].push(action);
        });
      });
      setMatrix(roleMap);
      setChanged(false);
    }).catch(() => {
      const defaults: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { defaults[r.role] = r.level <= 2 ? [...allActions] : []; });
      setMatrix(defaults);
      setChanged(false);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const toggle = (role: string, action: string) => {
    setMatrix(prev => {
      const actions = prev[role] || [];
      const next = actions.includes(action)
        ? actions.filter(a => a !== action)
        : [...actions, action];
      return { ...prev, [role]: next };
    });
    setChanged(true);
    setSavedOk(false);
  };

  const toggleAll = (action: string, value: boolean) => {
    setMatrix(prev => {
      const updated = { ...prev };
      PERM_ROLES.forEach(r => {
        const actions = updated[r.role] || [];
        if (value && !actions.includes(action)) updated[r.role] = [...actions, action];
        if (!value) updated[r.role] = actions.filter(a => a !== action);
      });
      return updated;
    });
    setChanged(true);
    setSavedOk(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Convert { role → [actions] } → { action → [roles] }
    const actionMap: Record<string, string[]> = {};
    allActions.forEach(a => { actionMap[a] = []; });
    Object.entries(matrix).forEach(([role, actions]) => {
      actions.forEach(a => { if (actionMap[a]) actionMap[a].push(role); });
    });
    try {
      setSaveError(null);
      await savePermissions(actionMap);
      setChanged(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 4000);
    } catch (e: any) {
      const msg = e?.message || 'Erreur inconnue';
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 8000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Chargement des permissions...
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">🔑 Permissions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurez les droits d'accès de chaque rôle — {PERM_ROLES.length} rôles · {allActions.length} actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedOk && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg">
              ✓ Permissions sauvegardées
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-lg max-w-xs truncate" title={saveError}>
              ✗ {saveError}
            </span>
          )}
          {changed && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl mb-5 text-xs text-blue-700 dark:text-blue-300">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Les modifications sont appliquées en temps réel dans l'espace membre (rafraîchissement automatique toutes les 5 minutes).
          Les rôles ci-dessous correspondent aux rôles réels assignés aux membres en base de données.
        </p>
      </div>

      {/* Matrix table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="text-left px-4 py-3 sticky left-0 bg-muted/60 z-10 min-w-[200px] font-semibold text-foreground">
                Permission
              </th>
              {PERM_ROLES.map(r => (
                <th key={r.role} className="px-3 py-3 text-center min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${r.color}`} />
                    <span className="font-semibold text-foreground text-[10px] leading-tight whitespace-nowrap">{r.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_ACTIONS.map(group => (
              <React.Fragment key={group.group}>
                {/* Group header */}
                <tr className="bg-muted/30">
                  <td colSpan={PERM_ROLES.length + 1} className="px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-y border-border">
                    {group.group}
                  </td>
                </tr>

                {group.actions.map(action => {
                  const allChecked = PERM_ROLES.every(r => (matrix[r.role] || []).includes(action));
                  const noneChecked = PERM_ROLES.every(r => !(matrix[r.role] || []).includes(action));

                  return (
                    <tr key={action} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-card z-10">
                        <p className="font-medium text-foreground">{ACTION_LABELS[action]}</p>
                        {ACTION_DESC[action] && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{ACTION_DESC[action]}</p>
                        )}
                      </td>

                      {PERM_ROLES.map(r => {
                        const checked = (matrix[r.role] || []).includes(action);
                        return (
                          <td key={r.role} className="text-center px-3 py-3">
                            <button
                              onClick={() => toggle(r.role, action)}
                              title={`${checked ? 'Retirer' : 'Accorder'} "${ACTION_LABELS[action]}" à ${r.label}`}
                              className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center mx-auto ${
                                checked
                                  ? `${r.color} border-transparent text-white`
                                  : 'border-border bg-background hover:border-primary/50'
                              }`}
                            >
                              {checked && <span className="text-[10px] font-bold leading-none">✓</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role legend */}
      <div className="mt-5 bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Rôles définis</p>
        <div className="flex flex-wrap gap-2">
          {PERM_ROLES.map(r => (
            <div key={r.role} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs">
              <span className={`w-2 h-2 rounded-full ${r.color}`} />
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground font-mono text-[10px]">{r.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unsaved changes warning */}
      {changed && (
        <div className="mt-4 flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠ Modifications non sauvegardées</p>
          <div className="flex gap-2">
            <button onClick={loadPermissions} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw size={12}/> Annuler
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
              <Save size={12}/> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
