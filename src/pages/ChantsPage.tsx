import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSongs, createSong, updateSong, deleteSong, uploadPartition, deletePartition, getSongFolders, type AdminSong } from '@/lib/api';
import { Music, Trash2, Search, Pen, X, Check, Link, FileText, Volume2, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = 'https://api-psalm.a-e-f.fr';
const TONALITIES = ['Tous', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];

type FormState = { title: string; author: string; key: string; tempo: string; tags: string; link: string; audio_url: string; folder: string };
const emptyForm: FormState = { title: '', author: '', key: '', tempo: '', tags: '', link: '', audio_url: '', folder: '' };

export default function ChantsPage() {
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tonality, setTonality] = useState('Tous');
  const [folderFilter, setFolderFilter] = useState('Tous');
  const [sortOrder, setSortOrder] = useState('A → Z');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<AdminSong | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getSongs(), getSongFolders()])
      .then(([s, f]) => { setSongs(s as AdminSong[]); setFolders(f); })
      .catch(() => { setSongs([]); setFolders([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSong(form as any);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error('Erreur lors de la création', { description: (err as Error).message });
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await updateSong(editing.id, {
        title: editing.title || '',
        author: editing.author || '',
        key: editing.key || '',
        tempo: editing.tempo || '',
        tags: editing.tags || '',
        link: editing.link || '',
        audio_url: editing.audio_url || '',
        folder: editing.folder || '',
      });
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour', { description: (err as Error).message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce chant ?')) return;
    await deleteSong(id);
    load();
  };

  const handlePartitionUpload = async (song: AdminSong, file: File) => {
    setUploadingId(song.id);
    try {
      await uploadPartition(song.id, file);
      load();
    } catch (err) {
      alert('Erreur lors du téléchargement : ' + (err as Error).message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeletePartition = async (song: AdminSong) => {
    if (!confirm('Supprimer la partition ?')) return;
    await deletePartition(song.id);
    load();
  };

  const filtered = songs.filter(s => {
    const matchSearch = `${s.title} ${s.author || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchKey = tonality === 'Tous' || s.key === tonality;
    const matchFolder = folderFilter === 'Tous' || s.folder === folderFilter;
    return matchSearch && matchKey && matchFolder;
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
        <div className="border-l border-border pl-6">
          <span className="text-2xl font-bold text-foreground">{loading ? '—' : songs.filter(s => s.partition_url).length}</span>
          <p className="text-xs text-muted-foreground">Avec partition · {loading ? '—' : folders.length} dossiers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher titre, auteur..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TONALITIES.map(t => (
              <button key={t} onClick={() => setTonality(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tonality === t ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{t}</button>
            ))}
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="px-3 py-1.5 rounded-md border border-input bg-background text-xs ml-auto">
            <option>A → Z</option><option>Z → A</option>
          </select>
        </div>
        {folders.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase self-center mr-1">Dossier:</span>
            {['Tous', ...folders].map(f => (
              <button key={f} onClick={() => setFolderFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${folderFilter === f ? 'bg-gold text-gold-foreground' : 'bg-muted text-muted-foreground'}`}>{f}</button>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate} className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre *" className="px-3 py-2 rounded-md border border-input bg-background text-sm" required />
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="Auteur" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <select value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
              <option value="">Tonalité</option>{TONALITIES.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={form.tempo} onChange={e => setForm({ ...form, tempo: e.target.value })} placeholder="Tempo (BPM)" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags (ex: Louange, Adoration)" className="px-3 py-2 rounded-md border border-input bg-background text-sm sm:col-span-2" />
            <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="Lien (YouTube...)" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <input value={form.audio_url} onChange={e => setForm({ ...form, audio_url: e.target.value })} placeholder="URL audio (SoundCloud, Drive...)" className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <input value={form.folder} onChange={e => setForm({ ...form, folder: e.target.value })} placeholder="Dossier (ex: Adoration, Jeunesse)" className="px-3 py-2 rounded-md border border-input bg-background text-sm sm:col-span-2" />
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
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-lg border border-border p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Modifier le chant</h3>
                <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3">
                <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Titre" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.author || ''} onChange={e => setEditing({ ...editing, author: e.target.value })} placeholder="Auteur" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <select value={editing.key || ''} onChange={e => setEditing({ ...editing, key: e.target.value })} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="">Tonalité</option>{TONALITIES.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={editing.tempo || ''} onChange={e => setEditing({ ...editing, tempo: e.target.value })} placeholder="Tempo" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.tags || ''} onChange={e => setEditing({ ...editing, tags: e.target.value })} placeholder="Tags" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.link || ''} onChange={e => setEditing({ ...editing, link: e.target.value })} placeholder="Lien YouTube..." className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.audio_url || ''} onChange={e => setEditing({ ...editing, audio_url: e.target.value })} placeholder="URL audio" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                <input value={editing.folder || ''} onChange={e => setEditing({ ...editing, folder: e.target.value })} placeholder="Dossier" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
                {/* Partition section */}
                <div className="border border-border rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">Partition PDF</p>
                  {editing.partition_url ? (
                    <div className="flex items-center gap-2">
                      <a href={editing.partition_url!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-accent hover:underline">
                        <FileText className="w-3.5 h-3.5" /> Voir la partition
                      </a>
                      <button onClick={() => handleDeletePartition(editing)} className="text-xs text-destructive hover:underline ml-auto">Supprimer</button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune partition</p>
                  )}
                  <label className="block cursor-pointer">
                    <span className="text-xs text-muted-foreground">
                      {uploadingId === editing.id ? 'Téléchargement en cours...' : 'Ajouter / remplacer (PDF, max 5 Mo)'}
                    </span>
                    <input type="file" accept=".pdf,application/pdf" className="hidden"
                      disabled={uploadingId === editing.id}
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f && editing) {
                          await handlePartitionUpload(editing, f);
                          setEditing(prev => prev ? { ...prev } : null);
                        }
                      }} />
                  </label>
                </div>
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
            <div className="col-span-4">Titre / Auteur</div>
            <div className="col-span-1 text-center">Ton.</div>
            <div className="col-span-2">Dossier</div>
            <div className="col-span-2">Tags</div>
            <div className="col-span-3 text-center">Actions</div>
          </div>
          {sorted.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
              className="grid grid-cols-12 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors group">
              <div className="col-span-4">
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                {s.author && <p className="text-xs text-muted-foreground">{s.author}</p>}
              </div>
              <div className="col-span-1 text-center text-xs text-muted-foreground">{s.key || '—'}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{s.folder ? (
                <span className="flex items-center gap-1"><Folder className="w-3 h-3 shrink-0" />{s.folder}</span>
              ) : '—'}</div>
              <div className="col-span-2">{s.tags ? s.tags.split(',').slice(0, 2).map((t: string) => (
                <span key={t.trim()} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium mr-1 mb-0.5">{t.trim()}</span>
              )) : <span className="text-xs text-muted-foreground">—</span>}</div>
              <div className="col-span-3 flex items-center justify-center gap-1">
                {s.partition_url && (
                  <a href={s.partition_url} target="_blank" rel="noreferrer"
                    className="p-1 rounded text-green-600 hover:bg-green-50" title="Voir partition"><FileText className="w-3.5 h-3.5" /></a>
                )}
                {s.audio_url && (
                  <a href={s.audio_url} target="_blank" rel="noreferrer"
                    className="p-1 rounded text-blue-600 hover:bg-blue-50" title="Écouter"><Volume2 className="w-3.5 h-3.5" /></a>
                )}
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer"
                    className="p-1 rounded text-muted-foreground hover:text-accent" title="Lien"><Link className="w-3.5 h-3.5" /></a>
                )}
                <button onClick={() => setEditing({ ...s })}
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
