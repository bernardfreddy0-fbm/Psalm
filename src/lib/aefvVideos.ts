// src/lib/aefvVideos.ts
import type { YoutubeVideo, VideoStats } from './youtube';
import type { VideoMetaSummary, VideoStatus } from './api';

/** Une fiche non publiée plus ancienne que ce seuil (jours, depuis updated_at) est "en retard". */
export const LATE_THRESHOLD_DAYS = 10;

export interface MergedVideo {
  video_id:  string;
  title:     string;
  thumbnail: string;
  /** URL chaîne YouTube si la vidéo est sur la chaîne, sinon construite par défaut. */
  url:       string;
  /** Date de publication chaîne (undefined si pas encore publiée / absente du flux). */
  published?: Date;
  status:    VideoStatus;
  fiche?:    VideoMetaSummary;
  stats?:    VideoStats;
  isLate:    boolean;
}

function isStale(updatedAt: string | null, now: Date): boolean {
  if (!updatedAt) return false;
  const ms = now.getTime() - new Date(updatedAt).getTime();
  return ms > LATE_THRESHOLD_DAYS * 86400000;
}

/**
 * Fusionne le flux chaîne (vidéos publiées) et les fiches de prod (video_meta) par video_id.
 * - Vidéo de chaîne sans fiche -> statut "publie" déduit.
 * - Fiche sans vidéo de chaîne -> conservée (en production), pas de date de publication.
 */
export function mergeVideos(
  channel: YoutubeVideo[],
  metas:   VideoMetaSummary[],
  stats:   Map<string, VideoStats>,
  now:     Date = new Date(),
): MergedVideo[] {
  const metaById = new Map(metas.map(m => [m.video_id, m]));
  const out: MergedVideo[] = [];
  const seen = new Set<string>();

  for (const v of channel) {
    const fiche = metaById.get(v.videoId);
    const status: VideoStatus = fiche?.status ?? 'publie';
    out.push({
      video_id:  v.videoId,
      title:     v.title,
      thumbnail: v.thumbnail,
      url:       v.url,
      published: v.published,
      status,
      fiche,
      stats:     stats.get(v.videoId),
      isLate:    status !== 'publie' && isStale(fiche?.updated_at ?? null, now),
    });
    seen.add(v.videoId);
  }

  for (const m of metas) {
    if (seen.has(m.video_id)) continue;
    out.push({
      video_id:  m.video_id,
      title:     m.theme ?? m.video_id,
      thumbnail: `https://img.youtube.com/vi/${m.video_id}/hqdefault.jpg`,
      url:       `https://youtube.com/watch?v=${m.video_id}`,
      published: undefined,
      status:    m.status,
      fiche:     m,
      stats:     stats.get(m.video_id),
      isLate:    m.status !== 'publie' && isStale(m.updated_at, now),
    });
  }

  return out;
}

export interface AefvKpis {
  inProduction:       number;
  late:               number;
  publishedThisMonth: number;
  totalViews:         number;
}

export function computeAefvKpis(merged: MergedVideo[], now: Date = new Date()): AefvKpis {
  const inProd: VideoStatus[] = ['brut', 'montage', 'validation'];
  return {
    inProduction:       merged.filter(m => inProd.includes(m.status)).length,
    late:               merged.filter(m => m.isLate).length,
    publishedThisMonth: merged.filter(m =>
      m.published && m.published.getFullYear() === now.getFullYear() && m.published.getMonth() === now.getMonth()
    ).length,
    totalViews:         merged.reduce((sum, m) => sum + (m.stats?.viewCount ?? 0), 0),
  };
}
