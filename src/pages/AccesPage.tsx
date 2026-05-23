/**
 * AccesPage — Module unifié "Membres & Accès"
 * Fusion de ComptesPage (annuaire, table, KPIs, export) et AccesPage (permissions directes, matrice rôles)
 * Architecture : Master-Detail (table + panel latéral) + onglet Permissions
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllAccounts, updateMember, createMember, deleteMember,
  resetMemberPassword, getPermissions, savePermissions,
  getMemberPermissions, setMemberPermissions, setMemberProtected,
  type MemberPermissions,
} from '@/lib/api';
import { generateSecurePassword } from '@/lib/security';
import {
  Search, Shield, ShieldCheck, ShieldOff, Key, Plus, Copy, Eye, EyeOff,
  UserCog, Phone, Mail, Calendar, Download, Filter,
  RefreshCw, Edit2, Lock, Unlock, Check, X, Save,
  RotateCcw, Info, Trash2, AlertTriangle, UserCheck, UserX,
  ChevronUp, ChevronDown, ArrowUpDown, Users, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes — source unique de vérité pour tout le module
// ─────────────────────────────────────────────────────────────────────────────

// ── Niveau 1 : Direction ──────────────────────────────────────────────────────
// ── Niveau 2 : Responsables de pôle ──────────────────────────────────────────
// ── Niveau 3 : Membres opérationnels ─────────────────────────────────────────
// ── Niveau 1 : Direction ──────────────────────────────────────────────────────
// ── Niveau 2 : Responsables de pôle ──────────────────────────────────────────
// ── Niveau 3 : Membres opérationnels ─────────────────────────────────────────
const ROLES = [
  // Niveau 1 — Direction
  'dev', 'pasteur', 'coordinateur',
  // Niveau 2 — Responsables de pôle
  'responsable_louange', 'responsable_sonorisation', 'responsable_projection',
  'responsable_musicien', 'responsable_video', 'responsable_accueil',
  // Niveau 2 bis — Référents AEFV
  'referent_planning_video', 'referent_technique_video',
  // Niveau 3 — Membres opérationnels
  'conducteur_louange', 'choriste',
  'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste',
  'sonorisateur', 'projectionniste', 'videaste',
];

const ROLE_LABELS: Record<string, string> = {
  // N1
  dev: 'Dev', pasteur: 'Pasteur', coordinateur: 'Coordinateur',
  // N2
  responsable_louange:       'Resp. Louange',
  responsable_sonorisation:  'Resp. Sono',
  responsable_projection:    'Resp. Projection',
  responsable_musicien:      'Resp. Musicien',
  responsable_video:         'Resp. Vidéo',
  responsable_accueil:       'Resp. Accueil',
  // N2 bis — Référents AEFV
  referent_planning_video:  'Réf. Planning AEFV',
  referent_technique_video: 'Réf. Technique AEFV',
  // N3
  conducteur_louange: 'Cond. Louange',
  choriste: 'Choriste', pianiste: 'Pianiste', batteur: 'Batteur',
  guitariste_electrique: 'Guit. Élec', guitariste_acoustique: 'Guit. Acou',
  bassiste: 'Bassiste', sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste', videaste: 'Vidéaste',
};

const ROLE_COLORS: Record<string, string> = {
  // N1
  dev:          'bg-zinc-700/10 text-zinc-500 border-zinc-600/20',
  pasteur:      'bg-red-600/10 text-red-600 border-red-600/20',
  coordinateur: 'bg-sky-600/10 text-sky-600 border-sky-600/20',
  // N2
  responsable_louange:       'bg-blue-700/10 text-blue-700 border-blue-700/20',
  responsable_sonorisation:  'bg-orange-500/10 text-orange-600 border-orange-500/20',
  responsable_projection:    'bg-teal-600/10 text-teal-600 border-teal-600/20',
  responsable_musicien:      'bg-emerald-600/10 text-emerald-600 border-emerald-600/20',
  responsable_video:         'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  responsable_accueil:       'bg-rose-500/10 text-rose-600 border-rose-500/20',
  // N2 bis — Référents AEFV
  referent_planning_video:  'bg-red-500/10 text-red-600 border-red-500/20',
  referent_technique_video: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  // N3
  conducteur_louange:   'bg-blue-500/10 text-blue-500 border-blue-500/20',
  choriste:             'bg-amber-500/10 text-amber-600 border-amber-500/20',
  pianiste:             'bg-pink-500/10 text-pink-600 border-pink-500/20',
  batteur:              'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  guitariste_electrique:'bg-violet-600/10 text-violet-600 border-violet-600/20',
  guitariste_acoustique:'bg-purple-600/10 text-purple-600 border-purple-600/20',
  bassiste:             'bg-lime-600/10 text-lime-700 border-lime-600/20',
  sonorisateur:         'bg-orange-400/10 text-orange-500 border-orange-400/20',
  projectionniste:      'bg-teal-500/10 text-teal-600 border-teal-500/20',
  videaste:             'bg-sky-500/10 text-sky-600 border-sky-500/20',
};

const PERM_ROLES = [
  // Niveau 1
  { role: 'dev',          label: 'Dev',          color: 'bg-zinc-700' },
  { role: 'pasteur',      label: 'Pasteur',       color: 'bg-red-600' },
  { role: 'coordinateur', label: 'Coordinateur',  color: 'bg-sky-600' },
  // Niveau 2
  { role: 'responsable_louange',      label: 'Resp. Louange',    color: 'bg-blue-700' },
  { role: 'responsable_sonorisation', label: 'Resp. Sono',       color: 'bg-orange-500' },
  { role: 'responsable_projection',   label: 'Resp. Projection', color: 'bg-teal-600' },
  { role: 'responsable_musicien',     label: 'Resp. Musicien',   color: 'bg-emerald-600' },
  { role: 'responsable_video',        label: 'Resp. Vidéo',      color: 'bg-indigo-500' },
  { role: 'responsable_accueil',      label: 'Resp. Accueil',    color: 'bg-rose-500' },
  // Niveau 2 bis — Référents AEFV
  { role: 'referent_planning_video',  label: 'Réf. Planning AEFV',  color: 'bg-red-500' },
  { role: 'referent_technique_video', label: 'Réf. Technique AEFV', color: 'bg-orange-600' },
  // Niveau 3
  { role: 'conducteur_louange',    label: 'Cond. Louange', color: 'bg-blue-500' },
  { role: 'choriste',              label: 'Choriste',      color: 'bg-amber-500' },
  { role: 'pianiste',              label: 'Pianiste',      color: 'bg-pink-600' },
  { role: 'batteur',               label: 'Batteur',       color: 'bg-cyan-600' },
  { role: 'guitariste_electrique', label: 'Guit. Élec',   color: 'bg-violet-600' },
  { role: 'guitariste_acoustique', label: 'Guit. Acou',   color: 'bg-purple-600' },
  { role: 'bassiste',              label: 'Bassiste',      color: 'bg-lime-600' },
  { role: 'sonorisateur',          label: 'Sono',          color: 'bg-orange-400' },
  { role: 'projectionniste',       label: 'Projection',    color: 'bg-teal-500' },
  { role: 'videaste',              label: 'Vidéaste',      color: 'bg-sky-500' },
];

const PERM_ACTIONS = [
  { group: '📅 Planning',        actions: ['planning_view', 'planning_edit'] },
  { group: '👥 Membres',         actions: ['members_view', 'members_manage'] },
  { group: '🎼 Chants',          actions: ['songs_view', 'songs_manage'] },
  { group: '🎬 Archives',        actions: ['archives_view', 'archives_edit'] },
  { group: '📄 Exports',         actions: ['exports_pdf'] },
  { group: '⚙️ Administration',  actions: ['config_view', 'config_edit', 'dev_access'] },
];

const ACTION_LABELS: Record<string, string> = {
  planning_view: 'Voir le planning',     planning_edit: 'Modifier le planning',
  members_view: 'Voir les membres',      members_manage: 'Gérer les membres',
  songs_view: 'Bibliothèque chants',     songs_manage: 'Gérer les chants',
  archives_view: 'Voir les archives',    archives_edit: 'Gérer les archives',
  exports_pdf: 'Export PDF',
  config_view: 'Voir la config',         config_edit: 'Modifier la config',
  dev_access: 'Accès dev',
};

const allActions = PERM_ACTIONS.flatMap(g => g.actions);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Account = {
  id: string; first_name: string; last_name: string; email: string;
  phone?: string; role: string; is_active?: string | number | boolean;
  is_protected?: boolean; instrument?: string;
  created_at?: string; updated_at?: string;
};

type PageTab   = 'annuaire' | 'permissions';
type DetailTab = 'identity' | 'roles' | 'access' | 'security';
type SortKey   = 'name' | 'email' | 'role' | 'status' | 'created_at';
type SortDir   = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Pas d'alias actif — conducteur_louange et responsable_louange sont deux rôles distincts
function normalizeRole(r: string) { return r.trim(); }

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

// ─────────────────────────────────────────────────────────────────────────────
// UI Primitives
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />Inactif</span>;
}

function Avatar({ user, size = 'md' }: { user: Account; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm';
  const active = isActive(user);
  return (
    <div className={`${s} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}>
      {getInitials(user)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal création de compte
// ─────────────────────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'choriste' });
  const [saving, setSaving] = useState(false);
  const [generatedPwd] = useState(() => generateSecurePassword(14));
  const [showPwd, setShowPwd] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMember({ ...form, phone: form.phone || undefined, password: generatedPwd });
      toast.success(`Compte créé pour ${form.first_name} ${form.last_name}`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Erreur lors de la création', { description: err.message });
    } finally { setSaving(false); }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }}
          className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold flex-1">Créer un compte</h2>
            <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <form onSubmit={submit} className="p-5 space-y-4">
            {/* Identité */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identité</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom" required>
                  <input value={form.first_name} onChange={set('first_name')} placeholder="Jean" required className={inputCls} />
                </Field>
                <Field label="Nom" required>
                  <input value={form.last_name} onChange={set('last_name')} placeholder="Dupont" required className={inputCls} />
                </Field>
              </div>
            </div>
            {/* Contact */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" required>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input type="email" value={form.email} onChange={set('email')} placeholder="jean@exemple.com" required className={`${inputCls} pl-8`} />
                  </div>
                </Field>
                <Field label="Téléphone">
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+33 6 …" className={`${inputCls} pl-8`} />
                  </div>
                </Field>
              </div>
            </div>
            {/* Rôle */}
            <Field label="Rôle principal" required>
              <select value={form.role} onChange={set('role')} className={inputCls}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
              </select>
            </Field>
            {/* Mot de passe */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Mot de passe provisoire
              </p>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono text-sm bg-background border border-border rounded-md px-3 py-2 tracking-widest">
                  {showPwd ? generatedPwd : '••••••••••••'}
                </span>
                <button type="button" onClick={() => setShowPwd(v => !v)} className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-muted text-muted-foreground">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(generatedPwd); toast.success('Mot de passe copié'); }}
                  className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-muted text-muted-foreground">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-amber-600/80 mt-1.5">À communiquer à l'utilisateur.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                <UserCheck className="w-4 h-4" /> {saving ? 'Création…' : 'Créer le compte'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground">Annuler</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel latéral — Fiche membre (4 onglets)
// ─────────────────────────────────────────────────────────────────────────────

function MemberDetail({
  user, matrix, currentUserRole, onClose, onUpdated,
}: {
  user: Account; matrix: Record<string, string[]>;
  currentUserRole: string; onClose: () => void; onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<DetailTab>('identity');

  // ── État Identité ──
  const [form, setForm] = useState({
    first_name: user.first_name, last_name: user.last_name,
    email: user.email, phone: user.phone ?? '',
  });
  const [savingId, setSavingId] = useState(false);

  // ── État Rôles ──
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => parseRoles(user.role));
  const [savingRoles, setSavingRoles] = useState(false);

  // ── État Accès directs ──
  const { data: memberPerms, isLoading: permsLoading, refetch: refetchPerms } = useQuery<MemberPermissions>({
    queryKey: ['member-permissions', user.id],
    queryFn: () => getMemberPermissions(user.id),
    staleTime: 60000,
  });
  const [localDirect, setLocalDirect] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    if (memberPerms) setLocalDirect(memberPerms.direct ?? []);
  }, [memberPerms]);

  const dirtyPerms = useMemo(() =>
    JSON.stringify([...localDirect].sort()) !== JSON.stringify([...(memberPerms?.direct ?? [])].sort()),
    [localDirect, memberPerms],
  );

  // ── État Sécurité ──
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [togglingProtect, setTogglingProtect] = useState(false);

  const active = isActive(user);
  const isDev = currentUserRole.split(',').map(r => r.trim()).includes('dev');

  // ── Actions ──
  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault();
    setSavingId(true);
    try {
      await updateMember(user.id, { first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone || undefined });
      toast.success('Identité mise à jour');
      onUpdated();
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setSavingId(false); }
  }

  async function saveRoles() {
    if (selectedRoles.length === 0) return;
    setSavingRoles(true);
    try {
      const apiRoles = [...new Set(selectedRoles.map(r => normalizeRole(r)))].join(',');
      await updateMember(user.id, { role: apiRoles });
      toast.success('Rôles mis à jour');
      onUpdated();
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setSavingRoles(false); }
  }

  async function savePerms() {
    setSavingPerms(true);
    try {
      await setMemberPermissions(user.id, localDirect);
      await refetchPerms();
      toast.success('Accès individuels enregistrés');
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setSavingPerms(false); }
  }

  async function doResetPwd() {
    if (!newPwd) { setNewPwd(generateSecurePassword(14)); return; }
    setResetting(true);
    try {
      await resetMemberPassword(user.id, newPwd);
      toast.success('Mot de passe réinitialisé');
      setNewPwd('');
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setResetting(false); }
  }

  async function toggleActive() {
    setTogglingActive(true);
    try {
      await updateMember(user.id, { is_active: !active });
      toast.success(active ? 'Compte suspendu' : 'Compte réactivé');
      qc.invalidateQueries({ queryKey: ['all-accounts'] });
      onUpdated();
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setTogglingActive(false); }
  }

  async function toggleProtect() {
    setTogglingProtect(true);
    try {
      await setMemberProtected(user.id, !user.is_protected);
      toast.success(user.is_protected ? '🔓 Protection retirée' : '🔒 Compte protégé');
      onUpdated();
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setTogglingProtect(false); }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteMember(user.id);
      toast.success(`Compte de ${user.first_name} ${user.last_name} supprimé`);
      qc.invalidateQueries({ queryKey: ['all-accounts'] });
      onClose();
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setDeleting(false); }
  }

  const userRoles = parseRoles(user.role);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border bg-card/50">
        <Avatar user={user} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{user.first_name} {user.last_name}</p>
            {user.is_protected && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                <ShieldCheck className="w-2.5 h-2.5" /> Protégé
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {userRoles.slice(0, 3).map(r => <RoleBadge key={r} role={r} />)}
            <StatusBadge active={active} />
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted shrink-0">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Onglets detail */}
      <div className="flex border-b border-border bg-card/30 px-2 pt-1">
        {([
          ['identity', '👤 Identité'],
          ['roles',    '🛡️ Rôles'],
          ['access',   '🔑 Accès'],
          ['security', '🔐 Sécurité'],
        ] as [DetailTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Onglet Identité ── */}
        {tab === 'identity' && (
          <form onSubmit={saveIdentity} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Nom">
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <Field label="Email">
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <Field label="Téléphone">
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 6 …" className={`${inputCls} pl-8`} />
              </div>
            </Field>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Créé le {formatDate(user.created_at)} · modifié le {formatDate(user.updated_at)}
            </div>
            <button type="submit" disabled={savingId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {savingId ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}

        {/* ── Onglet Rôles ── */}
        {tab === 'roles' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Cochez les rôles de ce membre. Les permissions associées sont calculées automatiquement.</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {ROLES.map(r => {
                const selected = selectedRoles.includes(r);
                return (
                  <button key={r} type="button"
                    onClick={() => setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                      selected ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}>
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    {ROLE_LABELS[r] ?? r}
                  </button>
                );
              })}
            </div>
            {selectedRoles.length === 0 && <p className="text-[11px] text-destructive">Au moins un rôle requis.</p>}
            {selectedRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                {selectedRoles.map(r => <RoleBadge key={r} role={r} />)}
              </div>
            )}
            <button onClick={saveRoles} disabled={savingRoles || selectedRoles.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              <Shield className="w-3.5 h-3.5" /> {savingRoles ? 'Enregistrement…' : 'Appliquer les rôles'}
            </button>
          </div>
        )}

        {/* ── Onglet Accès directs ── */}
        {tab === 'access' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Permissions individuelles, indépendantes du rôle.</p>
              {dirtyPerms && (
                <button onClick={savePerms} disabled={savingPerms}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium disabled:opacity-50">
                  <Save className="w-2.5 h-2.5" /> {savingPerms ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              )}
            </div>
            {/* Légende */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center"><Check className="w-2 h-2 text-blue-600" /></span>
                Via rôle
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40 flex items-center justify-center"><Check className="w-2 h-2 text-green-600" /></span>
                Direct
              </span>
            </div>
            {permsLoading ? (
              <div className="flex justify-center py-6"><div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-3">
                {PERM_ACTIONS.map(group => (
                  <div key={group.group}>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">{group.group}</p>
                    <div className="space-y-1">
                      {group.actions.map(action => {
                        const viaRole  = (memberPerms?.via_role ?? []).includes(action);
                        const isDirect = localDirect.includes(action);
                        const effective = viaRole || isDirect;
                        return (
                          <div key={action}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                              viaRole ? 'bg-blue-50 dark:bg-blue-950/20' : isDirect ? 'bg-green-50 dark:bg-green-950/20' : 'opacity-50 hover:opacity-75'
                            }`}>
                            {/* Indicateur via-rôle */}
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${viaRole ? 'bg-blue-500/20 border-blue-500/60 cursor-not-allowed' : 'border-border'}`}>
                              {viaRole && <Check className="w-2.5 h-2.5 text-blue-600" />}
                            </div>
                            {/* Indicateur direct (cliquable) */}
                            <button type="button" disabled={viaRole}
                              onClick={() => !viaRole && setLocalDirect(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action])}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                viaRole ? 'border-border opacity-30 cursor-not-allowed'
                                : isDirect ? 'bg-green-500/20 border-green-500/60 hover:bg-green-500/30 cursor-pointer'
                                : 'border-border hover:border-green-400 cursor-pointer'
                              }`}>
                              {isDirect && !viaRole && <Check className="w-2.5 h-2.5 text-green-600" />}
                            </button>
                            <span className={effective ? 'text-foreground' : 'text-muted-foreground'}>{ACTION_LABELS[action] ?? action}</span>
                            {viaRole && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 font-medium">rôle</span>}
                            {isDirect && !viaRole && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20 font-medium">direct</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Sécurité ── */}
        {tab === 'security' && (
          <div className="space-y-4">
            {/* Reset mot de passe */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-amber-500" /> Réinitialiser le mot de passe</h3>
              <div className="flex items-center gap-2 mt-3">
                <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="Nouveau mot de passe…" className="flex-1 px-2 py-1.5 rounded border border-input bg-background text-sm" />
                <button type="button" onClick={() => setShowPwd(p => !p)} className="p-1.5 rounded border border-border">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => setNewPwd(generateSecurePassword(14))} className="p-1.5 rounded border border-border">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {newPwd && (
                  <button onClick={() => { navigator.clipboard.writeText(newPwd); toast.success('Copié !'); }} className="p-1.5 rounded border border-border">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button onClick={doResetPwd} disabled={!newPwd || resetting}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 border border-amber-500/30 text-xs font-semibold disabled:opacity-50">
                <Key className="w-3.5 h-3.5" /> {resetting ? 'Réinitialisation…' : 'Confirmer la réinitialisation'}
              </button>
            </div>

            {/* Statut du compte */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                {active ? <Lock className="w-3.5 h-3.5 text-muted-foreground" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                Statut du compte
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">
                {active ? 'Suspendre empêche la connexion sans supprimer les données.' : 'Compte suspendu — réactiver pour rétablir l\'accès.'}
              </p>
              <button onClick={toggleActive} disabled={togglingActive || user.is_protected}
                title={user.is_protected ? 'Compte protégé' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
                  active ? 'bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20'
                         : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20'
                }`}>
                {active ? <><UserX className="w-3.5 h-3.5" /> Suspendre</> : <><UserCheck className="w-3.5 h-3.5" /> Réactiver</>}
              </button>
            </div>

            {/* Protection (dev uniquement) */}
            {isDev && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Protection du compte
                </h3>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Un compte protégé ne peut pas être suspendu ni supprimé.
                </p>
                <button onClick={toggleProtect} disabled={togglingProtect}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                    user.is_protected
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                  }`}>
                  {user.is_protected
                    ? <><ShieldOff className="w-3.5 h-3.5" /> Retirer la protection</>
                    : <><ShieldCheck className="w-3.5 h-3.5" /> Accorder la protection</>}
                </button>
              </div>
            )}

            {/* Zone dangereuse */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Zone dangereuse
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">La suppression anonymise définitivement ce compte.</p>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} disabled={user.is_protected}
                  title={user.is_protected ? 'Compte protégé' : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer définitivement
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive">⚠️ Supprimer {user.first_name} {user.last_name} ?</p>
                  <div className="flex gap-2">
                    <button onClick={doDelete} disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Suppression…' : 'Confirmer'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Matrice Rôles × Permissions
// ─────────────────────────────────────────────────────────────────────────────

function PermissionsTab() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  function buildMatrix(perms: Record<string, string[]>) {
    const m: Record<string, string[]> = {};
    PERM_ROLES.forEach(r => { m[r.role] = []; });
    Object.entries(perms).forEach(([action, roles]) => {
      (roles as string[]).forEach(role => { if (m[role] !== undefined) m[role].push(action); });
    });
    return m;
  }

  useEffect(() => {
    getPermissions().then(data => {
      setMatrix(buildMatrix(data.permissions || {}));
      setLoading(false);
    });
  }, []);

  function toggle(role: string, action: string) {
    setMatrix(prev => {
      const curr = prev[role] ?? [];
      return { ...prev, [role]: curr.includes(action) ? curr.filter(a => a !== action) : [...curr, action] };
    });
    setChanged(true); setSavedOk(false);
  }

  async function save() {
    setSaving(true);
    try {
      const byAction: Record<string, string[]> = {};
      allActions.forEach(a => { byAction[a] = []; });
      Object.entries(matrix).forEach(([role, actions]) => { actions.forEach(a => { if (byAction[a]) byAction[a].push(role); }); });
      await savePermissions(byAction);
      setSavedOk(true); setChanged(false);
    } catch (err: any) { toast.error('Erreur', { description: err.message }); }
    finally { setSaving(false); }
  }

  function reload() {
    setLoading(true); setChanged(false); setSavedOk(false);
    getPermissions().then(data => { setMatrix(buildMatrix(data.permissions || {})); setLoading(false); }).catch(() => setLoading(false));
  }

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Cocher = le rôle a accès à cette fonctionnalité
        </p>
        <div className="flex gap-2">
          <button onClick={reload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">
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
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-44 border-b border-border">Action</th>
              {PERM_ROLES.map(r => (
                <th key={r.role} className="px-2 py-2 font-medium text-center border-b border-border">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-white text-[9px] ${r.color}`}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_ACTIONS.map((group, gi) => (
              <React.Fragment key={`g${gi}`}>
                <tr className="bg-muted/30">
                  <td colSpan={PERM_ROLES.length + 1} className="px-3 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50">{group.group}</td>
                </tr>
                {group.actions.map(action => (
                  <tr key={action} className="hover:bg-muted/20 border-b border-border/40 last:border-b-0">
                    <td className="px-3 py-2 text-foreground">{ACTION_LABELS[action] ?? action}</td>
                    {PERM_ROLES.map(r => {
                      const checked = (matrix[r.role] ?? []).includes(action);
                      return (
                        <td key={r.role} className="px-2 py-2 text-center">
                          <button onClick={() => toggle(r.role, action)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                              checked ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                            }`}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function AccesPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [pageTab, setPageTab]       = useState<PageTab>('annuaire');
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey]       = useState<SortKey>('name');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['all-accounts'],
    queryFn: getAllAccounts as () => Promise<Account[]>,
    staleTime: 60000,
  });

  const { data: permData } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
    staleTime: 300000,
  });

  // Matrice { role → [actions] } pour les permissions via rôle
  const matrix = useMemo<Record<string, string[]>>(() => {
    const perms = permData?.permissions ?? {};
    const m: Record<string, string[]> = {};
    PERM_ROLES.forEach(r => { m[r.role] = []; });
    Object.entries(perms).forEach(([action, roles]) => {
      (roles as string[]).forEach(role => { if (m[role] !== undefined) m[role].push(action); });
    });
    return m;
  }, [permData]);

  // Tri
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Filtres + tri
  const filtered = useMemo(() => {
    let list = [...accounts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => `${u.first_name} ${u.last_name} ${u.email} ${u.phone ?? ''} ${u.role}`.toLowerCase().includes(q));
    }
    if (filterRole)              list = list.filter(u => parseRoles(u.role).includes(filterRole));
    if (filterStatus === 'active')   list = list.filter(u => isActive(u));
    if (filterStatus === 'inactive') list = list.filter(u => !isActive(u));
    list.sort((a, b) => {
      const va = sortKey === 'name' ? `${a.last_name} ${a.first_name}` : sortKey === 'email' ? a.email : sortKey === 'role' ? a.role : sortKey === 'status' ? (isActive(a) ? '1' : '0') : a.created_at ?? '';
      const vb = sortKey === 'name' ? `${b.last_name} ${b.first_name}` : sortKey === 'email' ? b.email : sortKey === 'role' ? b.role : sortKey === 'status' ? (isActive(b) ? '1' : '0') : b.created_at ?? '';
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [accounts, search, filterRole, filterStatus, sortKey, sortDir]);

  const selectedUser = useMemo(() => selectedId ? accounts.find(u => u.id === selectedId) ?? null : null, [accounts, selectedId]);

  const stats = useMemo(() => ({
    total:    accounts.length,
    active:   accounts.filter(isActive).length,
    inactive: accounts.filter(u => !isActive(u)).length,
    protected: accounts.filter(u => u.is_protected).length,
  }), [accounts]);

  const uniqueRoles = useMemo(() =>
    [...new Set(accounts.flatMap(u => parseRoles(u.role)))].sort(), [accounts]);

  // Export CSV
  function handleExport() {
    const rows = filtered.map(u => [
      `"${u.last_name}"`, `"${u.first_name}"`, `"${u.email}"`,
      `"${u.phone ?? ''}"`,
      `"${parseRoles(u.role).map(r => ROLE_LABELS[r] ?? r).join(', ')}"`,
      `"${isActive(u) ? 'Actif' : 'Inactif'}"`,
      `"${u.is_protected ? 'Oui' : 'Non'}"`,
      `"${formatDate(u.created_at)}"`,
    ].join(';'));
    const header = '"Nom";"Prénom";"Email";"Téléphone";"Rôles";"Statut";"Protégé";"Créé le"';
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `membres-aef-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    toast.success('Export CSV téléchargé');
  }

  // Colonne triable
  function SortTh({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) {
    return (
      <th className={`px-4 py-3 text-left cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
        onClick={() => handleSort(k)}>
        <span className="flex items-center gap-1">
          {label}
          {sortKey === k ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
        </span>
      </th>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* Header page */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">🔐 Membres &amp; Accès</h1>
          <p className="text-xs text-muted-foreground">{stats.total} membres · {stats.active} actifs · {stats.inactive} inactifs{stats.protected > 0 ? ` · ${stats.protected} protégé${stats.protected > 1 ? 's' : ''}` : ''}</p>
        </div>
        {pageTab === 'annuaire' && (
          <div className="flex gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Nouveau compte
            </button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      {pageTab === 'annuaire' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { icon: Users,      label: 'Total',    value: stats.total,     color: 'text-primary',      bg: 'bg-primary/10' },
            { icon: UserCheck,  label: 'Actifs',   value: stats.active,    color: 'text-emerald-500',  bg: 'bg-emerald-500/10' },
            { icon: UserX,      label: 'Inactifs', value: stats.inactive,  color: 'text-muted-foreground', bg: 'bg-muted' },
            { icon: ShieldCheck, label: 'Protégés', value: stats.protected, color: 'text-amber-600',   bg: 'bg-amber-500/10' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{isLoading ? '—' : kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglets page */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'annuaire',     label: '👥 Annuaire',           count: stats.total },
          { key: 'permissions',  label: '🔒 Rôles & Permissions' },
        ] as { key: PageTab; label: string; count?: number }[]).map(t => (
          <button key={t.key} onClick={() => setPageTab(t.key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              pageTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── ANNUAIRE ── */}
      {pageTab === 'annuaire' && (
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Colonne table */}
          <div className={`flex flex-col ${selectedUser ? 'hidden md:flex md:w-[55%] lg:w-[60%]' : 'flex-1'}`}>
            {/* Barre de contrôle */}
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-2 items-center mb-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Nom, email, rôle…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Tous les rôles</option>
                  {uniqueRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
              </div>
              <div className="flex gap-1">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                    {{ all: 'Tous', active: 'Actifs', inactive: 'Inactifs' }[s]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground ml-auto">{filtered.length}/{accounts.length}</p>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">Aucun membre ne correspond</p>
                  {(search || filterRole || filterStatus !== 'all') && (
                    <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('all'); }} className="text-xs text-primary hover:underline mt-1">Réinitialiser les filtres</button>
                  )}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                        <SortTh label="Membre" k="name" className="pl-4 min-w-[160px]" />
                        <SortTh label="Email" k="email" className="hidden sm:table-cell min-w-[160px]" />
                        <th className="px-4 py-3 text-left">Rôles</th>
                        <SortTh label="Statut" k="status" className="hidden md:table-cell w-24" />
                        <SortTh label="Créé" k="created_at" className="hidden lg:table-cell w-24" />
                        <th className="px-4 py-3 w-10"><MoreHorizontal className="w-3.5 h-3.5 ml-auto" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u, i) => {
                        const roles  = parseRoles(u.role);
                        const active = isActive(u);
                        const selected = u.id === selectedId;
                        return (
                          <motion.tr key={u.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                            onClick={() => setSelectedId(selected ? null : u.id)}
                            className={`border-t border-border cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/30'} ${!active ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                                    {u.is_protected && <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" title="Compte protégé" />}
                                  </div>
                                  {u.phone && <p className="text-[10px] text-muted-foreground">{u.phone}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {roles.slice(0, 2).map(r => <RoleBadge key={r} role={r} />)}
                                {roles.length > 2 && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border">+{roles.length - 2}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell"><StatusBadge active={active} /></td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(u.created_at)}</p>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Edit2 className={`w-3.5 h-3.5 ml-auto ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
                    <button onClick={() => qc.invalidateQueries({ queryKey: ['all-accounts'] })} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                      <RefreshCw className="w-3 h-3" /> Actualiser
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel fiche membre */}
          <AnimatePresence>
            {selectedUser ? (
              <motion.div
                key={selectedUser.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
                <MemberDetail
                  user={selectedUser}
                  matrix={matrix}
                  currentUserRole={currentUser?.role ?? ''}
                  onClose={() => setSelectedId(null)}
                  onUpdated={() => qc.invalidateQueries({ queryKey: ['all-accounts'] })}
                />
              </motion.div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center border border-dashed border-border rounded-xl bg-card/30">
                <div className="text-center text-muted-foreground">
                  <UserCog className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sélectionne un membre</p>
                  <p className="text-xs mt-1">pour voir sa fiche et ses accès</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── PERMISSIONS ── */}
      {pageTab === 'permissions' && <PermissionsTab />}

      {/* Modal création */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['all-accounts'] })}
        />
      )}
    </div>
  );
}
