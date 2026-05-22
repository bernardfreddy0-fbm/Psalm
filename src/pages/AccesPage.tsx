import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllAccounts, updateMember, createMember,
  resetMemberPassword, getPermissions, savePermissions,
  getMemberPermissions, setMemberPermissions, setMemberProtected,
  type MemberPermissions,
} from '@/lib/api';
import { generateSecurePassword } from '@/lib/security';
import {
  Search, Shield, ShieldCheck, ShieldOff, Key, Plus, Copy, Eye, EyeOff,
  UserCog, Phone, Mail, Calendar,
  RefreshCw, Edit2, Lock, Unlock, Check, X, Save,
  RotateCcw, ChevronRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constantes (communes Comptes + Permissions) ───────────────────────────────

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  responsable_louange: 'conducteur_louange',
};
function normalizeRole(r: string) { return LEGACY_ROLE_ALIASES[r] || r; }
function parseRoles(role: string): string[] {
  if (!role) return [];
  return [...new Set(role.split(',').map(r => normalizeRole(r.trim())).filter(Boolean))];
}
function isActive(u: Account) { return String(u.is_active ?? '1') !== '0'; }
function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function getInitials(u: Account) {
  return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}

const ROLES = [
  'conducteur_louange','responsable_technique','pasteur','choriste',
  'pianiste','batteur','guitariste_electrique','guitariste_acoustique',
  'bassiste','sonorisateur','projectionniste','videaste','dev',
];
const ROLE_LABELS: Record<string, string> = {
  conducteur_louange: 'Cond. Louange', responsable_louange: 'Cond. Louange',
  responsable_technique: 'Resp. Technique', pasteur: 'Pasteur',
  choriste: 'Choriste', pianiste: 'Pianiste', batteur: 'Batteur',
  guitariste_electrique: 'Guit. Élec', guitariste_acoustique: 'Guit. Acou',
  bassiste: 'Bassiste', sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste', videaste: 'Vidéaste', dev: 'Dev',
};
const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-red-600/10 text-red-600 border-red-600/20',
  conducteur_louange: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
  responsable_technique: 'bg-cyan-600/10 text-cyan-600 border-cyan-600/20',
  choriste: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  pianiste: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  batteur: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  guitariste_electrique: 'bg-violet-600/10 text-violet-600 border-violet-600/20',
  guitariste_acoustique: 'bg-purple-600/10 text-purple-600 border-purple-600/20',
  bassiste: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20',
  sonorisateur: 'bg-teal-600/10 text-teal-600 border-teal-600/20',
  projectionniste: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  videaste: 'bg-sky-600/10 text-sky-600 border-sky-600/20',
  dev: 'bg-zinc-700/10 text-zinc-500 border-zinc-600/20',
};

