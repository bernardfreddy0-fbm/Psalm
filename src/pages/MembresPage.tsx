import { useEffect, useState } from 'react';
import { getMembers, createMember, deleteMember } from '@/lib/api';
import { Users, Plus, Trash2, Grid3X3, List, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const POLES = ['Tous', 'Pole Choriste', 'Pole Conducteur', 'Pole Musique', 'Pole Projection', 'Pole Sonorisation', 'Pole Video'];

const AVATAR_COLORS = [
  'bg-accent', 'bg-success', 'bg-destructive', 'bg-warning', 'bg-gold',
  'bg-info', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const roleLabel = (r: string) => r?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Membre';

const ROLES = [
  'conducteur_louange', 'responsable_louange', 'responsable_technique',
  'pasteur', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste', 'dev'
];

export default function MembresPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePole, setActivePole] = useState('Tous');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'choriste' });

  const load = () => {
    setLoading(true);
    getMembers().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMember(form);
    setForm({ first_name: '', last_name: '', email: '', role: 'choriste' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce membre ?')) return;
    await deleteMember(id);
    load();
  };

  const filtered = members.filter(m => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const uniqueRoles = new Set(members.map(m => m.role));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          👥 Membres
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          + Nouveau membre
        </button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex gap-6">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : members.length}</span><p className="text-xs text-muted-foreground">Membres total</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{loading ? '—' : filtered.length}</span><p className="text-xs text-muted-foreground">Affichés</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{uniqueRoles.size}</span><p className="text-xs text-muted-foreground">Cellules</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{loading ? '—' : members.length}</span><p className="text-xs text-muted-foreground">Actifs</p></div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {POLES.map(p => (
            <button
              key={p}
              onClick={() => setActivePole(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePole === p
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex border border-border rounded-md overflow-hidden ml-auto">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-muted' : 'bg-card'}`}>
            <Grid3X3 className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-muted' : 'bg-card'}`}>
            <List className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleCreate}
          className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Prénom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
          <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Nom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium">Créer</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
          </div>
        </motion.form>
      )}

      {/* Members grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun membre trouvé</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3' : 'space-y-2'}>
          {filtered.map((m, i) => {
            const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`;
            const color = getAvatarColor(`${m.first_name}${m.last_name}`);

            if (viewMode === 'list') {
              return (
                <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-[11px] font-bold text-card`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-card rounded-lg border border-border p-4 text-center relative group"
              >
                <button onClick={() => handleDelete(m.id)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-sm font-bold text-card mx-auto mb-2 ring-4 ring-card shadow-sm`}>
                  {initials}
                </div>
                <p className="text-sm font-semibold text-foreground">{m.first_name} {m.last_name}</p>
                <p className="text-[11px] text-muted-foreground mb-2">{roleLabel(m.role)}</p>
                <div className="flex flex-wrap gap-1 justify-center">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    {roleLabel(m.role)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">— présence</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
