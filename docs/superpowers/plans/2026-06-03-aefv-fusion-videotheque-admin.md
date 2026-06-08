# AEFV — Fusion vidéothèque dans le module AEFV (admin) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner l'ancienne vidéothèque YouTube dans le module AEFV de l'admin en remplaçant l'onglet « Fiches » par un onglet « Vidéos » (cockpit cycle de vie : Pipeline + Catalogue), et renommer la route `/archives` → `/aefv`.

**Architecture:** 100 % front (aucun backend). Une fonction pure `mergeVideos` (testée) fusionne le flux chaîne YouTube (`fetchYoutubeVideos` + `fetchVideoStats`) avec les fiches de prod (`getVideoMetaList`). Un composant `VideosTab` consomme cette fusion et offre deux vues (Pipeline kanban / Catalogue par mois) + KPI + recherche/filtre.

**Tech Stack:** React 18 + TypeScript + Vite, React Query v5, Tailwind, lucide-react, Vitest + @testing-library/react. Projet `Psalm` (admin-psalm.a-e-f.fr), déploiement `git push fork main` → Coolify.

**Spec:** `docs/superpowers/specs/2026-06-03-aefv-fusion-videotheque-admin-design.md`

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/lib/aefvVideos.ts` (créer) | Logique pure : type `MergedVideo`, `mergeVideos()`, `computeAefvKpis()`. Aucune dépendance React. |
| `src/lib/aefvVideos.test.ts` (créer) | Tests unitaires de la logique de fusion. |
| `src/pages/AefvPage.tsx` (renommé depuis `ArchivesAdminPage.tsx`) | Page module AEFV : onglets, fetch des données, branche `VideosTab`. |
| `src/pages/aefv/VideosTab.tsx` (créer) | Onglet « Vidéos » : KPI + bascule Pipeline/Catalogue + recherche/filtre. |
| `src/pages/aefv/VideosTab.test.tsx` (créer) | Test de rendu de `VideosTab`. |
| `src/App.tsx` (modifier) | Route `/aefv` + redirection `/archives` → `/aefv`, import renommé. |
| `src/components/AppLayout.tsx` (modifier) | Entrée menu et `pageTitles` : `/archives` → `/aefv`. |

---

## Task 1: Logique de fusion pure + tests

**Files:**
- Create: `src/lib/aefvVideos.ts`
- Test: `src/lib/aefvVideos.test.ts`

- [x] **Step 1: Écrire le test qui échoue**

```typescript
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
```

- [x] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd /Users/fbm/Desktop/Psalm && npx vitest run src/lib/aefvVideos.test.ts`
Expected: FAIL — `Failed to resolve import "./aefvVideos"`.

- [x] **Step 3: Implémenter la logique pure**

```typescript
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
```

- [x] **Step 4: Lancer le test pour vérifier le succès**

Run: `cd /Users/fbm/Desktop/Psalm && npx vitest run src/lib/aefvVideos.test.ts`
Expected: PASS (toutes assertions vertes).

