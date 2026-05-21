import { useEffect, useState, useMemo } from 'react';
import { getAllAccounts, updateMember, createMember, deleteMember, resetMemberPassword } from '@/lib/api';
import { generateSecurePassword } from '@/lib/security';
import {
  Search, Shield, Key, X, Check, Plus, Trash2, Copy, Eye, EyeOff,
  UserCheck, UserX, Download, Upload, ChevronUp, ChevronDown,
  Users, UserCog, AlertTriangle, Phone, Mail, Calendar, Filter,
  RefreshCw, MoreHorizontal, Edit2, Lock, Unlock, ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLES = [
  'conducteur_louange', 'responsable_technique',
  'pasteur', 'choriste',
  'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste',
  'sonorisateur', 'projectionniste', 'videaste', 'dev',
];

const ROLE_LABELS: Record<string, string> = {
  conducteur_louange: 'Conducteur Louange',
  responsable_louange: 'Conducteur Louange',
  responsable_technique: 'Responsable Technique',
  pasteur: 'Pasteur',
  choriste: 'Choriste',
  pianiste: 'Pianiste',
  batteur: 'Batteur',
  guitariste_electrique: 'Guitariste Électrique',
  guitariste_acoustique: 'Guitariste Acoustique',
  bassiste: 'Bassiste',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
  dev: 'Développeur',
};

const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-destructive/10 text-destructive border-destructive/20',
  responsable_louange: 'bg-accent/10 text-accent border-accent/20',
  conducteur_louange: 'bg-accent/10 text-accent border-accent/20',
  dev: 'bg-foreground/10 text-foreground border-foreground/20',
  choriste: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pianiste: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  batteur: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  guitariste_electrique: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  guitariste_acoustique: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  bassiste: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sonorisateur: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  projectionniste: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  videaste: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  responsable_technique: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeRole = (r: string) => r === 'responsable_louange' ? 'conducteur_louange' : r;
const toApiRole = (r: string) => r === 'conducteur_louange' ? 'responsable_louange' : r;
const roleLabel = (r: string) => ROLE_LABELS[normalizeRole(r) ?? r] ?? r.replace(/_/g, ' ');

function parseUserRoles(role: string): string[] {
  if (!role) return [];
  return [...new Set(role.split(',').map(r => normalizeRole(r.trim())).filter(Boolean))];
}

function isActive(u: Account) {
  return String(u.is_active ?? '1') !== '0';
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(u: Account) {
  return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}

// Alias sécurisé — utilise crypto.getRandomValues() via security.ts
const generatePassword = (length = 14) => generateSecurePassword(length);

// ── Types ─────────────────────────────────────────────────────────────────────

type Account = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active?: string | number | boolean;
  instrument?: string;
  created_at?: string;
  updated_at?: string;
};

type SortKey = 'name' | 'email' | 'role' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';
type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: Account }
  | { type: 'reset'; user: Account; password: string }
  | { type: 'delete'; user: Account };

// ── Composants ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors = ROLE_COLORS[role] || 'bg-muted text-muted-foreground border-muted';
  return (
    <span className={`inline-flex items-center border text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${colors}`}>
      {roleLabel(role)}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />Inactif</span>;
}

