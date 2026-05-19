import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSermons, saveSermon, deleteSermon, type Sermon } from '@/lib/api';
import { BookOpen, Plus, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY: Omit<Sermon, 'id'> = { title: '', date: '', preacher: '', scripture: '', series: '', notes: '', youtube_url: '' };

function SermonRow({ sermon, onDelete }: { sermon: Sermon; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Sermon>(sermon);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: saveSermon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sermons'] });
      setEditing(false);
      toast.success('Prédication enregistrée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => !editing && setOpen(v => !v)}
      >
        <BookOpen className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{sermon.title || '(sans titre)'}</p>
          <p className="text-xs text-muted-foreground">
            {sermon.date ? new Date(sermon.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            {sermon.preacher && ` · ${sermon.preacher}`}
            {sermon.scripture && ` · ${sermon.scripture}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setEditing(v => !v); setOpen(true); }}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
          >
            Éditer
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Titre" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required />
                <Field label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
                <Field label="Prédicateur" value={form.preacher} onChange={v => setForm(f => ({ ...f, preacher: v }))} required />
                <Field label="Texte biblique" value={form.scripture || ''} onChange={v => setForm(f => ({ ...f, scripture: v }))} />
                <Field label="Série" value={form.series || ''} onChange={v => setForm(f => ({ ...f, series: v }))} />
                <Field label="URL YouTube" value={form.youtube_url || ''} onChange={v => setForm(f => ({ ...f, youtube_url: v }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full text-sm bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                  Annuler
                </button>
                <button
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || !form.title || !form.date || !form.preacher}
                  className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {save.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              {sermon.series && <p><span className="font-medium text-foreground">Série :</span> {sermon.series}</p>}
              {sermon.notes && <p className="whitespace-pre-wrap text-sm">{sermon.notes}</p>}
              {sermon.youtube_url && (
                <a href={sermon.youtube_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                  Voir sur YouTube ↗
                </a>
              )}
              {!sermon.series && !sermon.notes && !sermon.youtube_url && (
                <p className="text-xs italic">Aucun détail supplémentaire</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mb-1 block">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

export default function PredicationsPage() {
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<Omit<Sermon, 'id'>>({ ...EMPTY });
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: sermons = [], isLoading } = useQuery({
    queryKey: ['sermons'],
    queryFn: getSermons,
  });

  const create = useMutation({
    mutationFn: saveSermon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sermons'] });
      setCreating(false);
      setNewForm({ ...EMPTY });
      toast.success('Prédication ajoutée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteSermon,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sermons'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = sermons.filter(s => {
    const q = search.toLowerCase();
    return !q || s.title.toLowerCase().includes(q) || (s.preacher || '').toLowerCase().includes(q) || (s.scripture || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Prédications</h1>
        <button
          onClick={() => setCreating(v => !v)}
          className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {creating ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* New sermon form */}
      {creating && (
        <div className="bg-card border border-primary/30 rounded-lg px-4 py-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Nouvelle prédication</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre" value={newForm.title} onChange={v => setNewForm(f => ({ ...f, title: v }))} required />
            <Field label="Date" type="date" value={newForm.date} onChange={v => setNewForm(f => ({ ...f, date: v }))} required />
            <Field label="Prédicateur" value={newForm.preacher} onChange={v => setNewForm(f => ({ ...f, preacher: v }))} required />
            <Field label="Texte biblique" value={newForm.scripture || ''} onChange={v => setNewForm(f => ({ ...f, scripture: v }))} />
            <Field label="Série" value={newForm.series || ''} onChange={v => setNewForm(f => ({ ...f, series: v }))} />
            <Field label="URL YouTube" value={newForm.youtube_url || ''} onChange={v => setNewForm(f => ({ ...f, youtube_url: v }))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground mb-1 block">Notes</label>
            <textarea
              rows={2}
              value={newForm.notes || ''}
              onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => create.mutate(newForm)}
              disabled={create.isPending || !newForm.title || !newForm.date || !newForm.preacher}
              className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {create.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher une prédication..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune prédication enregistrée</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajoutez des prédications pour les afficher dans l'espace membre</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <SermonRow
              key={s.id}
              sermon={s}
              onDelete={() => s.id && remove.mutate(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
