import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getPlanning, getSongs, getRunsheet, saveRunsheet, publishRunsheet, updateRunsheetStartTime, type RunsheetItem, type AdminSong } from '@/lib/api';
import { ClipboardList, GripVertical, Plus, Trash2, Eye, EyeOff, Clock, Save } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  chant: 'bg-blue-100 text-blue-700 border-blue-200',
  priere: 'bg-green-100 text-green-700 border-green-200',
  predication: 'bg-orange-100 text-orange-700 border-orange-200',
  annonce: 'bg-purple-100 text-purple-700 border-purple-200',
  autre: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_LABELS: Record<string, string> = {
  chant: 'Chant',
  priere: 'Prière',
  predication: 'Prédication',
  annonce: 'Annonce',
  autre: 'Autre',
};

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const emptyItem = (position: number): RunsheetItem => ({
  position,
  type: 'chant',
  title: '',
  duration_min: 5,
  notes: '',
  song_id: null,
  is_published: 0,
});

export default function ConducteurAdminPage() {
  const [sundays, setSundays] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [items, setItems] = useState<RunsheetItem[]>([]);
  const [startTime, setStartTime] = useState('10:00');
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const year = new Date().getFullYear();
    Promise.all([getPlanning(year), getSongs()])
      .then(([s, sg]) => {
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = (s as any[]).filter((d: any) => d.date >= today);
        setSundays(upcoming.slice(0, 12));
        setSongs(sg as AdminSong[]);
        if (upcoming.length > 0) setSelectedId(String(upcoming[0].id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setDirty(false);
    getRunsheet(selectedId)
      .then(data => {
        setItems(data.items || []);
        setStartTime(data.start_time || '10:00');
        setPublished((data.items || []).some((i: RunsheetItem) => i.is_published === 1));
      })
      .catch(() => { setItems([]); setStartTime('10:00'); setPublished(false); })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setItems(reordered.map((item, i) => ({ ...item, position: i })));
    setDirty(true);
  };

  const addItem = () => {
    setItems(prev => [...prev, emptyItem(prev.length)]);
    setDirty(true);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i })));
    setDirty(true);
  };

  const updateItem = (index: number, field: keyof RunsheetItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRunsheet(selectedId, items.map((item, i) => ({ ...item, position: i })));
      setDirty(false);
    } catch (err) {
      alert('Erreur sauvegarde: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (pub: boolean) => {
    try {
      await publishRunsheet(selectedId, pub);
      setPublished(pub);
    } catch (err) {
      alert('Erreur: ' + (err as Error).message);
    }
  };

  const handleStartTimeChange = async (t: string) => {
    setStartTime(t);
    if (selectedId) {
      try { await updateRunsheetStartTime(selectedId, t); } catch { /* best-effort */ }
    }
  };

  const getItemTime = (index: number): string => {
    let offset = 0;
    for (let i = 0; i < index; i++) offset += items[i].duration_min || 0;
    return addMinutes(startTime, offset);
  };

  const totalDuration = items.reduce((acc, i) => acc + (i.duration_min || 0), 0);
  const selectedSunday = sundays.find(s => String(s.id) === selectedId);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5" /> Conducteur de Culte
        </h1>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button onClick={() => handlePublish(!published)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                published
                  ? 'border-green-500 text-green-600 hover:bg-green-50'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}>
              {published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {published ? 'Publié' : 'Non publié'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 transition-opacity">
            <Save className="w-4 h-4" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Sunday selector + start time */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Dimanche</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
            {sundays.map(s => (
              <option key={s.id} value={String(s.id)}>
                {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {s.label ? ` — ${s.label}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Heure de début
          </label>
          <input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm w-28" />
        </div>
        {selectedSunday && totalDuration > 0 && (
          <div className="text-xs text-muted-foreground self-center">
            Durée totale : <strong className="text-foreground">{totalDuration} min</strong>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Chargement...</div>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="runsheet">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 mb-4">
                  {items.map((item, index) => (
                    <Draggable key={`item-${index}`} draggableId={`item-${index}`} index={index}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`bg-card rounded-lg border border-border p-3 transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-accent/20' : ''}`}>
                          <div className="flex items-start gap-2">
                            <div {...prov.dragHandleProps} className="mt-2.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="text-xs font-mono text-muted-foreground mt-2.5 w-12 shrink-0">
                              {getItemTime(index)}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex gap-2">
                                <select
                                  value={item.type}
                                  onChange={e => updateItem(index, 'type', e.target.value as RunsheetItem['type'])}
                                  className={`px-2 py-1.5 rounded-md border text-xs font-medium ${TYPE_COLORS[item.type] || ''}`}>
                                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                                <input
                                  value={item.title}
                                  onChange={e => updateItem(index, 'title', e.target.value)}
                                  placeholder="Titre"
                                  className="flex-1 px-2 py-1.5 rounded-md border border-input bg-background text-sm min-w-0" />
                              </div>
                              <div className="flex gap-2 items-center">
                                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                <input
                                  type="number" min="1" max="60"
                                  value={item.duration_min}
                                  onChange={e => updateItem(index, 'duration_min', parseInt(e.target.value) || 5)}
                                  className="w-14 px-2 py-1.5 rounded-md border border-input bg-background text-sm text-center" />
                                <span className="text-xs text-muted-foreground">min</span>
                                {item.type === 'chant' && (
                                  <select
                                    value={item.song_id || ''}
                                    onChange={e => updateItem(index, 'song_id', e.target.value || null)}
                                    className="flex-1 px-2 py-1.5 rounded-md border border-input bg-background text-xs min-w-0">
                                    <option value="">— Lier un chant —</option>
                                    {songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                  </select>
                                )}
                              </div>
                              <input
                                value={item.notes || ''}
                                onChange={e => updateItem(index, 'notes', e.target.value)}
                                placeholder="Notes (optionnel)"
                                className="sm:col-span-2 px-2 py-1.5 rounded-md border border-input bg-background text-xs text-muted-foreground" />
                            </div>
                            <button onClick={() => removeItem(index)} className="mt-2 text-muted-foreground hover:text-destructive shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <button
            onClick={addItem}
            className="w-full py-3 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Ajouter un élément
          </button>
        </>
      )}
    </div>
  );
}
