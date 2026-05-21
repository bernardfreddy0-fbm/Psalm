/**
 * Utilitaires YouTube — flux RSS AEF
 *
 * Le flux RSS retourne les 15 dernières vidéos sans clé API.
 * On l'appelle via notre proxy Vercel (/api/youtube-rss) pour éviter le CORS.
 */

export interface YoutubeVideo {
  videoId:   string;
  title:     string;
  published: Date;
  thumbnail: string;
  url:       string;
  /** Date extraite du titre (ex. "Culte AEF du 27/04/25") — peut être null */
  titleDate: Date | null;
}

// ── Parsing ────────────────────────────────────────────────────────────────────

/** Extrait DD/MM/YY d'un titre YouTube (ex. "Culte AEF du 27/04/25"). */
function parseTitleDate(title: string): Date | null {
  // Cherche des patterns comme : "du 27/04/25", "- 21/04/25", "du 14/04/2025"
  const match = title.match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (!match) return null;

  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  let   year  = parseInt(match[3], 10);
  if (year < 100) year += 2000;

  const d = new Date(year, month, day);
  // Validation basique
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d;
}

function parseRss(xml: string): YoutubeVideo[] {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, 'application/xml');

  // Namespaces utilisés dans le flux YouTube
  const NS_MEDIA = 'http://search.yahoo.com/mrss/';
  const NS_YT    = 'http://www.youtube.com/xml/schemas/2015';

  const entries = Array.from(doc.querySelectorAll('entry'));

  return entries.map(entry => {
    const videoId   = entry.getElementsByTagNameNS(NS_YT, 'videoId')[0]?.textContent ?? '';
    const title     = entry.querySelector('title')?.textContent ?? '';
    const published = new Date(entry.querySelector('published')?.textContent ?? '');
    const thumbnail = entry.getElementsByTagNameNS(NS_MEDIA, 'thumbnail')[0]?.getAttribute('url')
      ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    return {
      videoId,
      title,
      published,
      thumbnail,
      url:       `https://www.youtube.com/watch?v=${videoId}`,
      titleDate: parseTitleDate(title),
    };
  });
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

export async function fetchYoutubeVideos(): Promise<YoutubeVideo[]> {
  // Proxy nginx — même domaine, pas de CORS (voir nginx.conf location /youtube-rss)
  const res = await fetch('/youtube-rss');
  if (!res.ok) throw new Error(`YouTube RSS error: ${res.status}`);
  const xml = await res.text();
  return parseRss(xml);
}

// ── Matching avec les dimanches ────────────────────────────────────────────────

/**
 * Retourne la vidéo correspondant à un dimanche donné (±3 jours),
 * en préférant la date extraite du titre à la date de publication.
 */
export function findVideoForSunday(
  sundayDate: string | Date,
  videos: YoutubeVideo[],
): YoutubeVideo | null {
  const target = new Date(sundayDate);
  target.setHours(0, 0, 0, 0);

  let best: YoutubeVideo | null = null;
  let bestDiff = Infinity;

  for (const v of videos) {
    // Préférer la date extraite du titre (plus précise)
    const ref = v.titleDate ?? v.published;
    const d = new Date(ref);
    d.setHours(0, 0, 0, 0);
    const diff = Math.abs(d.getTime() - target.getTime()) / 86400000; // jours

    if (diff <= 3 && diff < bestDiff) {
      best = v;
      bestDiff = diff;
    }
  }

  return best;
}

// ── Regroupement par mois ──────────────────────────────────────────────────────

export interface VideosByMonth {
  year:   number;
  month:  number; // 0-indexed
  videos: YoutubeVideo[];
}

export function groupVideosByMonth(videos: YoutubeVideo[]): VideosByMonth[] {
  const map = new Map<string, VideosByMonth>();

  for (const v of videos) {
    const ref = v.titleDate ?? v.published;
    const y   = ref.getFullYear();
    const m   = ref.getMonth();
    const key = `${y}-${m}`;

    if (!map.has(key)) map.set(key, { year: y, month: m, videos: [] });
    map.get(key)!.videos.push(v);
  }

  // Trier du plus récent au plus ancien
  return [...map.values()].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );
}

// ── YouTube Data API v3 ────────────────────────────────────────────────────────

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const CHANNEL_ID = 'UCfh36TMCg1vhiNn575nD2kw';

export interface VideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

/** Récupère les stats de plusieurs vidéos en un seul appel (max 50 IDs). */
export async function fetchVideoStats(videoIds: string[]): Promise<Map<string, VideoStats>> {
  if (!YT_API_KEY || videoIds.length === 0) return new Map();
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${YT_API_KEY}`
  );
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, VideoStats>();
  for (const item of data.items ?? []) {
    map.set(item.id, {
      videoId:      item.id,
      viewCount:    parseInt(item.statistics?.viewCount    ?? '0', 10),
      likeCount:    parseInt(item.statistics?.likeCount    ?? '0', 10),
      commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
    });
  }
  return map;
}

export interface LiveStream {
  videoId:   string;
  title:     string;
  thumbnail: string;
  url:       string;
}

/** Retourne le live actif si la chaîne diffuse, sinon null. */
export async function fetchActiveLive(): Promise<LiveStream | null> {
  if (!YT_API_KEY) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${YT_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  const videoId = item.id.videoId;
  return {
    videoId,
    title:     item.snippet.title,
    thumbnail: item.snippet.thumbnails?.high?.url ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    url:       `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/** Récupère le snippet (title + description) d'une vidéo. */
export async function fetchVideoSnippet(videoId: string): Promise<{ title: string; description: string } | null> {
  if (!YT_API_KEY) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return { title: item.snippet.title, description: item.snippet.description ?? '' };
}

export interface SetlistEntry {
  time:  string;  // "03:45"
  title: string;  // "À L'Agneau de Dieu"
}

/**
 * Extrait une setlist depuis la description YouTube.
 * Formats reconnus :
 *   03:45 À L'Agneau de Dieu
 *   3:45 - Hosanna
 *   00:00 | Introduction
 */
export function parseSetlist(description: string): SetlistEntry[] {
  const entries: SetlistEntry[] = [];
  for (const line of description.split('\n')) {
    const m = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-|–]?\s*(.+)$/);
    if (m) {
      const title = m[2].trim();
      if (title.length > 1) entries.push({ time: m[1], title });
    }
  }
  return entries;
}

/** Formatte un nombre : 1234567 → "1,2M" ; 12345 → "12k" ; 999 → "999" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}
