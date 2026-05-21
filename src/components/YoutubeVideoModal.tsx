import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Eye, ThumbsUp, Loader2, Pencil, Check, RotateCcw } from 'lucide-react';
import {
  fetchVideoSnippet,
  fetchVideoStats,
  parseSetlist,
  formatCount,
} from '@/lib/youtube';

interface YoutubeVideoModalProps {
  videoId:  string;
  title:    string;
  onClose:  () => void;
}

const LS_KEY = (id: string) => `yt-desc-override:${id}`;

function loadOverride(videoId: string): string | null {
  try { return localStorage.getItem(LS_KEY(videoId)); } catch { return null; }
}
function saveOverride(videoId: string, text: string) {
  try { localStorage.setItem(LS_KEY(videoId), text); } catch { /* noop */ }
}
function clearOverride(videoId: string) {
  try { localStorage.removeItem(LS_KEY(videoId)); } catch { /* noop */ }
}

export function YoutubeVideoModal({ videoId, title, onClose }: YoutubeVideoModalProps) {
  const hasApiKey  = !!import.meta.env.VITE_YOUTUBE_API_KEY;
  const queryClient = useQueryClient();

  const [editMode, setEditMode]   = useState(false);
  const [draft,    setDraft]      = useState('');
  const [override, setOverride]   = useState<string | null>(() => loadOverride(videoId));

  // Fermeture avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: snippet, isLoading: snippetLoading } = useQuery({
    queryKey: ['yt-snippet', videoId],
    queryFn: () => fetchVideoSnippet(videoId),
    enabled: hasApiKey,
    staleTime: 30 * 60 * 1000,
  });

  const { data: statsMap, isLoading: statsLoading } = useQuery({
    queryKey: ['yt-stats', videoId],
    queryFn: () => fetchVideoStats([videoId]),
    enabled: hasApiKey,
    staleTime: 10 * 60 * 1000,
  });

  const stats     = statsMap?.get(videoId) ?? null;
  const ytDesc    = snippet?.description ?? '';
  const activeDesc = override ?? ytDesc;
  const setlist   = parseSetlist(activeDesc);
  const isLoading = hasApiKey && (snippetLoading || statsLoading);
  const isModified = override !== null;

  function startEdit() {
    setDraft(activeDesc);
    setEditMode(true);
  }

  function saveEdit() {
    saveOverride(videoId, draft);
    setOverride(draft);
    setEditMode(false);
    // invalide le cache setlist pour forcer le recalcul
    queryClient.invalidateQueries({ queryKey: ['yt-snippet', videoId] });
  }

  function resetToYoutube() {
    clearOverride(videoId);
    setOverride(null);
    setEditMode(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modale */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-3xl bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                {snippet?.title ?? title}
              </h2>
              {isModified && (
                <span className="text-[10px] text-amber-500 font-medium mt-0.5 block">
                  Description modifiée localement
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Contenu scrollable */}
          <div className="overflow-y-auto flex-1">
            {/* Player 16/9 */}
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Stats */}
            {hasApiKey && (
              <div className="px-5 py-3 border-b border-border">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={13} className="animate-spin" />
                    Chargement des stats…
                  </div>
                ) : stats ? (
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye size={13} />
                      {formatCount(stats.viewCount)} vues
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ThumbsUp size={13} />
                      {formatCount(stats.likeCount)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Setlist */}
            {setlist.length > 0 && (
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Setlist
                </p>
                <ul className="space-y-2">
                  {setlist.map((entry, i) => (
                    <li key={i} className="flex items-baseline gap-3 text-sm">
                      <span className="text-primary font-mono text-xs shrink-0">{entry.time}</span>
                      <span className="text-foreground">{entry.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            {(hasApiKey && (snippet || isLoading)) && (
              <div className="px-5 py-4 border-t border-border">
                {/* En-tête section */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                  </p>
                  <div className="flex items-center gap-2">
                    {isModified && !editMode && (
                      <button
                        onClick={resetToYoutube}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        title="Rétablir la description YouTube originale"
                      >
                        <RotateCcw size={11} />
                        Rétablir YouTube
                      </button>
                    )}
                    {!editMode && (
                      <button
                        onClick={startEdit}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
                      >
                        <Pencil size={11} />
                        Modifier
                      </button>
                    )}
                  </div>
                </div>

                {/* Mode lecture */}
                {!editMode && (
                  isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 size={13} className="animate-spin" />
                    </div>
                  ) : activeDesc ? (
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                      {activeDesc}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucune description.</p>
                  )
                )}

                {/* Mode édition */}
                {editMode && (
                  <div className="space-y-2">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={12}
                      className="w-full text-xs font-mono bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                      placeholder="Description de la vidéo…"
                      autoFocus
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Les timestamps (ex: 03:45 Titre) sont détectés automatiquement comme setlist.
                      Modifications sauvegardées localement sur cet appareil.
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={saveEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Check size={12} />
                        Sauvegarder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
