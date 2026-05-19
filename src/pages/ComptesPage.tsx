import { useEffect, useState } from 'react';
import { getMembers, updateMember, createMember, deleteMember, resetMemberPassword } from '@/lib/api';
import { Search, Shield, Key, X, Check, Plus, Trash2, Copy, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ROLES = [
  'conducteur_louange', 'responsable_technique',
  'pasteur', 'choriste',
  'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste',
  'sonorisateur', 'projectionniste', 'videaste', 'dev'
];

// Client display normalization
const normalizeRole = (role: string) => role === 'responsable_louange' ? 'conducteur_louange' : role;

// Reverse: convert back to API format before saving
const toApiRole = (role: string) => role === 'conducteur_louange' ? 'responsable_louange' : role;

const roleLabel = (r: string) => normalizeRole(r)?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Membre';

const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-destructive/10 text-destructive',
  responsable_louange: 'bg-accent/10 text-accent',
  conducteur_louange: 'bg-accent/10 text-accent',
  dev: 'bg-foreground/10 text-foreground',
  choriste: 'bg-success/10 text-success',
  musicien: 'bg-gold/10 text-gold',
  pianiste: 'bg-gold/10 text-gold',
  batteur: 'bg-gold/10 text-gold',
  guitariste_electrique: 'bg-gold/10 text-gold',
  guitariste_acoustique: 'bg-gold/10 text-gold',
  bassiste: 'bg-gold/10 text-gold',
  sonorisateur: 'bg-info/10 text-info',
  projectionniste: 'bg-warning/10 text-warning',
  videaste: 'bg-purple-500/10 text-purple-600',
  responsable_technique: 'bg-info/10 text-info',
};

function parseUserRoles(role: string): string[] {
  if (!role) return [];

  return Array.from(new Set(role.split(',').map(r => normalizeRole(r.trim())).filter(Boolean)));
}

function isVisibleUser(user: any): boolean {
  return String(user?.is_active ?? 1) !== '0' && user?.first_name !== '[Supprimé]';
}

type AccountUser = {
  id: string | number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active?: string | number;
};

