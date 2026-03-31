import { useEffect, useState } from 'react';
import { getMembers, createMember, updateMember, deleteMember } from '@/lib/api';
import { MEMBER_REGISTRY, type MemberRecord } from '@/lib/membersData';
import { Users, Plus, Trash2, Grid3X3, List, Search, Pen, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLES = [
  'conducteur_louange', 'responsable_louange', 'responsable_technique',
  'pasteur', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste', 'dev'
];

const INSTRUMENTS = ['Piano', 'Guitare acoustique', 'Guitare électrique', 'Basse', 'Batterie', 'Clavier', 'Autre', ''];
const POLES = ['Tous', 'Choriste & Dirigeant', 'Musique', 'Sonorisation', 'Projection', 'Vidéo'];
const AVATAR_COLORS = ['bg-accent', 'bg-success', 'bg-destructive', 'bg-warning', 'bg-gold', 'bg-info', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const roleLabel = (r: string) => r?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Membre';

const POLE_MAP: Record<string, string> = {
  'Choriste & Dirigeant': 'choriste',
  'Musique': 'musique',
  'Sonorisation': 'sonorisation',
  'Projection': 'projection',
  'Vidéo': 'video',
};

const FUNCTION_LABELS: Record<string, string> = {
  dirigeant: 'Dirigeant',
  choriste: 'Choriste',
  musicien: 'Musicien',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
};

type EditMember = { id: string; first_name: string; last_name: string; email: string; role: string; instrument: string } | null;

export default function MembresPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePole, setActivePole] = useState('Tous');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'choriste', instrument: '' });
  const [editing, setEditing] = useState<EditMember>(null);

  const load = () => { setLoading(true); getMembers().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  // Merge API members with static registry for display
  const mergedMembers = (() => {
    // Use registry as primary source, enrich with API data if available
    const registryMembers = MEMBER_REGISTRY.filter(m => m.active).map(reg => {
      const apiMatch = members.find(m =>
        m.first_name?.toLowerCase() === reg.first_name.toLowerCase() &&
        m.last_name?.toLowerCase() === reg.last_name.toLowerCase()
      );
      return {
        id: apiMatch?.id || `reg-${reg.first_name}-${reg.last_name}`,
        first_name: reg.first_name,
        last_name: reg.last_name,
        email: apiMatch?.email || reg.email || '',
        phone: reg.phone || '',
        functions: reg.functions,
        instruments: reg.instruments,
        poles: reg.poles,
        role: apiMatch?.role || reg.functions.join(','),
        instrument: apiMatch?.instrument || reg.instruments.join(', '),
        experienced: reg.experienced,
        fromRegistry: true,
      };
    });

    // Add API members not in registry
    const apiOnly = members.filter(m =>
      !MEMBER_REGISTRY.find(r =>
        r.first_name.toLowerCase() === (m.first_name || '').toLowerCase() &&
        r.last_name.toLowerCase() === (m.last_name || '').toLowerCase()
      )
    ).map(m => ({
      ...m,
      functions: (m.role || '').split(',').map((r: string) => r.trim()).filter(Boolean),
      instruments: m.instrument ? [m.instrument.toLowerCase()] : [],
      poles: [] as string[],
      fromRegistry: false,
    }));

    return [...registryMembers, ...apiOnly];
  })();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMember(form);
    setForm({ first_name: '', last_name: '', email: '', role: 'choriste', instrument: '' });
    setShowForm(false);
    load();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    await updateMember(editing.id, { first_name: editing.first_name, last_name: editing.last_name, email: editing.email, role: editing.role, instrument: editing.instrument });
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await deleteMember(id); load(); };

  const filtered = mergedMembers.filter(m => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.email} ${m.functions.join(' ')}`.toLowerCase().includes(search.toLowerCase());
    const matchPole = activePole === 'Tous' || (m.poles && m.poles.includes(POLE_MAP[activePole] || ''));
    return matchSearch && matchPole;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">👥 Membres</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          + Nouveau membre
        </button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex gap-6">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : mergedMembers.length}</span><p className="text-xs text-muted-foreground">Total</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{loading ? '—' : filtered.length}</span><p className="text-xs text-muted-foreground">Affichés</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{new Set(mergedMembers.flatMap(m => m.functions || [])).size}</span><p className="text-xs text-muted-foreground">Fonctions</p></div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {POLES.map(p => (
            <button key={p} onClick={() => setActivePole(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activePole === p ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex border border-border rounded-md overflow-hidden ml-auto">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-muted' : 'bg-card'}`}><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-muted' : 'bg-card'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate} className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Prénom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Nom" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
              {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <select value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
              <option value="">Instrument (optionnel)</option>
              {INSTRUMENTS.filter(Boolean).map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium">Créer</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-lg border border-border p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Modifier le membre</h3>
                <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <input value={editing.first_name} onChange={e => setEditing({ ...editing, first_name: e.target.value })} placeholder="Prénom" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.last_name} onChange={e => setEditing({ ...editing, last_name: e.target.value })} placeholder="Nom" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
                <select value={editing.instrument} onChange={e => setEditing({ ...editing, instrument: e.target.value })} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="">Instrument</option>
                  {INSTRUMENTS.filter(Boolean).map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleUpdate} className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sauvegarder</button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members */}
      {loading ? <p className="text-sm text-muted-foreground">Chargement...</p> : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucun membre</p></div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3' : 'space-y-2'}>
          {filtered.map((m, i) => {
            const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`;
            const color = getAvatarColor(`${m.first_name}${m.last_name}`);

            if (viewMode === 'list') return (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-[11px] font-bold text-card`}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-muted-foreground">{(m.functions || []).map((f: string) => FUNCTION_LABELS[f] || f).join(' · ')}{m.instruments?.length > 0 ? ` · ${m.instruments.join(', ')}` : ''}</p>
                </div>
                <button onClick={() => setEditing({ id: m.id, first_name: m.first_name || '', last_name: m.last_name || '', email: m.email || '', role: m.role || 'choriste', instrument: m.instrument || '' })}
                  className="p-1.5 rounded text-accent hover:bg-accent/10"><Pen className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </motion.div>
            );

            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-lg border border-border p-4 text-center relative group">
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing({ id: m.id, first_name: m.first_name || '', last_name: m.last_name || '', email: m.email || '', role: m.role || 'choriste', instrument: m.instrument || '' })}
                    className="p-1 rounded text-accent hover:bg-accent/10"><Pen className="w-3 h-3" /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
                <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-sm font-bold text-card mx-auto mb-2 ring-4 ring-card shadow-sm`}>{initials}</div>
                <p className="text-sm font-semibold text-foreground">{m.first_name} {m.last_name}</p>
                <p className="text-[11px] text-muted-foreground mb-2">{roleLabel(m.role)}</p>
                {m.instrument && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">🎵 {m.instrument}</span>}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
