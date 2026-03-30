import { useEffect, useState } from 'react';
import { getSongs, createSong, deleteSong } from '@/lib/api';
import { Music, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChantsPage() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [search, setSearch] = useState('');

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
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Chants</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un chant..."
        className="w-full px-4 py-2.5 rounded-md border border-input bg-card text-sm text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleCreate}
          className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-3"
        >
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre"
            className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground flex-1 min-w-[150px]" required />
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Auteur"
            className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground flex-1 min-w-[150px]" />
          <button type="submit" className="px-4 py-2 rounded-md bg-success text-success-foreground text-sm font-medium">Créer</button>
        </motion.form>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'Aucun résultat' : 'Aucun chant'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-card rounded-lg border border-border p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-gold/10 flex items-center justify-center">
                  <Music className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{s.title}</p>
                  {s.author && <p className="text-xs text-muted-foreground">{s.author}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
