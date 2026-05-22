import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVideoMetaList, deleteVideoMeta, type VideoMetaSummary } from '@/lib/api';
import { Video, CheckCircle, XCircle, Trash2, ExternalLink, Search } from 'lucide-react';

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

export default function ArchivesAdminPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const qc = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['admin-archives'],
    queryFn: getVideoMetaList,
  });

  const deleteVideo = useMutation({
    mutationFn: deleteVideoMeta,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-archives'] }),
  });

  const filtered = videos.filter(v => {
    const q = search.toLowerCase();
    const matchQ = !q || (v.theme || '').toLowerCase().includes(q) || (v.preacher || '').toLowerCase().includes(q) || v.video_id.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (filter === 'done') return v.checklist.published;
    if (filter === 'pending') return !v.checklist.published;
    return true;
  });

  const doneCount = videos.filter(v => v.checklist.published).length;
  const pendingCount = videos.length - doneCount;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">AEFV</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-emerald-500 font-semibold">{doneCount}</span> publiées ·{' '}
          <span className="text-amber-400 font-semibold">{pendingCount}</span> en cours
        </div>
      </div>

      {/* Filters */}
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
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Tout' : f === 'pending' ? 'En cours' : 'Publiées'}
            </button>
          ))}
        </div>
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
            const done = checkCount(v.checklist);
            const total = CHECKLIST_LABELS.length;
            const pct = Math.round(done / total * 100);

            return (
              <div key={v.video_id} className="bg-card border border-border rounded-lg p-4 flex gap-4">
                <YoutubeThumb videoId={v.video_id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{v.theme || '(sans thème)'}</p>
                      {v.preacher && <p className="text-xs text-muted-foreground">🎤 {v.preacher}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://youtube.com/watch?v=${v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
                      >
                        {v.video_id}
                      </a>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer les métadonnées de ${v.video_id} ?`)) {
                            deleteVideo.mutate(v.video_id);
                          }
                        }}
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
                  </div>

                  {/* Checklist chips */}
                  <div className="flex flex-wrap gap-1">
                    {CHECKLIST_LABELS.map(({ key, icon, label }) => (
                      <span
                        key={key}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          v.checklist[key]
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {v.checklist[key]
                          ? <CheckCircle className="w-3 h-3" />
                          : <XCircle className="w-3 h-3 opacity-50" />}
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
    </div>
  );
}
