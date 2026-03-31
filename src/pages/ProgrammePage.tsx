import { useEffect, useState, useMemo } from 'react';
import { getPlanning, getSongs, getMembers } from '@/lib/api';
import { FileText, Music, Plus, X, ChevronDown, ChevronUp, GripVertical, Clock, Users, Save, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const MOMENTS = [
  { key: 'accueil', label: 'Accueil & Louange', icon: '🎵', color: 'bg-accent/10 text-accent' },
  { key: 'adoration', label: 'Adoration', icon: '🙏', color: 'bg-purple-500/10 text-purple-600' },
  { key: 'offrande', label: 'Offrande', icon: '💝', color: 'bg-yellow-500/10 text-yellow-600' },
  { key: 'predication', label: 'Prédication', icon: '📖', color: 'bg-green-500/10 text-green-600' },
  { key: 'communion', label: 'Communion', icon: '🍞', color: 'bg-orange-500/10 text-orange-600' },
  { key: 'cloture', label: 'Clôture', icon: '✨', color: 'bg-blue-500/10 text-blue-600' },
];

interface ProgramItem {
  id: string;
  moment: string;
  songId?: string;
  songTitle?: string;
  songKey?: string;
  note?: string;
  duration?: number;
}

export default function ProgrammePage() {
  const [sundays, setSundays] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSunday, setSelectedSunday] = useState<any>(null);
  const [programs, setPrograms] = useState<Record<string, ProgramItem[]>>({});
  const [showSongPicker, setShowSongPicker] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      getPlanning(year).catch(() => []),
      getSongs().catch(() => []),
      getMembers().catch(() => []),
    ]).then(([s, so, m]) => {
      setSundays(s);
      setSongs(so);
      setMembers(m);
      // Auto-select next upcoming sunday
      const today = new Date().toISOString().split('T')[0];
      const upcoming = s.filter((x: any) => x.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date));
      if (upcoming.length > 0) setSelectedSunday(upcoming[0]);
      else if (s.length > 0) setSelectedSunday(s[s.length - 1]);
    }).finally(() => setLoading(false));
  }, []);

  const upcomingSundays = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sundays
      .filter(s => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [sundays]);

  const pastSundays = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sundays
      .filter(s => s.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);
  }, [sundays]);

  const currentProgram = selectedSunday ? (programs[selectedSunday.id] || []) : [];

  const addSongToMoment = (moment: string, song: any) => {
    if (!selectedSunday) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ProgramItem = {
      id,
      moment,
      songId: song.id,
      songTitle: song.title,
      songKey: song.key || '',
      duration: song.tempo ? Math.round(240 / (parseInt(song.tempo) || 120)) : 4,
    };
    setPrograms(prev => ({
      ...prev,
      [selectedSunday.id]: [...(prev[selectedSunday.id] || []), item],
    }));
    setShowSongPicker(null);
    setSongSearch('');
    toast.success(`"${song.title}" ajouté`);
  };

  const removeSongFromProgram = (itemId: string) => {
    if (!selectedSunday) return;
    setPrograms(prev => ({
      ...prev,
      [selectedSunday.id]: (prev[selectedSunday.id] || []).filter(i => i.id !== itemId),
    }));
  };

  const moveSong = (itemId: string, direction: 'up' | 'down') => {
    if (!selectedSunday) return;
    setPrograms(prev => {
      const list = [...(prev[selectedSunday.id] || [])];
      const idx = list.findIndex(i => i.id === itemId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return prev;
      [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
      return { ...prev, [selectedSunday.id]: list };
    });
  };

  const totalDuration = currentProgram.reduce((sum, i) => sum + (i.duration || 4), 0);

  const filteredSongs = songs.filter(s =>
    `${s.title} ${s.author}`.toLowerCase().includes(songSearch.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const formatDateLong = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">📋 Programme du Culte</h1>
          <p className="text-xs text-muted-foreground">Organisez l'ordre du culte avec les chants et intervenants</p>
        </div>
        <button onClick={() => toast.info('Sauvegarde locale active')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          <Save className="w-3.5 h-3.5" /> Sauvegarder
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Sunday selector */}
        <div className="lg:col-span-1 space-y-4">
          {/* Upcoming */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">📅 Prochains cultes</h3>
            <div className="space-y-1">
              {upcomingSundays.map(s => {
                const isSelected = selectedSunday?.id === s.id;
                const isJeunesse = s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse');
                const programCount = (programs[s.id] || []).length;
                return (
                  <button key={s.id} onClick={() => setSelectedSunday(s)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                    }`}>
                    <div className="flex items-center gap-2">
                      {isJeunesse && <span className="text-[9px]">👥</span>}
                      <span className="font-medium">{formatDate(s.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.dirigeant && <span className={`text-[9px] ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{s.dirigeant.split(' ')[0]}</span>}
                      {programCount > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-primary-foreground/20' : 'bg-accent/10 text-accent'}`}>
                          {programCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {upcomingSundays.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Aucun culte à venir</p>}
            </div>
          </div>

          {/* Past */}
          {pastSundays.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Cultes passés</h3>
              <div className="space-y-1">
                {pastSundays.map(s => (
                  <button key={s.id} onClick={() => setSelectedSunday(s)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                      selectedSunday?.id === s.id ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50'
                    }`}>
                    {formatDate(s.date)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Program builder */}
        <div className="lg:col-span-3">
          {!selectedSunday ? (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Sélectionnez un dimanche pour composer le programme</p>
            </div>
          ) : (
            <>
              {/* Sunday header */}
              <div className="bg-card rounded-lg border border-border p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-foreground capitalize">{formatDateLong(selectedSunday.date)}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      {selectedSunday.dirigeant && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> {selectedSunday.dirigeant}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Music className="w-3 h-3" /> {currentProgram.length} chant{currentProgram.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~{totalDuration} min
                      </span>
                    </div>
                  </div>
                  {selectedSunday.is_jeunesse && (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/15 text-yellow-600 font-semibold">👥 Jeunesse</span>
                  )}
                </div>
              </div>

              {/* Moments */}
              <div className="space-y-3">
                {MOMENTS.map(moment => {
                  const momentSongs = currentProgram.filter(p => p.moment === moment.key);
                  return (
                    <div key={moment.key} className="bg-card rounded-lg border border-border overflow-hidden">
                      <div className={`px-4 py-2.5 flex items-center justify-between ${moment.color}`}>
                        <span className="text-xs font-bold uppercase tracking-wide">{moment.icon} {moment.label}</span>
                        <button onClick={() => setShowSongPicker(moment.key)}
                          className="p-1 rounded hover:bg-black/10 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {momentSongs.length > 0 ? (
                        <div className="divide-y divide-border">
                          {momentSongs.map((item, idx) => (
                            <motion.div key={item.id} layout
                              className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors group">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{item.songTitle}</p>
                                {item.songKey && <span className="text-[10px] text-muted-foreground">Tonalité: {item.songKey}</span>}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => moveSong(item.id, 'up')} disabled={idx === 0}
                                  className="p-1 rounded hover:bg-muted disabled:opacity-30">
                                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <button onClick={() => moveSong(item.id, 'down')} disabled={idx === momentSongs.length - 1}
                                  className="p-1 rounded hover:bg-muted disabled:opacity-30">
                                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <button onClick={() => removeSongFromProgram(item.id)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground italic">Aucun chant — cliquez + pour ajouter</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Note */}
              {selectedSunday.note && (
                <div className="bg-muted/50 rounded-lg border border-border p-4 mt-4">
                  <p className="text-xs font-bold text-foreground mb-1">📝 Note</p>
                  <p className="text-xs text-muted-foreground">{selectedSunday.note}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Song picker modal */}
      <AnimatePresence>
        {showSongPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowSongPicker(null); setSongSearch(''); }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-card rounded-xl border border-border p-5 w-full max-w-lg max-h-[70vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Ajouter un chant — {MOMENTS.find(m => m.key === showSongPicker)?.label}</h3>
                <button onClick={() => { setShowSongPicker(null); setSongSearch(''); }}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <input value={songSearch} onChange={e => setSongSearch(e.target.value)} placeholder="Rechercher un chant..."
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm mb-3 focus:ring-2 focus:ring-ring" autoFocus />
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredSongs.slice(0, 30).map(s => (
                  <button key={s.id} onClick={() => addSongToMoment(showSongPicker, s)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{s.author || 'Auteur inconnu'}{s.key ? ` · ${s.key}` : ''}</p>
                    </div>
                    {s.tags && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{s.tags.split(',')[0]?.trim()}</span>
                    )}
                  </button>
                ))}
                {filteredSongs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucun chant trouvé</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