- [x] **Step 5: Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/lib/aefvVideos.ts src/lib/aefvVideos.test.ts
git commit -m "feat(aefv): logique pure de fusion vidéothèque + fiches (mergeVideos)"
```

---

## Task 2: Renommer la route /archives → /aefv + redirection + nav

**Files:**
- Modify (git mv): `src/pages/ArchivesAdminPage.tsx` → `src/pages/AefvPage.tsx`
- Modify: `src/App.tsx:21`, `src/App.tsx:72`
- Modify: `src/components/AppLayout.tsx:45`, `src/components/AppLayout.tsx:74`

- [x] **Step 1: Renommer le fichier de page**

```bash
cd /Users/fbm/Desktop/Psalm
git mv src/pages/ArchivesAdminPage.tsx src/pages/AefvPage.tsx
```

- [x] **Step 2: Renommer le composant exporté**

Dans `src/pages/AefvPage.tsx`, remplacer la signature du composant :

```typescript
// AVANT : export default function ArchivesAdminPage() {
export default function AefvPage() {
```

- [x] **Step 3: Mettre à jour App.tsx (import + route + redirection)**

Dans `src/App.tsx` ligne 21, remplacer l'import :

```typescript
import AefvPage from "@/pages/AefvPage";
```

Ligne 72, remplacer la route par la nouvelle route + une redirection de compatibilité :

```tsx
<Route path="/aefv" element={<Guard action="archives_view"><AefvPage /></Guard>} />
<Route path="/archives" element={<Navigate to="/aefv" replace />} />
```

(`Navigate` est déjà importé ligne 2.)

- [x] **Step 4: Mettre à jour la navigation**

Dans `src/components/AppLayout.tsx` ligne 45 :

```typescript
      { to: '/aefv', icon: Video, label: 'AEFV' },
```

Ligne 74 (table `pageTitles`) — remplacer la clé :

```typescript
  '/aefv': 'AEFV',
```

- [x] **Step 5: Vérifier le build**

Run: `cd /Users/fbm/Desktop/Psalm && npm run build`
Expected: build OK (`✓ built`), aucune erreur TypeScript de référence à `ArchivesAdminPage`.

- [x] **Step 6: Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/AefvPage.tsx src/App.tsx src/components/AppLayout.tsx
git commit -m "refactor(aefv): route /archives -> /aefv (+ redirection) et renommage page"
```

---

## Task 3: Composant VideosTab (Pipeline + Catalogue + KPI)

**Files:**
- Create: `src/pages/aefv/VideosTab.tsx`

Ce composant reçoit les vidéos fusionnées + l'état de chargement/erreur du flux chaîne, et l'équipe (pour résoudre l'assigné). Il n'effectue aucun fetch lui-même (fait en Task 4).

- [x] **Step 1: Créer le composant**

```tsx
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
```

- [x] **Step 2: Vérifier le build (composant isolé compile)**

Run: `cd /Users/fbm/Desktop/Psalm && npm run build`
Expected: build OK. (Le composant n'est pas encore branché ; il doit compiler. S'il signale `VideosTab` non utilisé, c'est attendu — il sera branché en Task 4. Si la règle `noUnusedLocals` bloque l'export inutilisé, passer directement à Task 4 puis builder.)

- [x] **Step 3: Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/aefv/VideosTab.tsx
git commit -m "feat(aefv): composant VideosTab (pipeline + catalogue + KPI)"
```

---

## Task 4: Brancher VideosTab dans AefvPage (remplace Fiches)

**Files:**
- Modify: `src/pages/AefvPage.tsx`

- [x] **Step 1: Mettre à jour les imports en tête de `AefvPage.tsx`**

Ajouter sous les imports existants de `lucide-react` / `@/lib/api` :

```typescript
import { fetchYoutubeVideos, fetchVideoStats } from '@/lib/youtube';
import { mergeVideos } from '@/lib/aefvVideos';
import { VideosTab } from '@/pages/aefv/VideosTab';
```

- [x] **Step 2: Changer le type Tab et les onglets**

Remplacer la définition (vers le haut du fichier) :

```typescript
type Tab = 'overview' | 'planning' | 'videos' | 'equipe' | 'programme';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'planning',   label: 'Planning',        icon: Calendar },
  { id: 'videos',     label: 'Vidéos',          icon: Video },
  { id: 'equipe',     label: 'Équipe',          icon: Users },
  { id: 'programme',  label: 'Programme',       icon: BookOpen },
];
```

- [x] **Step 3: Supprimer l'ancien `FichesTab`**

Supprimer entièrement la fonction `function FichesTab({ videos }: { videos: VideoMetaSummary[] }) { … }` (le bloc allant de sa signature jusqu'à son `}` final). Le composant `StatusBadge` défini plus haut dans le fichier reste utilisé par d'autres onglets — ne pas le supprimer.

- [x] **Step 4: Ajouter les fetchs chaîne + fusion dans le composant `AefvPage`**

Dans `AefvPage()`, sous les `useQuery` existants (`sundays`, `videos`, `team`), ajouter :

```typescript
  const channelQuery = useQuery({
    queryKey: ['yt-channel-admin'],
    queryFn:  fetchYoutubeVideos,
    retry: false,
  });
  const channelVideos = channelQuery.data ?? [];

  const statsQuery = useQuery({
    queryKey: ['yt-stats-admin', channelVideos.map(v => v.videoId).join(',')],
    queryFn:  () => fetchVideoStats(channelVideos.map(v => v.videoId)),
    enabled:  channelVideos.length > 0,
  });

  const merged = useMemo(
    () => mergeVideos(channelVideos, videos, statsQuery.data ?? new Map()),
    [channelVideos, videos, statsQuery.data],
  );
```

(`useMemo` est déjà importé ligne 1.)

- [x] **Step 5: Brancher l'onglet dans le rendu**

Remplacer la ligne :

```tsx
{activeTab === 'fiches'    && <FichesTab    videos={videos} />}
```

par :

```tsx
{activeTab === 'videos'    && (
  <VideosTab
    merged={merged}
    team={team}
    channelError={channelQuery.isError}
    isLoading={channelQuery.isLoading && videos.length === 0}
  />
)}
```

- [x] **Step 6: Vérifier le build**

Run: `cd /Users/fbm/Desktop/Psalm && npm run build`
Expected: build OK, aucune référence restante à `FichesTab` ni à `'fiches'`.

- [x] **Step 7: Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/AefvPage.tsx
git commit -m "feat(aefv): onglet Vidéos unifié remplace Fiches (fusion chaîne + fiches)"
```

---

## Task 5: Test de rendu VideosTab

**Files:**
- Create: `src/pages/aefv/VideosTab.test.tsx`

- [x] **Step 1: Écrire le test de rendu**

