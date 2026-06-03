import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNextSundays, getVideoMetaList, getAEFVTeam,
  getProgrammeCulte, submitProgrammeCulte,
  saveVideoAssignment, removeVideoAssignment,
  STATUS_LABELS, STATUS_COLORS,
  SEQUENCE_TYPE_LABELS,
  type VideoMetaSummary, type VideoStatus, type AEFVMember,
  type NextSunday, type ProgrammeSequence, type SequenceType,
} from '@/lib/api';
import {
  LayoutDashboard, Calendar, Video, Users, BookOpen,
  Radio, ExternalLink, ChevronUp, ChevronDown,
  Plus, X, Trash2, Phone, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'planning' | 'fiches' | 'equipe' | 'programme';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'planning',   label: 'Planning',        icon: Calendar },
  { id: 'fiches',     label: 'Fiches',          icon: Video },
  { id: 'equipe',     label: 'Équipe',          icon: Users },
  { id: 'programme',  label: 'Programme',       icon: BookOpen },
];

function StatusBadge({ status }: { status: VideoStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-amber-500 to-orange-600',
];

const ROLE_LABELS: Record<string, string> = {
  responsable_video:        'Responsable vidéo',
  referent_planning_video:  'Référent planning',
  referent_technique_video: 'Référent technique',
  videaste:                 'Vidéaste',
};

const SEQUENCE_TYPES: SequenceType[] = ['louange', 'prédication', 'prière', 'annonces', 'témoignage', 'autre'];

// ── Sub-views ────────────────────────────────────────────────────────────────

function OverviewTab({ sundays, videos, team }: { sundays: NextSunday[]; videos: VideoMetaSummary[]; team: AEFVMember[] }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canPlan = hasPermission('video_planning_edit');
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedVideaste, setSelectedVideaste] = useState('');

  const assignMutation = useMutation({
    mutationFn: ({ sundayId, videasteId }: { sundayId: number; videasteId: string }) =>
      saveVideoAssignment(sundayId, videasteId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-sundays-admin'] }); toast.success('Vidéaste assigné'); setAssignModal(null); },
    onError: () => toast.error("Erreur lors de l'assignation"),
  });

  const next = sundays[0] ?? null;
  const pipeline = {
    brut:       videos.filter(v => v.status === 'brut').length,
    montage:    videos.filter(v => v.status === 'montage').length,
    validation: videos.filter(v => v.status === 'validation').length,
    publie:     videos.filter(v => v.status === 'publie').length,
  };
  const videasters = team.filter(m => (m.role ?? '').includes('videaste') || (m.role ?? '').includes('responsable_video'));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/3 p-5">
          {next ? (
            <>
              <p className="text-[10px] text-primary uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                <Radio className="w-3 h-3" />
                {(() => { const d = daysUntil(next.sunday_date); return d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : `Dans ${d} jours`; })()}
              </p>
              <p className="text-base font-bold text-foreground capitalize mb-3">{formatDate(next.sunday_date)}</p>
              <div className="flex items-center justify-between bg-background/40 rounded-lg p-3">
                {next.assignment ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                      {initials(next.assignment.first_name, next.assignment.last_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{next.assignment.first_name} {next.assignment.last_name}</p>
                      <p className="text-xs text-muted-foreground">Vidéaste</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Non assigné</span>
                )}
                {canPlan && (
                  <button
                    onClick={() => { setAssignModal(next.sunday_id); setSelectedVideaste(next.assignment?.videaste_id ?? ''); }}
                    className="text-xs text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {next.assignment ? 'Changer' : '+ Assigner'}
                  </button>
                )}
              </div>
              {next.has_programme && (
                <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-300">Programme du culte disponible</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun dimanche planifié</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Pipeline post-production</p>
          <div className="space-y-3">
            {(['brut', 'montage', 'validation', 'publie'] as VideoStatus[]).map(s => {
              const count = pipeline[s];
              const pct = videos.length > 0 ? Math.round((count / videos.length) * 100) : 0;
              const c = STATUS_COLORS[s];
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={c.text}>{STATUS_LABELS[s]}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className={`h-full rounded-full ${c.bg.replace('/15', '')} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Équipe</p>
        <div className="flex flex-wrap gap-4">
          {team.map((m, i) => {
            const roles = (m.role ?? '').split(',').map(r => r.trim());
            const aefvRole = roles.find(r => ROLE_LABELS[r]) ?? '';
            const isAssigned = next?.assignment?.videaste_id === m.id;
            return (
              <div key={m.id} className={`flex flex-col items-center gap-1.5 ${isAssigned ? 'opacity-100' : 'opacity-70'}`}>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-sm font-bold text-white ${isAssigned ? 'ring-2 ring-primary' : ''}`}>
                  {initials(m.first_name, m.last_name)}
                </div>
                <p className="text-xs font-medium text-center">{m.first_name}</p>
                {aefvRole && <p className="text-[10px] text-muted-foreground text-center">{ROLE_LABELS[aefvRole]}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {assignModal !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Assigner un vidéaste</h3>
              <button onClick={() => setAssignModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <select
              className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm mb-4"
              value={selectedVideaste}
              onChange={e => setSelectedVideaste(e.target.value)}
            >
              <option value="">— Choisir un vidéaste —</option>
              {videasters.map(v => (
                <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setAssignModal(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm">Annuler</button>
              <button
                disabled={!selectedVideaste || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ sundayId: assignModal, videasteId: selectedVideaste })}
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanningTab({ sundays, team }: { sundays: NextSunday[]; team: AEFVMember[] }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canPlan = hasPermission('video_planning_edit');
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [selectedVideaste, setSelectedVideaste] = useState('');

  const assignMut = useMutation({
    mutationFn: ({ sundayId, videasteId }: { sundayId: number; videasteId: string }) =>
      saveVideoAssignment(sundayId, videasteId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-sundays-admin'] }); toast.success('Assigné'); setAssignModal(null); },
    onError: () => toast.error('Erreur'),
  });

  const removeMut = useMutation({
    mutationFn: (sundayId: number) => removeVideoAssignment(sundayId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-sundays-admin'] }); toast.success('Assignation supprimée'); },
    onError: () => toast.error('Erreur'),
  });

  const videasters = team.filter(m => (m.role ?? '').split(',').some(r => ['videaste', 'responsable_video'].includes(r.trim())));

  return (
    <div className="space-y-3">
      {sundays.map((s, idx) => {
        const days = daysUntil(s.sunday_date);
        return (
          <div key={s.sunday_id} className={`rounded-xl border p-4 flex flex-wrap gap-3 items-center ${idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
            <div className="w-40 shrink-0">
              <p className={`text-sm font-semibold capitalize ${idx === 0 ? 'text-primary' : ''}`}>{formatDate(s.sunday_date)}</p>
              <p className="text-xs text-muted-foreground">{days === 0 ? "Aujourd'hui" : `J−${days}`}</p>
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-[120px]">
              {s.assignment ? (
                <span className="text-sm text-foreground">{s.assignment.first_name} {s.assignment.last_name}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">Non assigné</span>
              )}
            </div>
            {s.has_programme && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Programme
              </span>
            )}
            {canPlan && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => { setAssignModal(s.sunday_id); setSelectedVideaste(s.assignment?.videaste_id ?? ''); }}
                  className="text-xs text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {s.assignment ? 'Changer' : '+ Assigner'}
                </button>
                {s.assignment && (
                  <button
                    onClick={() => removeMut.mutate(s.sunday_id)}
                    className="text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {assignModal !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Assigner un vidéaste</h3>
              <button onClick={() => setAssignModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <select
              className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm mb-4"
              value={selectedVideaste}
              onChange={e => setSelectedVideaste(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {videasters.map(v => <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setAssignModal(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm">Annuler</button>
              <button
                disabled={!selectedVideaste || assignMut.isPending}
                onClick={() => assignMut.mutate({ sundayId: assignModal, videasteId: selectedVideaste })}
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FichesTab({ videos }: { videos: VideoMetaSummary[] }) {
  const [filterStatus, setFilterStatus] = useState<VideoStatus | 'all'>('all');
  const filtered = useMemo(() =>
    filterStatus === 'all' ? videos : videos.filter(v => v.status === filterStatus),
    [videos, filterStatus]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {(['all', 'brut', 'montage', 'validation', 'publie'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {s === 'all' ? `Tous (${videos.length})` : `${STATUS_LABELS[s]} (${videos.filter(v => v.status === s).length})`}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Vidéo</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Thème</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Statut</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Filmé par</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.video_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={`https://youtube.com/watch?v=${v.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group"
                  >
                    <img src={`https://img.youtube.com/vi/${v.video_id}/default.jpg`} alt="" className="w-16 h-9 object-cover rounded" />
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm truncate max-w-[180px]">{v.theme ?? '—'}</p>
                  {v.preacher && <p className="text-xs text-muted-foreground">{v.preacher}</p>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground">{v.filmed_by ?? '—'}</span>
                </td>
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune vidéo pour ce filtre</div>
        )}
      </div>
    </div>
  );
}

function EquipeTab({ team }: { team: AEFVMember[] }) {
  const ROLE_ORDER = ['responsable_video', 'referent_planning_video', 'referent_technique_video', 'videaste'];
  const sorted = [...team].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf((a.role ?? '').split(',').find(r => ROLE_LABELS[r.trim()]) ?? '');
    const rb = ROLE_ORDER.indexOf((b.role ?? '').split(',').find(r => ROLE_LABELS[r.trim()]) ?? '');
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sorted.map((m, i) => {
        const roles = (m.role ?? '').split(',').map(r => r.trim());
        const aefvRole = roles.find(r => ROLE_LABELS[r]) ?? '';
        return (
          <div key={m.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
              {initials(m.first_name, m.last_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{m.first_name} {m.last_name}</p>
              {aefvRole && <p className="text-xs text-muted-foreground">{ROLE_LABELS[aefvRole]}</p>}
            </div>
            {m.phone && (
              <div className="flex gap-1 shrink-0">
                <a href={`tel:${m.phone}`} className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </a>
                <a href={`https://wa.me/${m.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgrammeTab({ sundays }: { sundays: NextSunday[] }) {
  const qc = useQueryClient();
  const [selectedSundayId, setSelectedSundayId] = useState<number | ''>('');
  const [sequences, setSequences] = useState<ProgrammeSequence[]>([]);
  const [notes, setNotes] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['programme-culte-admin', selectedSundayId],
    queryFn:  () => getProgrammeCulte(selectedSundayId as number),
    enabled:  selectedSundayId !== '',
  });

  const loadExisting = () => {
    if (existing) {
      setSequences(existing.sequences);
      setNotes(existing.notes ?? '');
    }
  };

  const submitMut = useMutation({
    mutationFn: () => submitProgrammeCulte({
      sunday_id: selectedSundayId as number,
      sequences,
      notes: notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-sundays-admin'] }); toast.success('Programme soumis'); },
    onError: () => toast.error('Erreur lors de la soumission'),
  });

  function addSequence() {
    setSequences(prev => [...prev, { ordre: prev.length + 1, type: 'louange', titre: '', notes: '' }]);
  }

  function removeSequence(idx: number) {
    setSequences(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordre: i + 1 })));
  }

  function moveSequence(idx: number, dir: 'up' | 'down') {
    setSequences(prev => {
      const arr = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((s, i) => ({ ...s, ordre: i + 1 }));
    });
  }

  function updateSequence(idx: number, field: keyof ProgrammeSequence, value: string) {
    setSequences(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Dimanche</label>
        <select
          className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm"
          value={selectedSundayId}
          onChange={e => { setSelectedSundayId(e.target.value === '' ? '' : Number(e.target.value)); setSequences([]); setNotes(''); }}
        >
          <option value="">— Sélectionner un dimanche —</option>
          {sundays.map(s => (
            <option key={s.sunday_id} value={s.sunday_id}>
              {new Date(s.sunday_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {s.has_programme ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedSundayId !== '' && existing && sequences.length === 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-center justify-between">
          <p className="text-sm text-amber-300">Un programme existe déjà pour ce dimanche.</p>
          <button onClick={loadExisting} className="text-xs text-primary hover:underline">Charger →</button>
        </div>
      )}

      {selectedSundayId !== '' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Séquences</label>
              <button onClick={addSequence} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
            {sequences.map((seq, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 flex gap-2 items-start">
                <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                  <button onClick={() => moveSequence(idx, 'up')} disabled={idx === 0} className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground text-center">{seq.ordre}</span>
                  <button onClick={() => moveSequence(idx, 'down')} disabled={idx === sequences.length - 1} className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <select value={seq.type} onChange={e => updateSequence(idx, 'type', e.target.value)}
                  className="rounded border border-border bg-muted text-xs px-2 py-1.5 w-28 shrink-0">
                  {SEQUENCE_TYPES.map(t => <option key={t} value={t}>{SEQUENCE_TYPE_LABELS[t]}</option>)}
                </select>
                <input type="text" value={seq.titre} onChange={e => updateSequence(idx, 'titre', e.target.value)}
                  placeholder="Titre / chant"
                  className="flex-1 rounded border border-border bg-muted text-xs px-2 py-1.5 min-w-0" />
                <input type="text" value={seq.notes} onChange={e => updateSequence(idx, 'notes', e.target.value)}
                  placeholder="Notes"
                  className="w-32 rounded border border-border bg-muted text-xs px-2 py-1.5 hidden sm:block" />
                <button onClick={() => removeSequence(idx)} className="text-muted-foreground/50 hover:text-destructive shrink-0 pt-1.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {sequences.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune séquence — clique sur Ajouter</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note globale (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm resize-none"
              placeholder="Informations complémentaires…" />
          </div>

          <button
            disabled={sequences.length === 0 || submitMut.isPending}
            onClick={() => submitMut.mutate()}
            className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {submitMut.isPending ? 'Envoi…' : 'Soumettre le programme'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AefvPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: sundays = [] } = useQuery({
    queryKey: ['next-sundays-admin'],
    queryFn:  getNextSundays,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['video-meta-admin'],
    queryFn:  getVideoMetaList,
  });

  const { data: team = [] } = useQuery({
    queryKey: ['aefv-team-admin'],
    queryFn:  getAEFVTeam,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">AEFV — Vidéo</h1>
        <p className="text-sm text-muted-foreground">Gestion de l'équipe et des archives vidéo</p>
      </div>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div>
        {activeTab === 'overview'  && <OverviewTab  sundays={sundays} videos={videos} team={team} />}
        {activeTab === 'planning'  && <PlanningTab  sundays={sundays} team={team} />}
        {activeTab === 'fiches'    && <FichesTab    videos={videos} />}
        {activeTab === 'equipe'    && <EquipeTab    team={team} />}
        {activeTab === 'programme' && <ProgrammeTab sundays={sundays} />}
      </div>
    </div>
  );
}
