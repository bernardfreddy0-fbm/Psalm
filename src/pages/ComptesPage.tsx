import { useEffect, useState } from 'react';
import { getMembers, updateMember } from '@/lib/api';
import { Search, Shield, Key, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLES = [
  'conducteur_louange', 'responsable_louange', 'responsable_technique',
  'pasteur', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste', 'dev'
];
const roleLabel = (r: string) => r?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Membre';

const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-destructive/10 text-destructive',
  responsable_louange: 'bg-accent/10 text-accent',
  conducteur_louange: 'bg-accent/10 text-accent',
  dev: 'bg-foreground/10 text-foreground',
  choriste: 'bg-success/10 text-success',
  musicien: 'bg-gold/10 text-gold',
  sonorisateur: 'bg-info/10 text-info',
  projectionniste: 'bg-warning/10 text-warning',
  videaste: 'bg-purple-500/10 text-purple-600',
  responsable_technique: 'bg-info/10 text-info',
};

function parseUserRoles(role: string): string[] {
  if (!role) return [];
  return role.split(',').map(r => r.trim()).filter(Boolean);
}

type EditUser = { id: string; email: string; roles: string[] } | null;

export default function ComptesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditUser>(null);

  const load = () => { setLoading(true); getMembers().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleUpdateRole = async () => {
    if (!editing) return;
    await updateMember(editing.id, { role: editing.roles.join(',') });
    setEditing(null);
    load();
  };

  const toggleRole = (role: string) => {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      const has = prev.roles.includes(role);
      return { ...prev, roles: has ? prev.roles.filter(r => r !== role) : [...prev.roles, role] };
    });
  };

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔐 Gestion des comptes</h1>
      </div>

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
                      <button onClick={() => toggleRole(r)}><X className="w-3 h-3" /></button>
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
                <div className="col-span-3 flex gap-1 justify-end">
                  <button onClick={() => setEditing({ id: u.id, email: u.email, roles: roles.length > 0 ? roles : ['choriste'] })}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-accent hover:bg-accent/10">
                    <Shield className="w-3 h-3" /> Rôles
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-warning hover:bg-warning/10">
                    <Key className="w-3 h-3" /> Reset MDP
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
