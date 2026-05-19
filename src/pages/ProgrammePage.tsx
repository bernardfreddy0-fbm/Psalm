import { useEffect, useState, useMemo } from 'react';
import { getPlanning, getSongs, getMembers, saveProgram, loadPrograms } from '@/lib/api';
import { BIBLE_BOOKS, formatReference } from '@/lib/bible';
import {
  Music, Plus, X, ChevronUp, ChevronDown, Search, Save, RefreshCw,
  Printer, FileText, ArrowLeft, ArrowRight, Check, BookOpen, Mic, Hand, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

/* ─── Types ─── */
type ElementType = 'chant' | 'lecture' | 'priere' | 'intervention';

interface ProgramElement {
  id: string;
  type: ElementType;
  // chant
  songId?: string;
  songTitle?: string;
  songKey?: string;
  songAuthor?: string;
  // lecture biblique
  bibleBook?: string;
  bibleChapter?: string;
  bibleVerses?: string;
  // prière / intervention
  label?: string;
  person?: string;
}

interface ProgramData {
  date: string;
  heure: string;
  predicateur: string;
  conducteur: string;
  titre: string;
  reference: string;
  notes: string;
  elements: ProgramElement[];
}

const emptyProgram = (): ProgramData => ({
  date: new Date().toISOString().split('T')[0],
  heure: '',
  predicateur: '',
  conducteur: '',
  titre: '',
  reference: '',
  notes: '',
  elements: [],
});

const ELEMENT_META: Record<ElementType, { icon: React.ReactNode; label: string; color: string }> = {
  chant: { icon: <Music className="w-3.5 h-3.5" />, label: 'Chant', color: 'bg-accent/10 text-accent' },
  lecture: { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Lecture biblique', color: 'bg-emerald-500/10 text-emerald-600' },
  priere: { icon: <Hand className="w-3.5 h-3.5" />, label: 'Prière', color: 'bg-purple-500/10 text-purple-600' },
  intervention: { icon: <Mic className="w-3.5 h-3.5" />, label: 'Intervention', color: 'bg-amber-500/10 text-amber-600' },
};

const KEYS = ['Tous', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];

const DRAFT_KEY = 'aef_programme_draft';

const loadDraft = (): ProgramData => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as ProgramData;
  } catch { /* ignore */ }
  return emptyProgram();
};