const PERM_ROLES = [
  { role: 'pasteur',               label: 'Pasteur',           color: 'bg-red-600' },
  { role: 'responsable_louange',   label: 'Resp. Louange',     color: 'bg-blue-600' },
  { role: 'choriste',              label: 'Choriste',          color: 'bg-amber-500' },
  { role: 'bassiste',              label: 'Bassiste',          color: 'bg-emerald-600' },
  { role: 'batteur',               label: 'Batteur',           color: 'bg-cyan-600' },
  { role: 'guitariste_electrique', label: 'Guitariste élec.',  color: 'bg-violet-600' },
  { role: 'guitariste_acoustique', label: 'Guitariste acou.',  color: 'bg-purple-600' },
  { role: 'pianiste',              label: 'Pianiste',          color: 'bg-pink-600' },
  { role: 'sonorisateur',          label: 'Sonorisateur',      color: 'bg-orange-500' },
  { role: 'projectionniste',       label: 'Projectionniste',   color: 'bg-teal-600' },
  { role: 'videaste',              label: 'Vidéaste',          color: 'bg-indigo-500' },
  { role: 'dev',                   label: 'Développeur',       color: 'bg-zinc-700' },
];
const PERM_ACTIONS = [
  { group: '📅 Planning', actions: ['planning_view', 'planning_edit'] },
  { group: '👥 Membres',  actions: ['members_view', 'members_manage'] },
  { group: '🎼 Chants',   actions: ['songs_view', 'songs_manage'] },
  { group: '🎬 Archives', actions: ['archives_view', 'archives_edit'] },
  { group: '📄 Exports',  actions: ['exports_pdf'] },
  { group: '⚙️ Administration', actions: ['config_view', 'config_edit', 'dev_access'] },
];
const ACTION_LABELS: Record<string, string> = {
  planning_view: 'Voir le planning', planning_edit: 'Modifier le planning',
  members_view: 'Voir les membres', members_manage: 'Gérer les membres',
  songs_view: 'Bibliothèque chants', songs_manage: 'Gérer les chants',
  archives_view: 'Voir les archives', archives_edit: 'Gérer les archives',
  exports_pdf: 'Export PDF',
  config_view: 'Voir la config', config_edit: 'Modifier la config', dev_access: 'Accès dev',
};
const allActions = PERM_ACTIONS.flatMap(g => g.actions);

// ── Types ─────────────────────────────────────────────────────────────────────

type Account = {
  id: string; first_name: string; last_name: string; email: string;
  phone?: string; role: string; is_active?: string | number | boolean;
  is_protected?: boolean;
  instrument?: string; created_at?: string; updated_at?: string;
};

type Tab = 'membres' | 'permissions';