function AvatarCircle({ user, size = 'md' }: { user: Account; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent shrink-0`}>
      {getInitials(user)}
    </div>
  );
}

// ── Modal Création ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'choriste' });
  const [saving, setSaving] = useState(false);
  const [generatedPwd] = useState(generatePassword());
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createMember({ ...form, phone: form.phone || undefined, password: generatedPwd });
      toast.success(`Compte créé pour ${form.first_name} ${form.last_name}`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg">
        <ModalHeader title="Créer un compte" icon={<Plus className="w-4 h-4 text-accent" />} onClose={onClose} />
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Identité */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identité</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" required>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Jean" required className={inputCls} />
              </Field>
              <Field label="Nom" required>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Dupont" required className={inputCls} />
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
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jean@exemple.com" required className={`${inputCls} pl-8`} />
                </div>
              </Field>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+33 6 00 00 00 00" className={`${inputCls} pl-8`} />
                </div>
              </Field>
            </div>
          </div>

          {/* Rôle */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accès & Rôle</p>
            <Field label="Rôle principal" required>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
          </div>

          {/* Mot de passe temporaire */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Mot de passe provisoire
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono text-sm text-foreground bg-background border border-border rounded-md px-3 py-2 tracking-widest">
                {showPwd ? generatedPwd : '••••••••••••'}
              </span>
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-muted text-muted-foreground">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => { navigator.clipboard.writeText(generatedPwd); toast.success('Mot de passe copié'); }}
                className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-muted text-muted-foreground">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-amber-600/80 mt-1.5">À communiquer à l'utilisateur — il devra le changer à la première connexion.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
              <UserCheck className="w-4 h-4" /> {saving ? 'Création...' : 'Créer le compte'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// ── Modal Fiche Utilisateur ───────────────────────────────────────────────────

type EditTab = 'identity' | 'access' | 'security';

function EditModal({ user, onClose, onUpdated }: { user: Account; onClose: () => void; onUpdated: () => void }) {
  const [tab, setTab] = useState<EditTab>('identity');
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone || '' });
  const [roles, setRoles] = useState<string[]>(parseUserRoles(user.role).length > 0 ? parseUserRoles(user.role) : ['choriste']);
  const [saving, setSaving] = useState(false);
  const [resetPwd, setResetPwd] = useState(generatePassword());
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const active = isActive(user);

  const handleSaveIdentity = async () => {
    setSaving(true);
    try {
      await updateMember(String(user.id), { first_name: form.first_name, last_name: form.last_name, phone: form.phone || null });
      toast.success('Identité mise à jour');
      onUpdated();
    } catch (err: any) { toast.error(err?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleSaveRoles = async () => {
    setSaving(true);
    try {
      const apiRoles = [...new Set(roles.map(r => toApiRole(normalizeRole(r))))].join(',');
      await updateMember(String(user.id), { role: apiRoles });
      toast.success('Rôles mis à jour');
      onUpdated();
    } catch (err: any) { toast.error(err?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    setResetting(true);
    try {
      await resetMemberPassword(String(user.id), resetPwd);
      toast.success(`Mot de passe réinitialisé pour ${user.first_name}`);
    } catch (err: any) { toast.error(err?.message || 'Erreur'); }
    finally { setResetting(false); }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      await updateMember(String(user.id), { is_active: !active });
      toast.success(`Compte ${active ? 'suspendu' : 'réactivé'}`);
      onUpdated();
      onClose();
    } catch (err: any) { toast.error(err?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMember(String(user.id));
      toast.success(`Compte de ${user.first_name} ${user.last_name} supprimé`);
      onUpdated();
      onClose();
    } catch (err: any) { toast.error(err?.message || 'Erreur'); }
    finally { setDeleting(false); }
  };

  const toggleRole = (r: string) => {
    const norm = normalizeRole(r);
    setRoles(prev => prev.includes(norm) ? prev.filter(x => x !== norm) : [...prev, norm]);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg">
        {/* En-tête profil */}
        <div className="flex items-center gap-4 p-5 border-b border-border">
          <AvatarCircle user={user} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground">{user.first_name} {user.last_name}</h2>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge active={active} />
              {parseUserRoles(user.role).slice(0, 2).map(r => <RoleBadge key={r} role={r} />)}
            </div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground shrink-0">
            <p>Créé le</p>
            <p className="font-medium text-foreground">{formatDate(user.created_at)}</p>
            <p className="mt-1">Modifié</p>
            <p className="font-medium text-foreground">{formatDate(user.updated_at)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground self-start ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-border px-5">
          {([['identity', '👤 Identité'], ['access', '🛡️ Accès'], ['security', '🔐 Sécurité']] as [EditTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── Onglet Identité ── */}
          {tab === 'identity' && (
            <>
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
                  <input type="email" value={form.email} disabled
                    className={`${inputCls} pl-8 opacity-50 cursor-not-allowed`} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">L'email ne peut pas être modifié — il sert d'identifiant Supabase.</p>
              </Field>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+33 6 00 00 00 00" className={`${inputCls} pl-8`} />
                </div>
              </Field>
              <button onClick={handleSaveIdentity} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </>
          )}

          {/* ── Onglet Accès ── */}
          {tab === 'access' && (
            <>
              <p className="text-xs text-muted-foreground">Cochez les rôles accordés à cet utilisateur. Un rôle détermine les sections accessibles dans l'espace membre.</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {ROLES.map(r => {
                  const selected = roles.includes(r);
                  return (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                        selected
                          ? 'bg-accent/10 border-accent/30 text-accent font-semibold'
                          : 'border-border text-foreground hover:bg-muted/40'
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-accent border-accent' : 'border-muted-foreground/40'}`}>
                        {selected && <Check className="w-2.5 h-2.5 text-accent-foreground" />}
                      </div>
                      {roleLabel(r)}
                    </button>
                  );
                })}
              </div>
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                  {roles.map(r => <RoleBadge key={r} role={r} />)}
                </div>
              )}
              <button onClick={handleSaveRoles} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
                <Shield className="w-3.5 h-3.5" /> {saving ? 'Sauvegarde...' : 'Appliquer les rôles'}
              </button>
            </>
          )}

          {/* ── Onglet Sécurité ── */}
          {tab === 'security' && (
            <>
              {/* Reset mot de passe */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-warning" /> Réinitialiser le mot de passe</h3>
                <p className="text-[10px] text-muted-foreground mb-3">Générez un nouveau mot de passe temporaire et communiquez-le à l'utilisateur.</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex-1 font-mono text-sm bg-warning/5 border border-warning/30 rounded-lg px-3 py-2 tracking-widest text-foreground">
                    {showResetPwd ? resetPwd : '••••••••••••'}
                  </span>
                  <button type="button" onClick={() => setShowResetPwd(v => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground">
                    {showResetPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(resetPwd); toast.success('Copié'); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setResetPwd(generatePassword())}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={handleResetPassword} disabled={resetting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning text-warning-foreground text-xs font-semibold disabled:opacity-50">
                  <Key className="w-3.5 h-3.5" /> {resetting ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
                </button>
              </div>

              {/* Statut du compte */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  {active ? <Lock className="w-3.5 h-3.5 text-muted-foreground" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                  Statut du compte
                </h3>
                <p className="text-[10px] text-muted-foreground mb-3">
                  {active
                    ? 'Suspendre empêche la connexion sans supprimer les données.'
                    : 'Le compte est actuellement suspendu. Réactiver pour rétablir l\'accès.'}
                </p>
                <button onClick={handleToggleActive} disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                    active
                      ? 'bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}>
                  {active ? <><UserX className="w-3.5 h-3.5" /> Suspendre le compte</> : <><UserCheck className="w-3.5 h-3.5" /> Réactiver le compte</>}
                </button>
              </div>

              {/* Zone dangereuse */}
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Zone dangereuse</h3>
                <p className="text-[10px] text-muted-foreground mb-3">La suppression est définitive — toutes les données associées seront perdues.</p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold hover:bg-destructive/20">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer définitivement
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-destructive">⚠️ Supprimer le compte de {user.first_name} {user.last_name} ?</p>
                    <div className="flex gap-2">
                      <button onClick={handleDelete} disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Suppression...' : 'Confirmer'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)}
                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Composants utilitaires partagés ───────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50';

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

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="bg-card rounded-xl border border-border shadow-2xl w-full"
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ModalHeader({ title, icon, onClose }: { title: string; icon?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
      {icon}
      <h2 className="text-sm font-bold text-foreground flex-1">{title}</h2>
      <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ComptesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const load = () => {
    setLoading(true);
    getAllAccounts()
      .then(data => setAccounts(data as Account[]))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Tri ──
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Filtres + tri ──
  const filtered = useMemo(() => {
    let list = accounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email} ${u.phone ?? ''} ${u.role}`.toLowerCase().includes(q)
      );
    }
    if (filterRole) list = list.filter(u => parseUserRoles(u.role).includes(filterRole));
    if (filterStatus === 'active') list = list.filter(u => isActive(u));
    if (filterStatus === 'inactive') list = list.filter(u => !isActive(u));

    list = [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === 'name') { va = `${a.last_name} ${a.first_name}`; vb = `${b.last_name} ${b.first_name}`; }
      else if (sortKey === 'email') { va = a.email; vb = b.email; }
      else if (sortKey === 'role') { va = a.role; vb = b.role; }
      else if (sortKey === 'status') { va = isActive(a) ? '1' : '0'; vb = isActive(b) ? '1' : '0'; }
      else { va = a.created_at ?? ''; vb = b.created_at ?? ''; }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return list;
  }, [accounts, search, filterRole, filterStatus, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = accounts.length;
    const actifs = accounts.filter(isActive).length;
    const inactifs = total - actifs;
    const rolesCount = new Map<string, number>();
    accounts.filter(isActive).forEach(u => {
      parseUserRoles(u.role).forEach(r => rolesCount.set(r, (rolesCount.get(r) ?? 0) + 1));
    });
    const topRole = [...rolesCount.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, actifs, inactifs, distinctRoles: rolesCount.size, topRole };
  }, [accounts]);

  // ── Export CSV ──
  const handleExport = () => {
    const rows = filtered.map(u => [
      `"${u.last_name}"`, `"${u.first_name}"`, `"${u.email}"`,
      `"${u.phone ?? ''}"`,
      `"${parseUserRoles(u.role).map(roleLabel).join(', ')}"`,
      `"${isActive(u) ? 'Actif' : 'Inactif'}"`,
      `"${formatDate(u.created_at)}"`,
    ].join(';'));
    const header = '"Nom";"Prénom";"Email";"Téléphone";"Rôles";"Statut";"Créé le"';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `comptes-aef-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    toast.success('Export CSV téléchargé');
  };

  // ── Colonne triable ──
  const SortTh = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <th className={`px-4 py-3 text-left cursor-pointer select-none hover:text-foreground transition-colors ${className}`} onClick={() => handleSort(k)}>
      <span className="flex items-center gap-1">
        {label}
        {sortKey === k
          ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔐 Gestion des comptes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Annuaire des utilisateurs · gestion des accès et des rôles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} title="Exporter la liste filtrée en CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau compte
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Comptes total', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: UserCheck, label: 'Actifs', value: stats.actifs, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { icon: UserX, label: 'Inactifs / Suspendus', value: stats.inactifs, color: 'text-muted-foreground', bg: 'bg-muted' },
          { icon: Shield, label: 'Rôles distincts', value: stats.distinctRoles, color: 'text-accent', bg: 'bg-accent/10' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kpi.bg}`}>
              <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{loading ? '—' : kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barre de contrôle ── */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-2 items-center">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone, rôle..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtre rôle */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-accent/50">
            <option value="">Tous les rôles</option>
            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>

        {/* Filtre statut */}
        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
              {{ all: 'Tous', active: '✅ Actifs', inactive: '⛔ Inactifs' }[s]}
            </button>
          ))}
        </div>

        {/* Résultats */}
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} / {accounts.length} compte{accounts.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Tableau ── */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Chargement des comptes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun compte ne correspond aux filtres.</p>
          {(search || filterRole || filterStatus !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('all'); }}
              className="text-xs text-accent hover:underline mt-2">Réinitialiser les filtres</button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <SortTh label="Utilisateur" k="name" className="pl-4 py-3 min-w-[200px]" />
                <SortTh label="Email" k="email" className="hidden sm:table-cell min-w-[180px]" />
                <th className="px-4 py-3 text-left">Rôles</th>
                <SortTh label="Statut" k="status" className="hidden md:table-cell w-24" />
                <SortTh label="Création" k="created_at" className="hidden lg:table-cell w-28" />
                <th className="px-4 py-3 text-right w-10">
                  <MoreHorizontal className="w-3.5 h-3.5 ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const roles = parseUserRoles(u.role);
                const active = isActive(u);
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    className={`border-t border-border hover:bg-muted/30 transition-colors ${!active ? 'opacity-60' : ''}`}>
                    {/* Utilisateur */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarCircle user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{u.first_name} {u.last_name}</p>
                          {u.phone && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{u.phone}</p>}
                        </div>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                    </td>
                    {/* Rôles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {roles.length > 0
                          ? roles.slice(0, 2).map(r => <RoleBadge key={r} role={r} />)
                          : <span className="text-xs text-muted-foreground">—</span>}
                        {roles.length > 2 && (
                          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border">+{roles.length - 2}</span>
                        )}
                      </div>
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <StatusBadge active={active} />
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(u.created_at)}</p>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ type: 'edit', user: u })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-auto"
                        title="Gérer ce compte">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {/* Pied de tableau */}
          <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} compte{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
              {filterStatus !== 'all' || filterRole || search ? ' (filtrés)' : ''}
            </p>
            <button onClick={load} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-3 h-3" /> Actualiser
            </button>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      <AnimatePresence>
        {modal.type === 'create' && (
          <CreateModal onClose={() => setModal({ type: 'none' })} onCreated={load} />
        )}
        {modal.type === 'edit' && (
          <EditModal user={modal.user} onClose={() => setModal({ type: 'none' })} onUpdated={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