/* ─── Main Component ─── */
export default function ProgrammePage() {
  const [step, setStep] = useState(1);
  const [songs, setSongs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState<ProgramData>(loadDraft);
  const [hasDraft, setHasDraft] = useState(() => !!localStorage.getItem(DRAFT_KEY));
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<'congregation' | 'equipe' | 'conducteur'>('congregation');

  useEffect(() => {
    setLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      getSongs().catch(() => []),
      getMembers().catch(() => []),
      getPlanning(year).catch(() => []),
      loadPrograms().catch(() => []),
    ]).then(([so, m, su, progs]) => {
      setSongs(so);
      setMembers(m);
      setSavedDates((progs as any[]).map((p: any) => p.key_name));
      const today = new Date().toISOString().split('T')[0];
      const next = su.filter((s: any) => s.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date))[0];
      // Try to load saved programme for next sunday
      if (next) {
        const saved = (progs as any[]).find((p: any) => p.key_name === next.date);
        if (saved) {
          try {
            const parsed = JSON.parse(saved.value);
            setProgram(parsed);
            localStorage.setItem(DRAFT_KEY, saved.value);
            setHasDraft(true);
          } catch {
            setProgram(p => ({ ...p, date: next.date, conducteur: next.dirigeant || '' }));
          }
        } else {
          setProgram(p => ({ ...p, date: next.date, conducteur: next.dirigeant || '' }));
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  // Sauvegarde automatique dans localStorage (debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(program));
      setHasDraft(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [program]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setProgram(emptyProgram());
  };

  const formatDateLong = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  const addElement = (el: ProgramElement) => {
    setProgram(p => ({ ...p, elements: [...p.elements, el] }));
  };

  const removeElement = (id: string) => {
    setProgram(p => ({ ...p, elements: p.elements.filter(e => e.id !== id) }));
  };

  const moveElement = (idx: number, dir: 'up' | 'down') => {
    const els = [...program.elements];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= els.length) return;
    [els[idx], els[swapIdx]] = [els[swapIdx], els[idx]];
    setProgram(p => ({ ...p, elements: els }));
  };

  const handleSave = async () => {
    if (!program.date) { toast.error('Sélectionnez une date avant de sauvegarder'); return; }
    setSaving(true);
    try {
      await saveProgram(program.date, program);
      setSavedDates(prev => prev.includes(program.date) ? prev : [...prev, program.date]);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(program));
      setHasDraft(true);
      toast.success('Programme sauvegardé');
    } catch {
      // Fallback: save locally only
      localStorage.setItem(DRAFT_KEY, JSON.stringify(program));
      setHasDraft(true);
      toast.success('Programme sauvegardé localement');
    } finally {
      setSaving(false);
    }
  };
  const handlePrint = () => { toast.info('Utilisez Ctrl+P / Cmd+P'); window.print(); };

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
    { num: 2, label: 'Déroulement' },
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
          {hasDraft && (program.elements.length > 0 || program.titre) && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                💾 Brouillon sauvegardé
              </span>
              <button
                onClick={clearDraft}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
              >
                ✕ Effacer
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> Brouillon
          </button>
          <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            Aperçu PDF <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Steps sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Étapes</p>
            <div className="space-y-1">
              {steps.map(s => (
                <button key={s.num} onClick={() => setStep(s.num)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-all flex items-center gap-2.5 ${
                    step === s.num ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.num ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{s.num}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepInformations program={program} setProgram={setProgram} />
                <div className="flex justify-end mt-4">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    Composer le déroulement <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepDeroulement
                  program={program}
                  songs={songs}
                  members={members}
                  addElement={addElement}
                  removeElement={removeElement}
                  moveElement={moveElement}
                />
                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Informations
                  </button>
                  <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    Aperçu & Export <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <StepPreview program={program} previewTab={previewTab} setPreviewTab={setPreviewTab} handlePrint={handlePrint} handleSave={handleSave} />
                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Modifier le déroulement
                  </button>
                  <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
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

/* ═══════════════════════════════════════════════ */
/* Step 1: Informations                            */
/* ═══════════════════════════════════════════════ */
function StepInformations({ program, setProgram }: { program: ProgramData; setProgram: React.Dispatch<React.SetStateAction<ProgramData>> }) {
  const update = (field: keyof ProgramData, value: any) => setProgram(p => ({ ...p, [field]: value }));
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-sm font-bold text-foreground mb-1">Informations du culte</h2>
      <p className="text-xs text-muted-foreground mb-5">Renseignez les détails de base du culte</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Date du culte"><input type="date" value={program.date} onChange={e => update('date', e.target.value)} className="input-field" /></Field>
        <Field label="Heure"><input type="time" value={program.heure} onChange={e => update('heure', e.target.value)} className="input-field" /></Field>
        <Field label="Prédicateur / Orateur"><input type="text" value={program.predicateur} onChange={e => update('predicateur', e.target.value)} placeholder="Ex: Pasteur Jean Dupont" className="input-field" /></Field>
        <Field label="Conducteur de louange"><input type="text" value={program.conducteur} onChange={e => update('conducteur', e.target.value)} placeholder="Ex: Marie Martin" className="input-field" /></Field>
      </div>
      <div className="mt-4">
        <Field label="Titre / Thème du message"><input type="text" value={program.titre} onChange={e => update('titre', e.target.value)} placeholder="Ex: La Foi qui déplace les montagnes" className="input-field" /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Field label="Référence biblique principale"><input type="text" value={program.reference} onChange={e => update('reference', e.target.value)} placeholder="Ex: Marc 11:23" className="input-field" /></Field>
        <div />
      </div>
      <div className="mt-4">
        <Field label="Notes internes (non imprimées)">
          <textarea value={program.notes} onChange={e => update('notes', e.target.value)} placeholder="Instructions pour l'équipe, points d'attention..." rows={3} className="input-field resize-y" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/* Step 2: Déroulement (mixed elements)            */
/* ═══════════════════════════════════════════════ */
function StepDeroulement({ program, songs, members, addElement, removeElement, moveElement }: {
  program: ProgramData;
  songs: any[];
  members: any[];
  addElement: (el: ProgramElement) => void;
  removeElement: (id: string) => void;
  moveElement: (idx: number, dir: 'up' | 'down') => void;
}) {
  const [addMode, setAddMode] = useState<ElementType | null>(null);
  const [songSearch, setSongSearch] = useState('');
  const [keyFilter, setKeyFilter] = useState('Tous');
  // Bible picker
  const [selBook, setSelBook] = useState('');
  const [selChapter, setSelChapter] = useState('');
  const [selVerses, setSelVerses] = useState('');
  const [bibleSearch, setBibleSearch] = useState('');
  // Prière / Intervention
  const [intLabel, setIntLabel] = useState('');
  const [intPerson, setIntPerson] = useState('');

  const filteredSongs = useMemo(() => {
    return songs.filter(s => {
      const matchSearch = !songSearch || `${s.title} ${s.author || ''}`.toLowerCase().includes(songSearch.toLowerCase());
      const matchKey = keyFilter === 'Tous' || (s.key || '').toLowerCase().startsWith(keyFilter.toLowerCase());
      return matchSearch && matchKey;
    });
  }, [songs, songSearch, keyFilter]);

  const filteredBooks = useMemo(() => {
    if (!bibleSearch) return BIBLE_BOOKS;
    return BIBLE_BOOKS.filter(b => b.name.toLowerCase().includes(bibleSearch.toLowerCase()));
  }, [bibleSearch]);

  const selectedBookObj = BIBLE_BOOKS.find(b => b.id === selBook);

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleAddSong = (song: any) => {
    addElement({ id: uid(), type: 'chant', songId: song.id, songTitle: song.title, songKey: song.key, songAuthor: song.author });
    toast.success(`Chant "${song.title}" ajouté`);
  };

  const handleAddLecture = () => {
    if (!selBook) { toast.error('Sélectionnez un livre'); return; }
    const ref = formatReference(selBook, selChapter, selVerses);
    addElement({ id: uid(), type: 'lecture', bibleBook: selBook, bibleChapter: selChapter, bibleVerses: selVerses, label: ref });
    toast.success(`Lecture "${ref}" ajoutée`);
    setSelBook(''); setSelChapter(''); setSelVerses('');
  };

  const handleAddIntervention = (type: ElementType) => {
    if (!intLabel) { toast.error('Renseignez un libellé'); return; }
    addElement({ id: uid(), type, label: intLabel, person: intPerson });
    toast.success(`${type === 'priere' ? 'Prière' : 'Intervention'} ajoutée`);
    setIntLabel(''); setIntPerson(''); setAddMode(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Add elements */}
      <div className="lg:col-span-3 space-y-4">
        {/* Add buttons */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold text-foreground mb-1">Composer le déroulement</h2>
          <p className="text-xs text-muted-foreground mb-3">Ajoutez chants, lectures bibliques, prières et interventions dans l'ordre du culte</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ELEMENT_META) as ElementType[]).map(type => (
              <button key={type} onClick={() => setAddMode(addMode === type ? null : type)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  addMode === type ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-muted'
                }`}>
                {ELEMENT_META[type].icon}
                <Plus className="w-3 h-3" />
                {ELEMENT_META[type].label}
              </button>
            ))}
          </div>
        </div>

        {/* Add panels */}
        <AnimatePresence mode="wait">
          {addMode === 'chant' && (
            <motion.div key="chant" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <SongPicker songs={filteredSongs} songSearch={songSearch} setSongSearch={setSongSearch} keyFilter={keyFilter} setKeyFilter={setKeyFilter} onAdd={handleAddSong} program={program} />
            </motion.div>
          )}
          {addMode === 'lecture' && (
            <motion.div key="lecture" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <BiblePicker
                filteredBooks={filteredBooks}
                bibleSearch={bibleSearch}
                setBibleSearch={setBibleSearch}
                selBook={selBook}
                setSelBook={setSelBook}
                selChapter={selChapter}
                setSelChapter={setSelChapter}
                selVerses={selVerses}
                setSelVerses={setSelVerses}
                selectedBookObj={selectedBookObj}
                onAdd={handleAddLecture}
              />
            </motion.div>
          )}
          {(addMode === 'priere' || addMode === 'intervention') && (
            <motion.div key="interv" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-bold text-foreground mb-3">
                  {addMode === 'priere' ? '🙏 Ajouter une prière' : '🎤 Ajouter une intervention'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <Field label="Libellé">
                    <input value={intLabel} onChange={e => setIntLabel(e.target.value)}
                      placeholder={addMode === 'priere' ? 'Ex: Prière d\'introduction' : 'Ex: Salutations et annonces'}
                      className="input-field" />
                  </Field>
                  <Field label="Intervenant (optionnel)">
                    <input value={intPerson} onChange={e => setIntPerson(e.target.value)}
                      placeholder="Ex: Sonia Désir"
                      className="input-field" />
                  </Field>
                </div>
                <button onClick={() => handleAddIntervention(addMode)} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Programme order */}
      <div className="lg:col-span-2">
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Ordre du culte</h3>
            <span className="text-xs text-muted-foreground">({program.elements.length})</span>
          </div>

          {program.elements.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-muted-foreground italic">Ajoutez des éléments pour composer le déroulement du culte</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {program.elements.map((el, i) => {
                const meta = ELEMENT_META[el.type];
                return (
                  <div key={el.id} className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-background group">
                    <span className="text-[10px] font-bold text-muted-foreground/50 w-4">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${meta.color}`}>{el.type === 'chant' ? '♪' : el.type === 'lecture' ? '📖' : el.type === 'priere' ? '🙏' : '🎤'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {el.type === 'chant' ? el.songTitle : el.label}
                        {el.type === 'chant' && el.songKey && <span className="text-muted-foreground font-normal"> ({el.songKey})</span>}
                      </p>
                      {el.person && <p className="text-[10px] text-muted-foreground truncate">{el.person}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveElement(i, 'up')} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => moveElement(i, 'down')} disabled={i === program.elements.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => removeElement(el.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Song Picker ─── */
function SongPicker({ songs, songSearch, setSongSearch, keyFilter, setKeyFilter, onAdd, program }: {
  songs: any[];
  songSearch: string;
  setSongSearch: (v: string) => void;
  keyFilter: string;
  setKeyFilter: (v: string) => void;
  onAdd: (song: any) => void;
  program: ProgramData;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-bold text-foreground mb-3">🎵 Ajouter un chant</h3>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Rechercher un chant..."
          className="w-full pl-9 pr-3 py-2.5 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {KEYS.map(k => (
          <button key={k} onClick={() => setKeyFilter(k)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              keyFilter === k ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}>{k}</button>
        ))}
      </div>
      <div className="space-y-1 max-h-[40vh] overflow-y-auto">
        {songs.slice(0, 40).map(s => {
          const already = program.elements.some(e => e.type === 'chant' && e.songId === s.id);
          return (
            <button key={s.id} onClick={() => !already && onAdd(s)} disabled={already}
              className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${already ? 'bg-accent/10 opacity-60' : 'hover:bg-muted'}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-[10px] text-muted-foreground">{s.author || 'Auteur inconnu'}{s.key ? ` · ${s.key}` : ''}</p>
              </div>
              {!already && <Plus className="w-4 h-4 text-muted-foreground shrink-0" />}
              {already && <Check className="w-4 h-4 text-accent shrink-0" />}
            </button>
          );
        })}
        {songs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Aucun chant trouvé</p>}
      </div>
    </div>
  );
}

/* ─── Bible Picker ─── */
function BiblePicker({ filteredBooks, bibleSearch, setBibleSearch, selBook, setSelBook, selChapter, setSelChapter, selVerses, setSelVerses, selectedBookObj, onAdd }: {
  filteredBooks: typeof BIBLE_BOOKS;
  bibleSearch: string;
  setBibleSearch: (v: string) => void;
  selBook: string;
  setSelBook: (v: string) => void;
  selChapter: string;
  setSelChapter: (v: string) => void;
  selVerses: string;
  setSelVerses: (v: string) => void;
  selectedBookObj: typeof BIBLE_BOOKS[0] | undefined;
  onAdd: () => void;
}) {
  const [testament, setTestament] = useState<'all' | 'AT' | 'NT'>('all');
  const books = testament === 'all' ? filteredBooks : filteredBooks.filter(b => b.testament === testament);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-bold text-foreground mb-3">📖 Ajouter une lecture biblique</h3>

      {!selBook ? (
        <>
          {/* Search + filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={bibleSearch} onChange={e => setBibleSearch(e.target.value)} placeholder="Rechercher un livre..."
                className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-1">
              {[{ k: 'all' as const, l: 'Tous' }, { k: 'AT' as const, l: 'A.T.' }, { k: 'NT' as const, l: 'N.T.' }].map(f => (
                <button key={f.k} onClick={() => setTestament(f.k)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${testament === f.k ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          {/* Books grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-[35vh] overflow-y-auto">
            {books.map(b => (
              <button key={b.id} onClick={() => { setSelBook(b.id); setBibleSearch(''); }}
                className="text-left px-2.5 py-2 rounded-md border border-border hover:bg-muted transition-colors">
                <p className="text-xs font-medium text-foreground">{b.name}</p>
                <p className="text-[10px] text-muted-foreground">{b.chapters} ch.</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Selected book */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setSelBook('')} className="p-1 rounded hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
            <span className="text-sm font-bold text-foreground">{selectedBookObj?.name}</span>
            <span className="text-[10px] text-muted-foreground">({selectedBookObj?.chapters} chapitres)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Field label="Chapitre">
              <select value={selChapter} onChange={e => setSelChapter(e.target.value)} className="input-field">
                <option value="">Tout le livre</option>
                {selectedBookObj && Array.from({ length: selectedBookObj.chapters }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
              </select>
            </Field>
            <Field label="Versets (optionnel)">
              <input value={selVerses} onChange={e => setSelVerses(e.target.value)} placeholder="Ex: 19-22" className="input-field" disabled={!selChapter} />
            </Field>
            <div className="flex items-end">
              <button onClick={onAdd} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          </div>
          {selBook && selChapter && (
            <div className="bg-muted/50 rounded-md px-3 py-2">
              <p className="text-xs text-foreground font-medium">Aperçu : {formatReference(selBook, selChapter, selVerses)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/* Step 3: Aperçu & Export                         */
/* ═══════════════════════════════════════════════ */
function StepPreview({ program, previewTab, setPreviewTab, handlePrint, handleSave }: {
  program: ProgramData;
  previewTab: 'congregation' | 'equipe' | 'conducteur';
  setPreviewTab: (t: 'congregation' | 'equipe' | 'conducteur') => void;
  handlePrint: () => void;
  handleSave: () => void;
}) {
  const formatDateLong = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  const tabs = [
    { key: 'congregation' as const, label: '📖 Congrégation' },
    { key: 'equipe' as const, label: '🎵 Équipe' },
    { key: 'conducteur' as const, label: '🎼 Conducteur' },
  ];

  const renderElement = (el: ProgramElement, showDetails: boolean) => {
    const meta = ELEMENT_META[el.type];
    return (
      <div className="py-2">
        {el.type === 'chant' && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground uppercase">{el.songTitle}</span>
            {showDetails && el.songKey && <span className="text-xs text-muted-foreground">({el.songKey})</span>}
          </div>
        )}
        {el.type === 'lecture' && (
          <div>
            <span className="text-sm font-semibold text-foreground uppercase">Lecture – {el.label}</span>
          </div>
        )}
        {(el.type === 'priere' || el.type === 'intervention') && (
          <div>
            <span className="text-sm font-semibold text-foreground uppercase">{el.label}</span>
            {el.person && <span className="text-sm text-muted-foreground"> – {el.person}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex border-b border-border">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setPreviewTab(t.key)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${previewTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-8 min-h-[400px]">
            {/* Header like PDF */}
            <div className="text-center mb-8 pb-4 border-b border-border">
              <p className="text-sm font-bold text-foreground tracking-widest uppercase mb-1">
                Dimanche {new Date(program.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>

            {/* Elements */}
            {program.elements.length > 0 ? (
              <div className="divide-y divide-border/50">
                {program.elements.map(el => (
                  <div key={el.id}>{renderElement(el, previewTab !== 'congregation')}</div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-8">Aucun élément dans le programme</p>
            )}

            {/* Predicateur */}
            {program.predicateur && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-sm font-semibold text-foreground uppercase">
                  Prédication et annonces ({program.predicateur})
                </p>
                {program.titre && <p className="text-xs text-muted-foreground mt-0.5">"{program.titre}" — {program.reference}</p>}
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
            <button onClick={handlePrint} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimer Congrégation
            </button>
            <button onClick={handlePrint} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <Music className="w-3.5 h-3.5" /> Imprimer Équipe
            </button>
            <button onClick={handlePrint} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <FileText className="w-3.5 h-3.5" /> Imprimer Conducteur
            </button>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Sauvegarder</p>
          <div className="space-y-2">
            <button onClick={handleSave} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
              <Save className="w-3.5 h-3.5" /> Enregistrer le programme
            </button>
            <button onClick={() => toast.info('Brouillon sauvegardé localement')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors">
              <FileText className="w-3.5 h-3.5" /> Brouillon local
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">Le PDF s'ouvre via l'impression système. Choisissez "Enregistrer en PDF".</p>
        </div>
      </div>
    </div>
  );
}