// ── Helpers UI ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Avatar({ user, size = 'md' }: { user: Account; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  const active = isActive(user);
  return (
    <div className={`${s} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}>
      {getInitials(user)}
    </div>
  );
}

// ── Modale création ───────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'choriste', phone: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMember({ first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role, phone: form.phone });
      toast.success('Membre créé');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nouveau membre</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-muted-foreground space-y-1">
            <span>Prénom *</span>
            <input value={form.first_name} onChange={set('first_name')} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground space-y-1">
            <span>Nom *</span>
            <input value={form.last_name} onChange={set('last_name')} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
          </label>
        </div>
        <label className="text-xs font-medium text-muted-foreground space-y-1 block">
          <span>Email *</span>
          <input type="email" value={form.email} onChange={set('email')} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </label>
        <label className="text-xs font-medium text-muted-foreground space-y-1 block">
          <span>Téléphone</span>
          <input value={form.phone} onChange={set('phone')} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </label>
        <label className="text-xs font-medium text-muted-foreground space-y-1 block">
          <span>Rôle *</span>
          <select value={form.role} onChange={set('role')} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border bg-card">Annuler</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-50">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Panneau latéral — fiche membre ────────────────────────────────────────────

function MemberDetail({
  user,
  matrix,
  currentUserRole,
  onClose,
  onUpdated,
}: {
  user: Account;
  matrix: Record<string, string[]>;
  currentUserRole: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone ?? '', role: user.role });
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => parseRoles(user.role));
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);

  // ── Permissions directes par membre (style Active Directory) ──────────────
  const { data: memberPerms, isLoading: permsLoading, refetch: refetchPerms } = useQuery<MemberPermissions>({
    queryKey: ['member-permissions', user.id],
    queryFn: () => getMemberPermissions(user.id),
    staleTime: 60000,
  });
  const [localDirect, setLocalDirect] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // Sync local state quand les données arrivent
  useEffect(() => {
    if (memberPerms) setLocalDirect(memberPerms.direct ?? []);
  }, [memberPerms]);

  const dirtyPerms = useMemo(() =>
    JSON.stringify([...(localDirect)].sort()) !== JSON.stringify([...(memberPerms?.direct ?? [])].sort()),
    [localDirect, memberPerms],
  );

  function toggleDirect(action: string) {
    setLocalDirect(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
  }

  async function savePerms() {
    setSavingPerms(true);
    try {
      await setMemberPermissions(user.id, localDirect);
      await refetchPerms();
      toast.success('Accès individuels enregistrés');
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setSavingPerms(false); }
  }

  const userRoles = parseRoles(user.role);
  const isDev = currentUserRole.split(',').map(r => r.trim()).includes('dev');
  const [togglingProtection, setTogglingProtection] = useState(false);

  async function toggleProtection() {
    const newState = !user.is_protected;
    setTogglingProtection(true);
    try {
      await setMemberProtected(user.id, newState);
      toast.success(newState ? '🔒 Compte protégé' : '🔓 Protection retirée');
      onUpdated();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setTogglingProtection(false); }
  }

  function toggleRole(r: string) {
    setSelectedRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // PUT /members/:id gère tous les champs y compris email — un seul appel suffit
      await updateMember(user.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        role: selectedRoles.join(',') || form.role,
      });
      toast.success('Membre mis à jour');
      onUpdated();
      setEditing(false);
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    const newActive = !isActive(user);
    try {
      await updateMember(user.id, { is_active: newActive ? '1' : '0' });
      toast.success(newActive ? 'Compte activé' : 'Compte désactivé');
      qc.invalidateQueries({ queryKey: ['all-accounts'] });
      onUpdated();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    }
  }

  async function doResetPwd() {
    if (!newPwd) { setNewPwd(generateSecurePassword(14)); return; }
    setResetting(true);
    try {
      await resetMemberPassword(user.id, newPwd);
      toast.success('Mot de passe réinitialisé');
      setNewPwd('');
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setResetting(false); }
  }

  const active = isActive(user);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header fiche */}
      <div className="flex items-start justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <Avatar user={user} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{user.first_name} {user.last_name}</p>
              {user.is_protected && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  <ShieldCheck className="w-2.5 h-2.5" /> Protégé
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {userRoles.map(r => <RoleBadge key={r} role={r} />)}
            </div>
            <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-medium ${active ? 'text-green-600' : 'text-muted-foreground'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              {active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Infos de contact */}
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</h4>
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Prénom" className="px-2 py-1.5 rounded border border-input bg-background text-sm w-full" />
                <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Nom" className="px-2 py-1.5 rounded border border-input bg-background text-sm w-full" />
              </div>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-2 py-1.5 rounded border border-input bg-background text-sm w-full" />
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Téléphone" className="px-2 py-1.5 rounded border border-input bg-background text-sm w-full" />
              {/* Rôles multiples — checkboxes */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 font-medium">Rôles</p>
                <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
                  {ROLES.map(r => {
                    const selected = selectedRoles.includes(r);
                    return (
                      <button key={r} type="button" onClick={() => toggleRole(r)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] border transition-colors text-left ${
                          selected ? 'bg-primary/10 border-primary/40 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
                        }`}>
                        <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                          {selected && <Check className="w-2 h-2 text-primary-foreground" />}
                        </div>
                        {ROLE_LABELS[r] ?? r}
                      </button>
                    );
                  })}
                </div>
                {selectedRoles.length === 0 && (
                  <p className="text-[10px] text-destructive mt-1">Au moins un rôle requis</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving || selectedRoles.length === 0} className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                  {saving ? 'Enregistrement…' : '✓ Enregistrer'}
                </button>
                <button type="button" onClick={() => { setEditing(false); setSelectedRoles(parseRoles(user.role)); }} className="px-3 py-1.5 rounded border border-border text-xs">Annuler</button>
              </div>
            </form>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{user.email || '—'}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{user.phone || '—'}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-3.5 h-3.5 shrink-0" /><span>Créé le {formatDate(user.created_at)}</span></div>
            </div>
          )}
        </section>

        {/* Permissions — UI 3 états (style Active Directory) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> Accès & Permissions
            </h4>
            {dirtyPerms && (
              <button
                onClick={savePerms}
                disabled={savingPerms}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-medium disabled:opacity-50"
              >
                <Save className="w-2.5 h-2.5" />
                {savingPerms ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>

          {/* Légende */}
          <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center"><Check className="w-2 h-2 text-blue-600" /></span> Via rôle (lecture seule)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40 flex items-center justify-center"><Check className="w-2 h-2 text-green-600" /></span> Direct (individuel)</span>
          </div>

          {permsLoading ? (
            <div className="flex justify-center py-4"><div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <div className="space-y-3">
              {PERM_ACTIONS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] text-muted-foreground font-semibold mb-1">{group.group}</p>
                  <div className="space-y-1">
                    {group.actions.map(action => {
                      const viaRole  = (memberPerms?.via_role ?? []).includes(action);
                      const isDirect = localDirect.includes(action);
                      const effective = viaRole || isDirect;

                      return (
                        <div key={action}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                            viaRole   ? 'bg-blue-50 dark:bg-blue-950/20' :
                            isDirect  ? 'bg-green-50 dark:bg-green-950/20' :
                            'opacity-50 hover:opacity-80'
                          }`}
                        >
                          {/* Indicateur via-rôle (lecture seule) */}
                          <div
                            title={viaRole ? 'Accordé via le rôle (non modifiable ici)' : undefined}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                              viaRole
                                ? 'bg-blue-500/20 border-blue-500/60 cursor-not-allowed'
                                : 'border-border'
                            }`}
                          >
                            {viaRole && <Check className="w-2.5 h-2.5 text-blue-600" />}
                          </div>

                          {/* Indicateur direct (cliquable) */}
                          <button
                            type="button"
                            disabled={viaRole} // si déjà via rôle, pas besoin de duplication
                            onClick={() => !viaRole && toggleDirect(action)}
                            title={viaRole ? 'Déjà accordé via le rôle' : isDirect ? 'Retirer l\'accès direct' : 'Accorder un accès direct'}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              viaRole
                                ? 'border-border opacity-30 cursor-not-allowed'
                                : isDirect
                                  ? 'bg-green-500/20 border-green-500/60 hover:bg-green-500/30 cursor-pointer'
                                  : 'border-border hover:border-green-400 cursor-pointer'
                            }`}
                          >
                            {isDirect && !viaRole && <Check className="w-2.5 h-2.5 text-green-600" />}
                          </button>

                          <span className={effective ? 'text-foreground' : 'text-muted-foreground'}>
                            {ACTION_LABELS[action] ?? action}
                          </span>

                          {/* Badge source */}
                          {viaRole && (
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 font-medium">rôle</span>
                          )}
                          {isDirect && !viaRole && (
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20 font-medium">direct</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reset mot de passe */}
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Key className="w-3 h-3" /> Mot de passe
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Nouveau mot de passe…"
                className="flex-1 px-2 py-1.5 rounded border border-input bg-background text-sm"
              />
              <button type="button" onClick={() => setShowPwd(p => !p)} className="p-1.5 rounded border border-border">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setNewPwd(generateSecurePassword(14))} className="flex-1 px-2 py-1.5 rounded border border-border text-xs flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" /> Générer
              </button>
              {newPwd && (
                <button onClick={() => { navigator.clipboard.writeText(newPwd); toast.success('Copié !'); }} className="px-2 py-1.5 rounded border border-border text-xs">
                  <Copy className="w-3 h-3" />
                </button>
              )}
              <button onClick={doResetPwd} disabled={!newPwd || resetting} className="flex-1 px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50">
                {resetting ? 'En cours…' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Actions footer */}
      <div className="p-3 border-t border-border bg-card/50 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (editing) {
                setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone ?? '', role: user.role });
                setSelectedRoles(parseRoles(user.role));
              }
              setEditing(p => !p);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted"
          >
            <Edit2 className="w-3.5 h-3.5" /> {editing ? 'Annuler' : 'Modifier'}
          </button>
          <button
            onClick={toggleActive}
            disabled={user.is_protected}
            title={user.is_protected ? 'Compte protégé — retirer la protection d\'abord' : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? 'border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                : 'border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30'
            }`}
          >
            {active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {active ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        {/* Bouton protection — visible uniquement pour le rôle dev */}
        {isDev && (
          <button
            onClick={toggleProtection}
            disabled={togglingProtection}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
              user.is_protected
                ? 'border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                : 'border-slate-300 text-slate-500 hover:bg-muted'
            }`}
          >
            {user.is_protected
              ? <><ShieldOff className="w-3.5 h-3.5" /> Retirer la protection</>
              : <><ShieldCheck className="w-3.5 h-3.5" /> Accorder la protection</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Onglet Permissions (matrice rôles × actions) ──────────────────────────────

function PermissionsTab() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    getPermissions().then(data => {
      const perms = data.permissions || {};
      const roleMap: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { roleMap[r.role] = []; });
      Object.entries(perms).forEach(([action, roles]) => {
        (roles as string[]).forEach(role => {
          if (roleMap[role] !== undefined) roleMap[role].push(action);
        });
      });
      setMatrix(roleMap);
      setLoading(false);
    });
  }, []);

  function toggle(role: string, action: string) {
    setMatrix(prev => {
      const curr = prev[role] ?? [];
      const next = curr.includes(action) ? curr.filter(a => a !== action) : [...curr, action];
      return { ...prev, [role]: next };
    });
    setChanged(true);
    setSavedOk(false);
  }

  async function save() {
    setSaving(true);
    try {
      const byAction: Record<string, string[]> = {};
      allActions.forEach(a => { byAction[a] = []; });
      Object.entries(matrix).forEach(([role, actions]) => {
        actions.forEach(a => { if (byAction[a]) byAction[a].push(role); });
      });
      await savePermissions(byAction);
      setSavedOk(true);
      setChanged(false);
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally { setSaving(false); }
  }

  function reset() {
    setMatrix({});
    setChanged(false);
    setSavedOk(false);
    setLoading(true);
    getPermissions().then(data => {
      const perms = data.permissions || {};
      const roleMap: Record<string, string[]> = {};
      PERM_ROLES.forEach(r => { roleMap[r.role] = []; });
      Object.entries(perms).forEach(([action, roles]) => {
        (roles as string[]).forEach(role => {
          if (roleMap[role] !== undefined) roleMap[role].push(action);
        });
      });
      setMatrix(roleMap);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Cocher = le rôle a accès à cette fonctionnalité
        </p>
        <div className="flex gap-2">
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">
            <RotateCcw className="w-3 h-3" /> Recharger
          </button>
          <button onClick={save} disabled={!changed || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              savedOk ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground disabled:opacity-50'
            }`}>
            <Save className="w-3 h-3" />
            {saving ? 'Enregistrement…' : savedOk ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48 border-b border-border">Action</th>
              {PERM_ROLES.map(r => (
                <th key={r.role} className="px-2 py-2 font-medium text-center border-b border-border">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[10px] ${r.color}`}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_ACTIONS.map((group, gi) => (
              <React.Fragment key={`g${gi}`}>
                <tr className="bg-muted/30">
                  <td colSpan={PERM_ROLES.length + 1} className="px-3 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50">
                    {group.group}
                  </td>
                </tr>
                {group.actions.map(action => (
                  <tr key={action} className="hover:bg-muted/20 border-b border-border/40 last:border-b-0">
                    <td className="px-3 py-2 text-foreground">{ACTION_LABELS[action] ?? action}</td>
                    {PERM_ROLES.map(r => {
                      const checked = (matrix[r.role] ?? []).includes(action);
                      return (
                        <td key={r.role} className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggle(r.role, action)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                              checked ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AccesPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('membres');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['all-accounts'],
    queryFn: getAllAccounts,
    staleTime: 60000,
  });

  const { data: permData } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
    staleTime: 300000,
  });

  // Matrice { role → [actions] }
  const matrix = useMemo<Record<string, string[]>>(() => {
    const perms = permData?.permissions ?? {};
    const roleMap: Record<string, string[]> = {};
    PERM_ROLES.forEach(r => { roleMap[r.role] = []; });
    Object.entries(perms).forEach(([action, roles]) => {
      (roles as string[]).forEach(role => {
        if (roleMap[role] !== undefined) roleMap[role].push(action);
      });
    });
    return roleMap;
  }, [permData]);

  const filtered = useMemo(() => {
    return (accounts as Account[]).filter(u => {
      if (filterStatus === 'active' && !isActive(u)) return false;
      if (filterStatus === 'inactive' && isActive(u)) return false;
      if (filterRole && !parseRoles(u.role).includes(filterRole)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.first_name?.toLowerCase().includes(q) ||
          u.last_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, search, filterRole, filterStatus]);

  const selectedUser = useMemo(() =>
    selectedId ? (accounts as Account[]).find(u => u.id === selectedId) ?? null : null,
    [accounts, selectedId],
  );

  const stats = useMemo(() => {
    const all = accounts as Account[];
    return {
      total: all.length,
      active: all.filter(isActive).length,
      inactive: all.filter(u => !isActive(u)).length,
    };
  }, [accounts]);

  const uniqueRoles = useMemo(() =>
    [...new Set((accounts as Account[]).flatMap(u => parseRoles(u.role)))].sort(),
    [accounts],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">🔐 Accès & Identités</h1>
          <p className="text-xs text-muted-foreground">{stats.total} membres · {stats.active} actifs · {stats.inactive} inactifs</p>
        </div>
        {tab === 'membres' && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Nouveau membre
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'membres',    label: '👥 Membres',         count: stats.total },
          { key: 'permissions', label: '🔒 Rôles & Permissions' },
        ] as { key: Tab; label: string; count?: number }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── TAB MEMBRES ── */}
      {tab === 'membres' && (
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Colonne liste */}
          <div className={`flex flex-col ${selectedUser ? 'hidden md:flex md:w-72' : 'w-full'}`}>
            {/* Filtres */}
            <div className="flex flex-col gap-2 mb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm w-full"
                />
              </div>
              <div className="flex gap-2">
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-input bg-background text-xs">
                  <option value="">Tous les rôles</option>
                  {uniqueRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-input bg-background text-xs">
                  <option value="all">Tous</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Inactifs</option>
                </select>
              </div>
            </div>

            {/* Liste membres */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Aucun membre trouvé</div>
              ) : filtered.map(u => {
                const active = isActive(u);
                const roles = parseRoles(u.role);
                const isSelected = u.id === selectedId;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedId(u.id === selectedId ? null : u.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    <Avatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium truncate ${!active ? 'line-through text-muted-foreground' : ''}`}>
                          {u.first_name} {u.last_name}
                        </p>
                        {u.is_protected && (
                          <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" title="Compte protégé" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {roles.slice(0, 2).map(r => <RoleBadge key={r} role={r} />)}
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? 'text-primary rotate-90' : 'text-muted-foreground'}`} />
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Panneau fiche membre */}
          {selectedUser ? (
            <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
              <MemberDetail
                user={selectedUser}
                matrix={matrix}
                currentUserRole={currentUser?.role ?? ''}
                onClose={() => setSelectedId(null)}
                onUpdated={() => qc.invalidateQueries({ queryKey: ['all-accounts'] })}
              />
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center border border-dashed border-border rounded-xl bg-card/30">
              <div className="text-center text-muted-foreground">
                <UserCog className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Sélectionne un membre</p>
                <p className="text-xs mt-1">pour voir sa fiche et ses accès</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB PERMISSIONS ── */}
      {tab === 'permissions' && <PermissionsTab />}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['all-accounts'] })}
        />
      )}
    </div>
  );
}
