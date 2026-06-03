// src/pages/aefv/VideosTab.tsx
import { useMemo, useState } from 'react';
import { ExternalLink, Search, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS, type VideoStatus, type AEFVMember } from '@/lib/api';
import { groupVideosByMonth } from '@/lib/youtube';
import { computeAefvKpis, type MergedVideo } from '@/lib/aefvVideos';

const MONTH_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function formatViews(n?: number): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')} k`;
  return String(n);
}

function StatusBadge({ status }: { status: VideoStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className={`text-2xl font-bold ${accent ?? 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function teamName(team: AEFVMember[], id: string | null | undefined): string {
  if (!id) return '—';
  const m = team.find(t => t.id === id);
  return m ? `${m.first_name} ${m.last_name}`.trim() : '—';
}

function VideoCard({ v, team }: { v: MergedVideo; team: AEFVMember[] }) {
  return (
    <a
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors"
    >
      <div className="relative aspect-video bg-muted">
        <img src={v.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        {v.isLate && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-red-500/90 text-white text-[10px] font-semibold px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> En retard
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5"><StatusBadge status={v.status} /></span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate flex items-center gap-1">
          {v.fiche?.theme ?? v.title}
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {v.fiche?.preacher ?? '—'}
          {v.published && ` · ${v.published.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {v.published ? `${formatViews(v.stats?.viewCount)} vues` : `Vidéaste : ${teamName(team, v.fiche?.filmed_by ?? v.fiche?.assigned_to)}`}
        </p>
      </div>
    </a>
  );
}

const PIPELINE_COLUMNS: VideoStatus[] = ['brut', 'montage', 'validation', 'publie'];

export function VideosTab({
  merged, team, channelError, isLoading,
}: {
  merged: MergedVideo[];
  team: AEFVMember[];
  channelError: boolean;
  isLoading: boolean;
}) {
  const [view, setView] = useState<'pipeline' | 'catalogue'>('pipeline');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(v =>
      (v.title?.toLowerCase().includes(q)) ||
      (v.fiche?.theme?.toLowerCase().includes(q)) ||
      (v.fiche?.preacher?.toLowerCase().includes(q))
    );
  }, [merged, search]);

  const kpis = useMemo(() => computeAefvKpis(merged), [merged]);

  const published = useMemo(
    () => filtered.filter(v => v.published).map(v => ({
      videoId: v.video_id, title: v.title, published: v.published!, thumbnail: v.thumbnail, url: v.url, titleDate: null,
    })),
    [filtered],
  );
  const byMonth = useMemo(() => groupVideosByMonth(published), [published]);
  const mergedById = useMemo(() => new Map(filtered.map(v => [v.video_id, v])), [filtered]);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement des vidéos…</div>;
  }

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="En production" value={kpis.inProduction} />
        <Kpi label="En retard" value={kpis.late} accent={kpis.late > 0 ? 'text-red-400' : undefined} />
        <Kpi label="Publiées ce mois" value={kpis.publishedThisMonth} />
        <Kpi label="Vues totales" value={formatViews(kpis.totalViews)} />
      </div>

      {channelError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Vidéothèque de la chaîne indisponible — affichage des fiches de production uniquement.
        </div>
      )}

      {/* Barre : recherche + bascule de vue */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (titre, thème, prédicateur)…"
            className="pl-8 pr-3 py-1.5 rounded-lg bg-muted text-sm w-64 max-w-full outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView('pipeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${view === 'pipeline' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
          </button>
          <button
            onClick={() => setView('catalogue')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${view === 'catalogue' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <List className="w-3.5 h-3.5" /> Catalogue
          </button>
        </div>
      </div>

      {/* Vue Pipeline (kanban) */}
      {view === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE_COLUMNS.map(col => {
            const items = filtered.filter(v => v.status === col);
            return (
              <div key={col} className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <StatusBadge status={col} />
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {items.length === 0
                  ? <p className="text-xs text-muted-foreground py-4 text-center">—</p>
                  : items.map(v => <VideoCard key={v.video_id} v={v} team={team} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* Vue Catalogue (par mois) */}
      {view === 'catalogue' && (
        byMonth.length === 0
          ? <div className="py-16 text-center text-sm text-muted-foreground">Aucune vidéo publiée</div>
          : <div className="space-y-6">
              {byMonth.map(group => (
                <section key={`${group.year}-${group.month}`}>
                  <h3 className="text-sm font-semibold text-foreground mb-3">{MONTH_LABELS[group.month]} {group.year}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.videos.map(yv => {
                      const v = mergedById.get(yv.videoId);
                      return v ? <VideoCard key={v.video_id} v={v} team={team} /> : null;
                    })}
                  </div>
                </section>
              ))}
            </div>
      )}
    </div>
  );
}
