// src/lib/aefvVideos.test.ts
import { describe, it, expect } from 'vitest';
import { mergeVideos, computeAefvKpis, LATE_THRESHOLD_DAYS } from './aefvVideos';
import type { YoutubeVideo, VideoStats } from './youtube';
import type { VideoMetaSummary } from './api';

const NOW = new Date('2026-06-03T00:00:00Z');

function meta(partial: Partial<VideoMetaSummary> & { video_id: string }): VideoMetaSummary {
  return {
    video_id: partial.video_id,
    sunday_id: partial.sunday_id ?? null,
    preacher: partial.preacher ?? null,
    theme: partial.theme ?? null,
    status: partial.status ?? 'brut',
    assigned_to: partial.assigned_to ?? null,
    filmed_by: partial.filmed_by ?? null,
    checklist: { montage: false, subtitles: false, thumbnail: false, description_yt: false, published: false },
    updated_at: partial.updated_at ?? null,
  };
}

function channel(videoId: string, title = 'Culte', published = '2026-05-25T10:00:00Z'): YoutubeVideo {
  return {
    videoId, title,
    published: new Date(published),
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://youtube.com/watch?v=${videoId}`,
    titleDate: null,
  };
}

describe('mergeVideos', () => {
  it('fusionne une vidéo publiée avec sa fiche par video_id', () => {
    const stats = new Map<string, VideoStats>([['abc', { videoId: 'abc', viewCount: 120, likeCount: 8, commentCount: 0 }]]);
    const merged = mergeVideos([channel('abc')], [meta({ video_id: 'abc', status: 'publie', theme: 'Foi' })], stats, NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].video_id).toBe('abc');
    expect(merged[0].published).not.toBeUndefined();
    expect(merged[0].status).toBe('publie');
    expect(merged[0].fiche?.theme).toBe('Foi');
    expect(merged[0].stats?.viewCount).toBe(120);
    expect(merged[0].isLate).toBe(false);
  });

  it('inclut une vidéo de chaîne sans fiche (statut publie déduit)', () => {
    const merged = mergeVideos([channel('xyz')], [], new Map(), NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('publie');
    expect(merged[0].fiche).toBeUndefined();
  });

  it('inclut une fiche en production absente de la chaîne (sans url chaîne)', () => {
    const merged = mergeVideos([], [meta({ video_id: 'prod1', status: 'montage' })], new Map(), NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('montage');
    expect(merged[0].published).toBeUndefined();
  });

  it('marque isLate une fiche non publiée stagnante (> seuil)', () => {
    const old = new Date(NOW.getTime() - (LATE_THRESHOLD_DAYS + 2) * 86400000).toISOString();
    const fresh = new Date(NOW.getTime() - 2 * 86400000).toISOString();
    const merged = mergeVideos(
      [],
      [meta({ video_id: 'late', status: 'brut', updated_at: old }), meta({ video_id: 'ok', status: 'brut', updated_at: fresh })],
      new Map(), NOW,
    );
    const late = merged.find(m => m.video_id === 'late')!;
    const ok   = merged.find(m => m.video_id === 'ok')!;
    expect(late.isLate).toBe(true);
    expect(ok.isLate).toBe(false);
  });

  it('ne déduplique pas : une seule entrée par video_id', () => {
    const merged = mergeVideos([channel('dup')], [meta({ video_id: 'dup', status: 'publie' })], new Map(), NOW);
    expect(merged).toHaveLength(1);
  });
});

describe('computeAefvKpis', () => {
  it('calcule production, retard, publiées ce mois et vues totales', () => {
    const stats = new Map<string, VideoStats>([
      ['p1', { videoId: 'p1', viewCount: 100, likeCount: 1, commentCount: 0 }],
      ['p2', { videoId: 'p2', viewCount: 50, likeCount: 0, commentCount: 0 }],
    ]);
    const merged = mergeVideos(
      [channel('p1', 'a', '2026-06-01T00:00:00Z'), channel('p2', 'b', '2026-04-01T00:00:00Z')],
      [meta({ video_id: 'p1', status: 'publie' }), meta({ video_id: 'm1', status: 'montage' })],
      stats, NOW,
    );
    const k = computeAefvKpis(merged, NOW);
    expect(k.inProduction).toBe(1);          // m1
    expect(k.publishedThisMonth).toBe(1);     // p1 publiée en juin
    expect(k.totalViews).toBe(150);
  });
});