```tsx
// src/pages/aefv/VideosTab.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VideosTab } from './VideosTab';
import type { MergedVideo } from '@/lib/aefvVideos';

afterEach(cleanup);

const merged: MergedVideo[] = [
  { video_id: 'pub1', title: 'Culte du 25/05', thumbnail: 't', url: 'u',
    published: new Date('2026-05-25T00:00:00Z'), status: 'publie',
    stats: { videoId: 'pub1', viewCount: 200, likeCount: 5, commentCount: 0 }, isLate: false,
    fiche: { video_id: 'pub1', sunday_id: null, preacher: 'Past. X', theme: 'Espérance', status: 'publie', assigned_to: null, filmed_by: null, checklist: { montage: true, subtitles: true, thumbnail: true, description_yt: true, published: true }, updated_at: null } },
  { video_id: 'prod1', title: 'prod1', thumbnail: 't', url: 'u',
    published: undefined, status: 'montage', isLate: true,
    fiche: { video_id: 'prod1', sunday_id: null, preacher: null, theme: 'En cours', status: 'montage', assigned_to: null, filmed_by: null, checklist: { montage: false, subtitles: false, thumbnail: false, description_yt: false, published: false }, updated_at: null } },
];

describe('VideosTab', () => {
  it('affiche le pipeline par défaut avec les colonnes de statut', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('bascule en Catalogue et ne montre que les vidéos publiées', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    fireEvent.click(screen.getByText('Catalogue'));
    expect(screen.getByText('Mai 2026')).toBeInTheDocument();
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });

  it('affiche un avertissement quand le flux chaîne est en erreur', () => {
    render(<VideosTab merged={merged} team={[]} channelError={true} isLoading={false} />);
    expect(screen.getByText(/Vidéothèque de la chaîne indisponible/)).toBeInTheDocument();
  });

  it('filtre par recherche', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: 'Espérance' } });
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Lancer le test**

Run: `cd /Users/fbm/Desktop/Psalm && npx vitest run src/pages/aefv/VideosTab.test.tsx`
Expected: PASS. (Si `@testing-library/jest-dom` n'est pas configuré globalement, remplacer `toBeInTheDocument()` par `expect(screen.queryByText(...)).not.toBeNull()` ; vérifier d'abord `src/test/setup.ts` ou la config `vitest.config.ts`.)

- [x] **Step 3: Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/aefv/VideosTab.test.tsx
git commit -m "test(aefv): rendu VideosTab (pipeline/catalogue/recherche/erreur chaîne)"
```

---

## Task 6: Vérification finale, suite de tests, build, déploiement

**Files:** aucun (vérification).

- [x] **Step 1: Lancer toute la suite de tests**

Run: `cd /Users/fbm/Desktop/Psalm && npm run test`
Expected: tous les tests passent (dont `aefvVideos.test.ts` et `VideosTab.test.tsx`).

- [x] **Step 2: Build de production**

Run: `cd /Users/fbm/Desktop/Psalm && npm run build`
Expected: `✓ built`, zéro erreur TypeScript.

- [x] **Step 3: Vérifier l'absence de références mortes**

Run: `cd /Users/fbm/Desktop/Psalm && grep -rn "ArchivesAdminPage\|FichesTab\|'fiches'\|/archives" src/`
Expected: seules occurrences acceptables = la redirection `/archives` -> `/aefv` dans `App.tsx`, et d'éventuels appels API `apiFetch('/archives')` dans `src/lib/api.ts` (endpoints backend, à NE PAS toucher). Aucune référence à `ArchivesAdminPage`, `FichesTab` ou au tab `'fiches'`.

- [ ] **Step 4: Déployer**

```bash
cd /Users/fbm/Desktop/Psalm
git push fork main
curl -s "http://141.94.95.7:8000/api/v1/deploy?uuid=g5f2n17hj8ie2mukuixstsg0" -H "Authorization: Bearer 1|claudetoken123"
```

- [ ] **Step 5: Vérification déployée (admin-psalm)**

Après rebuild Coolify (statut `finished`) : se connecter à admin-psalm.a-e-f.fr, ouvrir le module **AEFV**, vérifier :
- l'onglet s'appelle **« Vidéos »** (plus de « Fiches ») ;
- mode **Pipeline** : colonnes Brut/Montage/Validation/Publié alimentées ;
- mode **Catalogue** : vidéos publiées groupées par mois avec vues ;
- la KPI et la recherche fonctionnent ;
- l'URL **`/archives` redirige vers `/aefv`**.

---

## Notes d'exécution
- Respecter l'ordre des tâches (1 → 6). La logique pure (Task 1) est la fondation testée ; l'UI (Task 3/4) s'appuie dessus.
- Ne PAS modifier le backend (`AEFApi`) ni les endpoints `/archives` côté API (`src/lib/api.ts` les appelle, c'est volontaire).
- Pattern à répliquer ensuite sur PsalmMembre (`/video`) puis AEFVApp (sessions dédiées).
