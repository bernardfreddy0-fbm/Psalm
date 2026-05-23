import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVideoMetaList, deleteVideoMeta, getAEFVTeam, getVideoAssignments,
  saveVideoAssignment, removeVideoAssignment,
  STATUS_LABELS, STATUS_COLORS,
  type VideoMetaSummary, type VideoStatus, type VideoAssignment, type AEFVMember,
} from '@/lib/api';
import { apiFetch } from '@/lib/apiClient';
import {
  Video, CheckCircle, XCircle, Trash2, ExternalLink,
  Search, Calendar, Users, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Checklist ─────────────────────────────────────────────────────────────────

const CHECKLIST_LABELS = [
  { key: 'montage',        icon: '✂️', label: 'Montage' },
  { key: 'subtitles',      icon: '💬', label: 'Sous-titres' },
  { key: 'thumbnail',      icon: '🖼️', label: 'Miniature' },
  { key: 'description_yt', icon: '📝', label: 'Description YT' },
  { key: 'published',      icon: '✅', label: 'Publiée' },
] as const;

function checkCount(c: VideoMetaSummary['checklist']) {
  return CHECKLIST_LABELS.filter(l => c[l.key]).length;
}

// ── Badge statut ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VideoStatus }) {
  const col = STATUS_COLORS[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Miniature YouTube ─────────────────────────────────────────────────────────

function YoutubeThumb({ videoId }: { videoId: string }) {
  return (
    <a
      href={`https://youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block shrink-0 relative group"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
        alt=""
        className="w-24 h-14 object-cover rounded-md"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
        <ExternalLink className="w-4 h-4 text-white" />
      </div>
    </a>
  );
}

// ── Libellé rôle ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  responsable_video:        'Resp. Vidéo',
  referent_planning_video:  'Réf. Planning',
  referent_technique_video: 'Réf. Technique',
  videaste:                 'Vidéaste',
};

function roleLabel(role: string | null): string {
  if (!role) return '';
  const parts = role.split(',').map(r => r.trim());
  for (const r of parts) {
    if (ROLE_LABELS[r]) return ROLE_LABELS[r];
  }
  return '';
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '33' + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

// ── Panneau planning mensuel ──────────────────────────────────────────────────

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface SundayRow { id: number; date: string; label: string | null }

function MonthlyPlanningPanel({ team }: { team: AEFVMember[] }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editSunday, setEditSunday] = useState<SundayRow | null>(null);
  const [selectedVideaste, setSelectedVideaste] = useState('');
  const [note, setNote] = useState('');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['video-assignments', year, month],
    queryFn:  () => getVideoAssignments(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const { data: sundays = [] } = useQuery<SundayRow[]>({
    queryKey: ['planning-sundays', year],
    queryFn:  () => apiFetch<any[]>(`/planning/${year}`).then(rows =>
      rows.map(r => ({ id: r.id, date: r.date, label: r.label ?? null }))
    ),
    staleTime: 5 * 60 * 1000,
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFrom = `${year}-${pad(month)}-01`;
  const dateTo   = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`;
  const monthSundays = sundays
    .filter(s => s.date >= dateFrom && s.date <= dateTo)
    .sort((a, b) => a.date.localeCompare(b.date));

  const assignmentMap = new Map<number, VideoAssignment>(
    assignments.map(a => [a.sunday_id, a])
  );

  const saveMut = useMutation({
    mutationFn: ({ sundayId, videasteId, note }: { sundayId: number; videasteId: string; note: string }) =>
      saveVideoAssignment(sundayId, videasteId, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-assignments', year, month] });
      toast.success('Assignation sauvegardée');
      setEditSunday(null);
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const removeMut = useMutation({
    mutationFn: (sundayId: number) => removeVideoAssignment(sundayId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['video-assignments', year, month] });
      toast.success('Assignation supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function openEdit(sunday: SundayRow) {
    const existing = assignmentMap.get(sunday.id);
    setEditSunday(sunday);
    setSelectedVideaste(existing?.videaste.id ?? '');
    setNote(existing?.note ?? '');
  }

  const videasters = team.filter(m => {
    const roles = (m.role ?? '').split(',').map(r => r.trim());
    return roles.some(r => ['videaste', 'referent_planning_video', 'referent_technique_video', 'responsable_video'].includes(r));
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Planning vidéo mensuel</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
            {MOIS_FR[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corps */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Chargement…</p>
      ) : monthSundays.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Aucun dimanche dans le planning pour ce mois.</p>
      ) : (
        <div className="divide-y divide-border">
          {monthSundays.map(sunday => {
            const a = assignmentMap.get(sunday.id);
            const dateStr = new Date(sunday.date + 'T00:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long',
            });
            return (
              <div key={sunday.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize">{dateStr}</p>
                  {sunday.label && <p className="text-[11px] text-muted-foreground">{sunday.label}</p>}
                </div>
                {a ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/20 rounded-lg px-2.5 py-1">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">
                          {a.videaste.first_name[0]}{a.videaste.last_name[0]}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {a.videaste.first_name} {a.videaste.last_name}
                      </span>
                    </div>
                    <button onClick={() => openEdit(sunday)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Modifier</button>
                    <button
                      onClick={() => { if (confirm('Supprimer cette assignation ?')) removeMut.mutate(sunday.id); }}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openEdit(sunday)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border border-dashed"
                  >
                    + Assigner
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal assignation */}
      {editSunday && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Assigner un vidéaste</h3>
              <button onClick={() => setEditSunday(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {new Date(editSunday.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Vidéaste</label>
              <select
                value={selectedVideaste}
                onChange={e => setSelectedVideaste(e.target.value)}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Choisir…</option>
                {videasters.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({roleLabel(m.role) || 'Équipe'})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Note (optionnel)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex. : Caméra principale…"
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditSunday(null)} className="text-xs px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                Annuler
              </button>
              <button
                disabled={!selectedVideaste || saveMut.isPending}
                onClick={() => saveMut.mutate({ sundayId: editSunday.id, videasteId: selectedVideaste, note })}
                className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saveMut.isPending ? 'Sauvegarde…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Annuaire équipe ───────────────────────────────────────────────────────────

function TeamPanel({ team }: { team: AEFVMember[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Équipe AEFV</span>
        <span className="ml-auto text-xs text-muted-foreground">{team.length} membres</span>
      </div>
      <div className="divide-y divide-border">
        {team.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary">{m.first_name[0]}{m.last_name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel(m.role) || 'AEFV'}</p>
            </div>
            {m.phone && (
              <div className="flex items-center gap-1.5">
                <a href={`tel:${m.phone}`} className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                  {m.phone}
                </a>
                <a
                  href={waLink(m.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors font-medium"
                >
                  WA
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type ViewTab = 'fiches' | 'planning' | 'team';

export default function ArchivesAdminPage() {
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all' | 'pending' | 'done'>('all');
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'all'>('all');
  const [viewTab, setViewTab]     = useState<ViewTab>('fiches');
  const qc = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['admin-archives'],
    queryFn:  getVideoMetaList,
  });

  const { data: team = [] } = useQuery({
    queryKey: ['aefv-team'],
    queryFn:  getAEFVTeam,
    staleTime: 10 * 60 * 1000,
  });

  const deleteVideo = useMutation({
    mutationFn: deleteVideoMeta,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-archives'] }); toast.success('Fiche supprimée'); },
    onError:    () => toast.error('Erreur lors de la suppression'),
  });

  const filtered = videos.filter(v => {
    const q = search.toLowerCase();
    const matchQ = !q || (v.theme ?? '').toLowerCase().includes(q) || (v.preacher ?? '').toLowerCase().includes(q) || v.video_id.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (filter === 'done')    return v.checklist.published;
    if (filter === 'pending') return !v.checklist.published;
    return true;
  });

  // KPIs
  const kpis = {
    brut:       videos.filter(v => (v.status ?? 'brut') === 'brut').length,
    montage:    videos.filter(v => v.status === 'montage').length,
    validation: videos.filter(v => v.status === 'validation').length,
    publie:     videos.filter(v => v.status === 'publie').length,
  };

  const TABS: { id: ViewTab; label: string }[] = [
    { id: 'fiches',   label: `Fiches (${videos.length})` },
    { id: 'planning', label: 'Planning mensuel' },
    { id: 'team',     label: `Équipe (${team.length})` },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">AEFV</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-emerald-500 font-semibold">{kpis.publie}</span> publiées ·{' '}
          <span className="text-amber-400 font-semibold">{kpis.validation}</span> en validation ·{' '}
          <span className="text-blue-400 font-semibold">{kpis.montage}</span> montage
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setViewTab(t.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
              viewTab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Onglet Fiches ── */}
      {viewTab === 'fiches' && (
        <>
          {/* Filtres */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher par thème, prédicateur, ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              {(['all', 'pending', 'done'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {f === 'all' ? 'Tout' : f === 'pending' ? 'En cours' : 'Publiées'}
                </button>
              ))}
            </div>
          </div>

          {/* Filtre statut */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'brut', 'montage', 'validation', 'publie'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : s === 'all'
                    ? 'border-border text-muted-foreground'
                    : `border-transparent ${STATUS_COLORS[s as VideoStatus]?.bg} ${STATUS_COLORS[s as VideoStatus]?.text}`
                }`}>
                {s === 'all' ? `Tous (${videos.length})` : `${STATUS_LABELS[s as VideoStatus]} (${kpis[s as VideoStatus]})`}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Chargement...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Video className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aucune archive vidéo</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Les métadonnées sont saisies par les vidéastes dans l'espace membre</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(v => {
                const done  = checkCount(v.checklist);
                const total = CHECKLIST_LABELS.length;
                const pct   = Math.round(done / total * 100);

                return (
                  <div key={v.video_id} className="bg-card border border-border rounded-lg p-4 flex gap-4">
                    <YoutubeThumb videoId={v.video_id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-foreground truncate">{v.theme || '(sans thème)'}</p>
                            <StatusBadge status={v.status ?? 'brut'} />
                          </div>
                          {v.preacher && <p className="text-xs text-muted-foreground">🎤 {v.preacher}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={`https://youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono">
                            {v.video_id}
                          </a>
                          <button
                            onClick={() => { if (confirm(`Supprimer les métadonnées de ${v.video_id} ?`)) deleteVideo.mutate(v.video_id); }}
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Barre de progression */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
                      </div>

                      {/* Checklist chips */}
                      <div className="flex flex-wrap gap-1">
                        {CHECKLIST_LABELS.map(({ key, icon, label }) => (
                          <span key={key} className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            v.checklist[key] ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                          }`}>
                            {v.checklist[key] ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-50" />}
                            {label}
                          </span>
                        ))}
                      </div>

                      {v.updated_at && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Mis à jour le {new Date(v.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Onglet Planning mensuel ── */}
      {viewTab === 'planning' && <MonthlyPlanningPanel team={team} />}

      {/* ── Onglet Équipe ── */}
      {viewTab === 'team' && <TeamPanel team={team} />}
    </div>
  );
}