type EditUser = { id: string; email: string; roles: string[] } | null;
type ResetModal = { id: string; name: string; newPassword: string } | null;

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ComptesPage() {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditUser>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', email: '', role: 'choriste' });
  const [resetModal, setResetModal] = useState<ResetModal>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = () => {
    setLoading(true);
    getMembers()
      .then(data => setUsers(data.filter(isVisibleUser)))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpdateRole = async () => {
    if (!editing) return;

    const nextRoles = Array.from(
      new Set(editing.roles.map(r => toApiRole(normalizeRole(r))).filter(Boolean))
    );
    const nextRoleValue = nextRoles.join(',');

    try {
      await updateMember(editing.id, { role: nextRoleValue });
      toast.success('Rôles mis à jour');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(`Erreur : ${err?.message || 'inconnue'}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMember(createForm);
      toast.success('Compte créé');
      setCreateForm({ first_name: '', last_name: '', email: '', role: 'choriste' });
      setShowCreate(false);
      load();
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  const handleDelete = async (id: string | number, name: string) => {
    if (!confirm(`Supprimer définitivement le compte de ${name} ?`)) return;

    try {
      await deleteMember(String(id));
      setUsers(prev => prev.filter(user => String(user.id) !== String(id)));
      toast.success('Compte supprimé');
    } catch (err: any) {
      toast.error(`Erreur lors de la suppression: ${err?.message || 'inconnue'}`);
    }
  };

  const openResetModal = (id: string | number, name: string) => {
    setShowPassword(false);
    setResetConfirming(false);
    setResetModal({ id: String(id), name, newPassword: generatePassword() });
  };

  const handleConfirmReset = async () => {
    if (!resetModal) return;
    setResetConfirming(true);
    try {
      await resetMemberPassword(resetModal.id, resetModal.newPassword);
      toast.success(`Mot de passe réinitialisé pour ${resetModal.name}`);
      setResetModal(null);
    } catch (err: any) {
      toast.error(`Erreur : ${err?.message || 'inconnue'}`);
    } finally {
      setResetConfirming(false);
    }
  };

  const handleToggleActive = async (id: string | number, name: string, currentActive: boolean) => {
    const action = currentActive ? 'désactiver' : 'réactiver';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} le compte de ${name} ?`)) return;
    try {
      await updateMember(String(id), { is_active: !currentActive });
      toast.success(`Compte ${currentActive ? 'désactivé' : 'réactivé'}`);
      load();
    } catch (err: any) {
      toast.error(`Erreur : ${err?.message || 'inconnue'}`);
    }
  };

  const toggleRole = (role: string) => {
    const normalizedRole = normalizeRole(role);
    if (!editing) return;

    setEditing(prev => {
      if (!prev) return prev;
      const has = prev.roles.includes(normalizedRole);
      return {
        ...prev,
        roles: has ? prev.roles.filter(r => r !== normalizedRole) : [...prev.roles, normalizedRole],
      };
    });
  };

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔐 Gestion des comptes</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <Plus className="w-4 h-4" /> Nouveau compte
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate} className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
            <input value={createForm.first_name} onChange={e => setCreateForm({ ...createForm, first_name: e.target.value })} placeholder="Prénom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input value={createForm.last_name} onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })} placeholder="Nom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="Email" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
              {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium">Créer</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex gap-6">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : users.length}</span><p className="text-xs text-muted-foreground">Utilisateurs</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{new Set(users.flatMap(u => parseUserRoles(u.role))).size}</span><p className="text-xs text-muted-foreground">Rôles distincts</p></div>
      </div>

      <div className="bg-card rounded-lg border border-border p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un utilisateur..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
      </div>

      {/* Edit roles modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-lg border border-border p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Modifier les rôles</h3>
                <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{editing.email}</p>
              <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                {ROLES.map(r => {
                  const selected = editing.roles.includes(r);
                  return (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${
                        selected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      }`}>
                      <span>{roleLabel(r)}</span>
                      {selected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {editing.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {editing.roles.map(r => (
                    <span key={r} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>
                      {roleLabel(r)}
                      <button type="button" onClick={() => toggleRole(r)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleUpdateRole} className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sauvegarder</button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reset password modal ── */}
      <AnimatePresence>
        {resetModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4"
            onClick={() => !resetConfirming && setResetModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 w-full max-w-sm shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Key className="w-4 h-4 text-warning" /> Réinitialiser le mot de passe
                </h3>
                <button onClick={() => setResetModal(null)} disabled={resetConfirming}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Un nouveau mot de passe sera attribué à <strong>{resetModal.name}</strong>.
                Notez-le avant de confirmer — il ne sera plus visible ensuite.
              </p>

              {/* Password display */}
              <div className="mb-4">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Nouveau mot de passe généré
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-warning/40 bg-warning/5 font-mono text-sm">
                    <span className="flex-1 select-all tracking-widest">
                      {showPassword ? resetModal.newPassword : '••••••••••'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetModal.newPassword);
                      toast.success('Mot de passe copié !');
                    }}
                    className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copier"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleConfirmReset}
                  disabled={resetConfirming}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-warning text-warning-foreground text-sm font-semibold disabled:opacity-50 hover:bg-warning/90 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  {resetConfirming ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
                </button>
                <button
                  onClick={() => setResetModal(null)}
                  disabled={resetConfirming}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <p className="text-sm text-muted-foreground">Chargement...</p> : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <div className="col-span-1">#</div><div className="col-span-3">Nom</div><div className="col-span-3">Email</div>
            <div className="col-span-2">Rôles</div><div className="col-span-3 text-right">Actions</div>
          </div>
          {filtered.map((u, i) => {
            const roles = parseUserRoles(u.role);
            return (
              <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30">
                <div className="col-span-1 text-xs text-muted-foreground">{i + 1}</div>
                <div className="col-span-3 text-sm font-medium text-foreground">{u.first_name} {u.last_name}</div>
                <div className="col-span-3 text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="col-span-2 flex flex-wrap gap-0.5">
                  {roles.length > 0 ? roles.map(r => (
                    <span key={r} className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>
                      {roleLabel(r)}
                    </span>
                  )) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-3 flex gap-1 justify-end flex-wrap">
                  <button onClick={() => setEditing({ id: String(u.id), email: u.email, roles: roles.length > 0 ? roles : ['choriste'] })}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-accent hover:bg-accent/10">
                    <Shield className="w-3 h-3" /> Rôles
                  </button>
                  <button onClick={() => openResetModal(u.id, `${u.first_name} ${u.last_name}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-warning hover:bg-warning/10">
                    <Key className="w-3 h-3" /> Reset MDP
                  </button>
                  <button
                    onClick={() => handleToggleActive(u.id, `${u.first_name} ${u.last_name}`, String(u.is_active ?? 1) !== '0')}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted"
                    title={String(u.is_active ?? 1) !== '0' ? 'Désactiver le compte' : 'Réactiver le compte'}
                  >
                    {String(u.is_active ?? 1) !== '0'
                      ? <><UserX className="w-3 h-3" /> Désactiver</>
                      : <><UserCheck className="w-3 h-3" /> Activer</>
                    }
                  </button>
                  <button onClick={() => handleDelete(u.id, `${u.first_name} ${u.last_name}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
