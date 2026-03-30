import { useEffect, useState } from 'react';
import { getSongs, createSong, deleteSong } from '@/lib/api';
import { Music, Plus, Trash2, Search, Pen, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

const TONALITIES = ['Tous', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];

export default function ChantsPage() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tonality, setTonality] = useState('Tous');
  const [sortOrder, setSortOrder] = useState('A → Z');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const load = () => {
    setLoading(true);
    getSongs().then(setSongs).catch(() => setSongs([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSong(title, author);
    setTitle('');
    setAuthor('');
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce chant ?')) return;
    await deleteSong(id);
    load();
  };

  const filtered = songs.filter(s =>
    `${s.title} ${s.author}`.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'A → Z') return (a.title || '').localeCompare(b.title || '');
    return (b.title || '').localeCompare(a.title || '');
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          🎵 Bibliothèque de Chants
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          + Ajouter un chant
        </button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex gap-6">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : songs.length}</span><p className="text-xs text-muted-foreground">Chants au total</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{loading ? '—' : sorted.length}</span><p className="text-xs text-muted-foreground">Affichés</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">0</span><p className="text-xs text-muted-foreground">Utilisés récemment</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">1</span><p className="text-xs text-muted-foreground">Tonalités différentes</p></div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher titre, auteur..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex gap-1.5">
          {TONALITIES.map(t => (
            <button
              key={t}
              onClick={() => setTonality(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tonality === t
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded-md border border-input bg-background text-xs"
        >
          <option>A → Z</option>
          <option>Z → A</option>
        </select>
      </div>

      {/* Add form */}
      {showForm && (
        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleCreate}
          className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du chant"
            className="px-3 py-2 rounded-md border border-input bg-background text-sm flex-1 min-w-[200px]" required />
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Auteur"
            className="px-3 py-2 rounded-md border border-input bg-background text-sm flex-1 min-w-[150px]" />
          <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium">Créer</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm">Annuler</button>
        </motion.form>
      )}

      {/* Songs table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'Aucun résultat' : 'Aucun chant'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-0 px-4 py-3 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <div className="col-span-5">Titre / Auteur</div>
            <div className="col-span-1 text-center">Tonalité</div>
            <div className="col-span-1 text-center">Tempo</div>
            <div className="col-span-1 text-center">Durée</div>
            <div className="col-span-2 text-center">Catégorie</div>
            <div className="col-span-2 text-center">Utilisations</div>
          </div>
          {/* Rows */}
          {sorted.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.015 }}
              className="grid grid-cols-12 gap-0 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors group"
            >
              <div className="col-span-5">
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                {s.author && <p className="text-xs text-muted-foreground">{s.author}</p>}
              </div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">—</div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">—</div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">—</div>
              <div className="col-span-2 text-center text-xs text-muted-foreground">—</div>
              <div className="col-span-2 flex items-center justify-center gap-1">
                <button className="p-1 rounded opacity-60 hover:opacity-100 text-muted-foreground"><Eye className="w-3.5 h-3.5" /></button>
                <button className="p-1 rounded opacity-60 hover:opacity-100 text-gold"><Pen className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
