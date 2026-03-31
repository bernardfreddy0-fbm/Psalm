import { useEffect, useState, useMemo, useRef } from 'react';
import { getPlanning, getSongs, getMembers } from '@/lib/api';
import { Music, Plus, Minus, X, ChevronUp, ChevronDown, Search, Save, RefreshCw, Printer, FileText, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const KEYS = ['Tous', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];

interface ProgramSong {
  id: string;
  songId: string;
  title: string;
  author?: string;
  key?: string;
}

interface ProgramData {
  date: string;
  heure: string;
  predicateur: string;
  conducteur: string;
  titre: string;
  reference: string;
  nbChants: number;
  notes: string;
  songs: ProgramSong[];
}

const emptyProgram = (): ProgramData => ({
  date: new Date().toISOString().split('T')[0],
  heure: '',
  predicateur: '',
  conducteur: '',
  titre: '',
  reference: '',
  nbChants: 5,
  notes: '',
  songs: [],
});

export default function ProgrammePage() {
  const [step, setStep] = useState(1);
  const [songs, setSongs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [sundays, setSundays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<ProgramData>(emptyProgram());
  const [songSearch, setSongSearch] = useState('');
  const [keyFilter, setKeyFilter] = useState('Tous');
  const [previewTab, setPreviewTab] = useState<'congregation' | 'equipe' | 'conducteur'>('congregation');

  useEffect(() => {
    setLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      getSongs().catch(() => []),
      getMembers().catch(() => []),
      getPlanning(year).catch(() => []),
    ]).then(([so, m, su]) => {
      setSongs(so);
      setMembers(m);
      setSundays(su);
      // Auto-select next sunday date
      const today = new Date().toISOString().split('T')[0];
      const next = su.filter((s: any) => s.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date))[0];
      if (next) {
        setProgram(p => ({ ...p, date: next.date, conducteur: next.dirigeant || '' }));
      }
    }).finally(() => setLoading(false));
  }, []);

  const formatDateLong = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  const filteredSongs = useMemo(() => {
    return songs.filter(s => {
      const matchSearch = !songSearch || `${s.title} ${s.author || ''}`.toLowerCase().includes(songSearch.toLowerCase());
      const matchKey = keyFilter === 'Tous' || (s.key || '').toLowerCase().startsWith(keyFilter.toLowerCase());
      return matchSearch && matchKey;
    });
  }, [songs, songSearch, keyFilter]);

  const addSong = (song: any) => {
    if (program.songs.length >= program.nbChants) {
      toast.error(`Maximum ${program.nbChants} chants atteint`);
      return;
    }
    if (program.songs.find(s => s.songId === song.id)) {
      toast.info('Chant déjà dans le programme');
      return;
    }
    const item: ProgramSong = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      songId: song.id,
      title: song.title,
      author: song.author,
      key: song.key,
    };
    setProgram(p => ({ ...p, songs: [...p.songs, item] }));
    toast.success(`"${song.title}" ajouté`);
  };

  const removeSong = (id: string) => {
    setProgram(p => ({ ...p, songs: p.songs.filter(s => s.id !== id) }));
  };

  const moveSong = (idx: number, dir: 'up' | 'down') => {
    const newSongs = [...program.songs];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newSongs.length) return;
    [newSongs[idx], newSongs[swapIdx]] = [newSongs[swapIdx], newSongs[idx]];
    setProgram(p => ({ ...p, songs: newSongs }));
  };

  const handleSave = () => {
    toast.success('Programme sauvegardé (brouillon local)');
  };

  const handlePrint = (type: string) => {
    toast.info(`Impression ${type} — utilisez Ctrl+P / Cmd+P`);
    window.print();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Informations' },
    { num: 2, label: 'Chants' },
    { num: 3, label: 'Aperçu & Export' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🎵 Programme du Culte</h1>
          <p className="text-xs text-muted-foreground">
            {program.date ? `Programme · ${formatDateLong(program.date)}` : 'Nouveau programme'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
            <Save className="w-3.5 h-3.5" /> Brouillon
          </button>
          <button onClick={() => setStep(3)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            Aperçu PDF <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left sidebar: Steps */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Étapes</p>
            <div className="space-y-1">
              {steps.map(s => (
                <button key={s.num} onClick={() => setStep(s.num)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-all flex items-center gap-2.5 ${
                    step === s.num
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === s.num ? 'bg-primary-foreground/20' : 'bg-muted'
                  }`}>{s.num}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepInformations program={program} setProgram={setProgram} members={members} sundays={sundays} />
                <div className="flex justify-end mt-4">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    Choisir les chants <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepChants
                  program={program}
                  filteredSongs={filteredSongs}
                  songSearch={songSearch}
                  setSongSearch={setSongSearch}
                  keyFilter={keyFilter}
                  setKeyFilter={setKeyFilter}
                  addSong={addSong}
                  removeSong={removeSong}
                  moveSong={moveSong}
                />
                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Informations
                  </button>
                  <button onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    Aperçu & Export <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepPreview
                  program={program}
                  previewTab={previewTab}
                  setPreviewTab={setPreviewTab}
                  handlePrint={handlePrint}
                  handleSave={handleSave}
                />
                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Modifier les chants
                  </button>
                  <button onClick={handleSave}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
                    <Check className="w-3.5 h-3.5" /> Enregistrer le programme
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Informations ─── */
function StepInformations({ program, setProgram, members, sundays }: {
  program: ProgramData;
  setProgram: React.Dispatch<React.SetStateAction<ProgramData>>;
  members: any[];
  sundays: any[];
}) {
  const update = (field: keyof ProgramData, value: any) => setProgram(p => ({ ...p, [field]: value }));

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-sm font-bold text-foreground mb-1">Informations du culte</h2>
      <p className="text-xs text-muted-foreground mb-5">Renseignez les détails de base du culte</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Date du culte</label>
          <input type="date" value={program.date} onChange={e => update('date', e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
        </div>
        {/* Heure */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Heure</label>
          <input type="time" value={program.heure} onChange={e => update('heure', e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
        </div>
        {/* Prédicateur */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Prédicateur / Orateur</label>
          <input type="text" value={program.predicateur} onChange={e => update('predicateur', e.target.value)}
            placeholder="Ex: Pasteur Jean Dupont"
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
        </div>
        {/* Conducteur */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Conducteur de louange</label>
          <input type="text" value={program.conducteur} onChange={e => update('conducteur', e.target.value)}
            placeholder="Ex: Marie Martin"
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {/* Titre / Thème */}
      <div className="mt-4">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Titre / Thème du message</label>
        <input type="text" value={program.titre} onChange={e => update('titre', e.target.value)}
          placeholder="Ex: La Foi qui déplace les montagnes"
          className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Référence biblique */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Référence biblique</label>
          <input type="text" value={program.reference} onChange={e => update('reference', e.target.value)}
            placeholder="Ex: Marc 11:23"
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
        </div>
        {/* Nombre de chants */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Nombre de chants</label>
          <select value={program.nbChants} onChange={e => update('nbChants', parseInt(e.target.value))}
            className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring">
            {[3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n} chants</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Notes internes (non imprimées)</label>
        <textarea value={program.notes} onChange={e => update('notes', e.target.value)}
          placeholder="Instructions pour l'équipe, points d'attention..."
          rows={3}
          className="w-full mt-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring resize-y" />
      </div>
    </div>
  );
}

/* ─── Step 2: Chants ─── */
function StepChants({ program, filteredSongs, songSearch, setSongSearch, keyFilter, setKeyFilter, addSong, removeSong, moveSong }: {
  program: ProgramData;
  filteredSongs: any[];
  songSearch: string;
  setSongSearch: (v: string) => void;
  keyFilter: string;
  setKeyFilter: (v: string) => void;
  addSong: (song: any) => void;
  removeSong: (id: string) => void;
  moveSong: (idx: number, dir: 'up' | 'down') => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Song library */}
      <div className="lg:col-span-3">
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">Sélection des chants</h2>
          <p className="text-xs text-muted-foreground mb-4">Cliquez pour ajouter · Glissez pour réordonner</p>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
              placeholder="Rechercher un chant..."
              className="w-full pl-9 pr-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
          </div>

          {/* Key filters */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {KEYS.map(k => (
              <button key={k} onClick={() => setKeyFilter(k)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  keyFilter === k
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground hover:bg-muted'
                }`}>
                {k}
              </button>
            ))}
          </div>

          {/* Song list */}
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {filteredSongs.slice(0, 40).map(s => {
              const isAdded = program.songs.some(ps => ps.songId === s.id);
              return (
                <div key={s.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${
                    isAdded ? 'bg-accent/10' : 'hover:bg-muted'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{s.author || 'Auteur inconnu'}{s.key ? ` · ${s.key}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => removeSong(program.songs.find(ps => ps.songId === s.id)?.id || '')}
                      disabled={!isAdded}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => addSong(s)}
                      disabled={isAdded || program.songs.length >= program.nbChants}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-accent/10 hover:text-accent disabled:opacity-30 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredSongs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun chant trouvé</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Programme slots */}
      <div className="lg:col-span-2">
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Programme</h3>
            <span className="text-xs text-muted-foreground">({program.songs.length}/{program.nbChants})</span>
          </div>

          <div className="space-y-2">
            {Array.from({ length: program.nbChants }).map((_, i) => {
              const song = program.songs[i];
              return (
                <div key={i}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md border transition-colors ${
                    song ? 'border-border bg-background' : 'border-dashed border-border/60 bg-muted/30'
                  }`}>
                  <span className="text-[10px] font-bold text-muted-foreground w-5">{String(i + 1).padStart(2, '0')}</span>
                  {song ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{song.title}</p>
                        {song.key && <p className="text-[10px] text-muted-foreground">{song.key}</p>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveSong(i, 'up')} disabled={i === 0}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30">
                          <ChevronUp className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => moveSong(i, 'down')} disabled={i === program.songs.length - 1}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30">
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => removeSong(song.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">Cliquez un chant pour l'ajouter</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 3: Aperçu & Export ─── */
function StepPreview({ program, previewTab, setPreviewTab, handlePrint, handleSave }: {
  program: ProgramData;
  previewTab: 'congregation' | 'equipe' | 'conducteur';
  setPreviewTab: (t: 'congregation' | 'equipe' | 'conducteur') => void;
  handlePrint: (type: string) => void;
  handleSave: () => void;
}) {
  const formatDateLong = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  const tabs = [
    { key: 'congregation' as const, label: '📖 Congrégation' },
    { key: 'equipe' as const, label: '🎵 Équipe' },
    { key: 'conducteur' as const, label: '🎼 Conducteur' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setPreviewTab(t.key)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  previewTab === t.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Preview content */}
          <div className="p-8 min-h-[400px]">
            <div className="max-w-md mx-auto text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Église AEF</p>
              <h2 className="text-lg font-bold text-foreground mb-1">Programme du Culte</h2>
              <p className="text-xs text-muted-foreground">{formatDateLong(program.date)}</p>
              {program.heure && <p className="text-xs text-muted-foreground mt-0.5">{program.heure}</p>}
            </div>

            {program.predicateur && previewTab !== 'conducteur' && (
              <div className="mb-6 text-center">
                <p className="text-xs text-muted-foreground">Prédicateur: <span className="font-medium text-foreground">{program.predicateur}</span></p>
                {program.titre && <p className="text-xs text-muted-foreground mt-0.5">"{program.titre}"</p>}
                {program.reference && <p className="text-[10px] text-muted-foreground">{program.reference}</p>}
              </div>
            )}

            {previewTab === 'conducteur' && program.conducteur && (
              <div className="mb-6 text-center">
                <p className="text-xs text-muted-foreground">Conducteur: <span className="font-medium text-foreground">{program.conducteur}</span></p>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
                {previewTab === 'congregation' ? 'Louange & Adoration' : previewTab === 'equipe' ? 'Liste des chants' : 'Ordre de passage'}
              </p>
              {program.songs.length > 0 ? (
                <div className="space-y-2">
                  {program.songs.map((s, i) => (
                    <div key={s.id} className="flex items-start gap-3 py-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground/50 mt-0.5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        {previewTab !== 'congregation' && s.author && (
                          <p className="text-[10px] text-muted-foreground">{s.author}</p>
                        )}
                        {previewTab === 'conducteur' && s.key && (
                          <p className="text-[10px] text-accent font-medium">Tonalité: {s.key}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucun chant sélectionné</p>
              )}
            </div>

            {program.notes && previewTab === 'equipe' && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Notes internes</p>
                <p className="text-xs text-muted-foreground">{program.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Export & Partage</h3>

          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Imprimer / PDF</p>
          <div className="space-y-2 mb-5">
            <button onClick={() => handlePrint('congrégation')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimer Congrégation
            </button>
            <button onClick={() => handlePrint('équipe')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <Music className="w-3.5 h-3.5" /> Imprimer Équipe
            </button>
            <button onClick={() => handlePrint('conducteur')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <FileText className="w-3.5 h-3.5" /> Imprimer Conducteur
            </button>
          </div>

          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Sauvegarder</p>
          <div className="space-y-2">
            <button onClick={handleSave}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
              <Save className="w-3.5 h-3.5" /> Enregistrer le programme
            </button>
            <button onClick={() => toast.info('Brouillon sauvegardé localement')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <FileText className="w-3.5 h-3.5" /> Brouillon local
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-4">
            Le PDF s'ouvre via l'impression système. Choisissez "Enregistrer en PDF".
          </p>
        </div>
      </div>
    </div>
  );
}
