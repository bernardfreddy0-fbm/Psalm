import { useEffect, useState } from 'react';
import { getSongs, createSong, updateSong, deleteSong } from '@/lib/api';
import { Music, Plus, Trash2, Search, Pen, Eye, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TONALITIES = ['Tous', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];
const TAGS = ['Tous', 'Louange', 'Adoration', 'Jeunesse', 'Cantique', 'Communion', 'Offrande'];

type EditSong = { id: string; title: string; author: string; key: string; tempo: string; tags: string } | null;

export default function ChantsPage() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tonality, setTonality] = useState('Tous');
  const [tagFilter, setTagFilter] = useState('Tous');
  const [sortOrder, setSortOrder] = useState('A → Z');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', key: '', tempo: '', tags: '' });
  const [editing, setEditing] = useState<EditSong>(null);

  const load = () => { setLoading(true); getSongs().then(setSongs).catch(() => setSongs([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSong(form);
    setForm({ title: '', author: '', key: '', tempo: '', tags: '' });
    setShowForm(false);
    load();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    await updateSong(editing.id, { title: editing.title, author: editing.author, key: editing.key, tempo: editing.tempo, tags: editing.tags });
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await deleteSong(id); load(); };

  const filtered = songs.filter(s => {
    const matchSearch = `${s.title} ${s.author}`.toLowerCase().includes(search.toLowerCase());
    const matchKey = tonality === 'Tous' || s.key === tonality;
    const matchTag = tagFilter === 'Tous' || (s.tags || '').toLowerCase().includes(tagFilter.toLowerCase());
    return matchSearch && matchKey && matchTag;
  });

  const sorted = [...filtered].sort((a, b) =>
    sortOrder === 'A → Z' ? (a.title || '').localeCompare(b.title || '') : (b.title || '').localeCompare(a.title || '')
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🎵 Bibliothèque de Chants</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          + Ajouter un chant
        </button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex gap-6">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : songs.length}</span><p className="text-xs text-muted-foreground">Chants au total</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{loading ? '—' : sorted.length}</span><p className="text-xs text-muted-foreground">Affichés</p></div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher titre, auteur..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div className="flex gap-1.5">
            {TONALITIES.map(t => (
              <button key={t} onClick={() => setTonality(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tonality === t ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{t}</button>
            ))}
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="px-3 py-1.5 rounded-md border border-input bg-background text-xs ml-auto">
            <option>A → Z</option><option>Z → A</option>
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase self-center mr-1">Tags:</span>
          {TAGS.map(t => (
            <button key={t} onClick={() => setTagFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${tagFilter === t ? 'bg-gold text-gold-foreground' : 'bg-muted text-muted-foreground'}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate} className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="Auteur" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <select value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
              <option value="">Tonalité</option>{TONALITIES.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={form.tempo} onChange={e => setForm({ ...form, tempo: e.target.value })} placeholder="Tempo (BPM)" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags (ex: Louange, Adoration)" className="px-3 py-2 rounded-md border border-input bg-background text-sm sm:col-span-2" />
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
                <h3 className="text-sm font-bold text-foreground">Modifier le chant</h3>
                <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Titre" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.author} onChange={e => setEditing({ ...editing, author: e.target.value })} placeholder="Auteur" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <select value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="">Tonalité</option>{TONALITIES.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={editing.tempo} onChange={e => setEditing({ ...editing, tempo: e.target.value })} placeholder="Tempo" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.tags} onChange={e => setEditing({ ...editing, tags: e.target.value })} placeholder="Tags" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleUpdate} className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sauvegarder</button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? <p className="text-sm text-muted-foreground">Chargement...</p> : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Music className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{search ? 'Aucun résultat' : 'Aucun chant'}</p></div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <div className="col-span-4">Titre / Auteur</div><div className="col-span-1 text-center">Tonalité</div>
            <div className="col-span-1 text-center">Tempo</div><div className="col-span-2 text-center">Tags</div>
            <div className="col-span-2 text-center">Catégorie</div><div className="col-span-2 text-center">Actions</div>
          </div>
          {sorted.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
              className="grid grid-cols-12 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors group">
              <div className="col-span-4"><p className="text-sm font-semibold text-foreground">{s.title}</p>{s.author && <p className="text-xs text-muted-foreground">{s.author}</p>}</div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">{s.key || '—'}</div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">{s.tempo || '—'}</div>
              <div className="col-span-2 text-center">{s.tags ? s.tags.split(',').map((t: string) => (
                <span key={t.trim()} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium mr-1 mb-0.5">{t.trim()}</span>
              )) : <span className="text-xs text-muted-foreground">—</span>}</div>
              <div className="col-span-2 text-center text-xs text-muted-foreground">—</div>
              <div className="col-span-2 flex items-center justify-center gap-1">
                <button onClick={() => setEditing({ id: s.id, title: s.title || '', author: s.author || '', key: s.key || '', tempo: s.tempo || '', tags: s.tags || '' })}
                  className="p-1 rounded text-accent hover:bg-accent/10"><Pen className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
