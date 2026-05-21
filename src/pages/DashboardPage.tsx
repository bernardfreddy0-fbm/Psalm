import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getPlanning, getSongs, getSpecialEvents, getActivityLogs, type SpecialEvent } from '@/lib/api';
import {
  Users, Music, CalendarRange, Heart, ArrowRight, Mic2,
  AlertTriangle, TrendingUp, Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function parseChoristes(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-accent', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-pink-500', 'bg-teal-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function useCountUp(target: number, duration = 600, enabled = true): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) { setCount(0); return; }
    if (target === 0) { setCount(0); return; }
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return count;
}

function AnimatedCount({ value, loading }: { value: number; loading: boolean }) {
  const count = useCountUp(value, 600, !loading);
  if (loading) return <span className="opacity-30">—</span>;
  return <span>{count}</span>;
}

/** Compute "fullness" of a sunday: ratio of filled slots over expected */
function sundayCompleteness(s: any): { filled: number; total: number; hasCritical: boolean } {
  const slots = [s.dirigeant, s.piano, s.batterie, s.son, s.projection, s.video];
  const choristes = parseChoristes(s.choristes);
  const filled = slots.filter(Boolean).length + choristes.length;
  const total = slots.length + 6; // 6 choristes expected
  const hasCritical = !s.dirigeant || !s.son;
  return { filled, total, hasCritical };
}

function StatusDot({ sunday }: { sunday: any }) {
  const { filled, total, hasCritical } = sundayCompleteness(sunday);
  const ratio = filled / total;
  if (hasCritical) return <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse inline-block" title="Assignation critique manquante" />;
  if (ratio >= 0.8) return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" title="Complet" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Incomplet" />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [sundays, setSundays] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMembers().catch(() => []),
      getSongs().catch(() => []),
      getPlanning(new Date().getFullYear()).catch(() => []),
      getSpecialEvents().catch(() => []),
      getActivityLogs({ limit: 5 }).catch(() => ({ items: [] })),
    ]).then(([m, s, p, ev, logs]) => {
      setMembers(m);
      setSongs(s);
      setSundays(p);
      setSpecialEvents(ev);
      setActivityLogs(logs?.items || []);
      setLoading(false);
    });
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const nextSundays = useMemo(() =>
    sundays.filter(s => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4),
  [sundays, todayStr]);

  const nextSunday = nextSundays[0] ?? null;

  const daysUntilNext = nextSunday
    ? Math.max(0, Math.ceil((new Date(nextSunday.date).getTime() - today.getTime()) / 86400000))
    : null;

  const activeParticipants = useMemo(() => {
    const set = new Set<string>();
    sundays.forEach(s => {
      if (s.dirigeant) set.add(s.dirigeant);
      parseChoristes(s.choristes).forEach(c => set.add(c));
      [s.piano, s.batterie, s.guitare_elec, s.guitare_acou, s.basse, s.son, s.projection, s.video]
        .filter(Boolean).forEach(n => set.add(n));
    });
    return set.size;
  }, [sundays]);

  // Alert: any critical culte in the next 14 days?
  const alertSunday = useMemo(() =>
    nextSundays.find(s => {
      const daysUntil = Math.ceil((new Date(s.date).getTime() - today.getTime()) / 86400000);
      return daysUntil <= 14 && (!s.dirigeant || !s.son);
    }),
  [nextSundays]);

  const nextChoristes = nextSunday ? parseChoristes(nextSunday.choristes) : [];
  const nextAssigned = nextSunday
    ? [nextSunday.dirigeant, nextSunday.piano, nextSunday.batterie, nextSunday.guitare_elec,
       nextSunday.guitare_acou, nextSunday.basse, nextSunday.son, nextSunday.projection, nextSunday.video]
        .filter(Boolean).length + nextChoristes.length
    : 0;

  const completeness = nextSunday ? sundayCompleteness(nextSunday) : { filled: 0, total: 12, hasCritical: false };
  const completePct = Math.round((completeness.filled / completeness.total) * 100);

  const statCards = [
    {
      value: members.length, label: 'Membres', icon: Users,
      color: 'text-accent', bg: 'bg-accent/10', to: '/membres',
    },
    {
      value: songs.length, label: 'Chants', icon: Music,
      color: 'text-blue-500', bg: 'bg-blue-500/10', to: '/chants',
    },
    {
      value: sundays.length, label: 'Cultes planifiés', icon: CalendarRange,
      color: 'text-amber-500', bg: 'bg-amber-500/10', to: '/planning',
    },
    {
      value: activeParticipants, label: 'Bénévoles actifs', icon: Heart,
      color: 'text-emerald-500', bg: 'bg-emerald-500/10', to: '/membres',
    },
  ];

  const upcomingEvents = specialEvents
    .filter(e => e.date_start >= todayStr)
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
    .slice(0, 4);

  const topSongs = [...songs].sort((a, b) => (a.title || '').localeCompare(b.title || '')).slice(0, 5);

  const activityIcon = (action: string) => {
    if (action?.includes('create') || action?.includes('add')) return { icon: '➕', bg: 'bg-emerald-500/10' };
    if (action?.includes('update') || action?.includes('edit')) return { icon: '✏️', bg: 'bg-accent/10' };
    if (action?.includes('delete') || action?.includes('remove')) return { icon: '🗑️', bg: 'bg-destructive/10' };
    return { icon: '📝', bg: 'bg-muted' };
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const formatDateLong = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const eventBadgeColors: Record<string, string> = {
    culte: 'bg-accent/10 text-accent',
    jeunesse: 'bg-amber-100 text-amber-700',
    special: 'bg-purple-100 text-purple-700',
    conference: 'bg-pink-100 text-pink-700',
    camp: 'bg-orange-100 text-orange-700',
    formation: 'bg-teal-100 text-teal-700',
    autre: 'bg-muted text-muted-foreground',
  };

  const eventTypeLabel: Record<string, string> = {
    special: 'Spécial', conference: 'Conférence', camp: 'Camp',
    formation: 'Formation', autre: 'Autre',
  };

  // Team avatars for a sunday
  function teamAvatars(s: any) {
    const names: string[] = [
      s.dirigeant,
      ...parseChoristes(s.choristes).slice(0, 3),
      s.piano, s.batterie, s.son,
    ].filter(Boolean).slice(0, 5);
    return names;
  }

  return (
    <div className="space-y-5">

      {/* ── WEEK BANNER ───────────────────────────────────────── */}
      {nextSunday && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl bg-primary px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
        >
          {/* decorative */}
          <span className="absolute right-5 top-[-16px] text-[120px] leading-none text-white/[0.03] pointer-events-none select-none">♪</span>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-1">Prochain culte</p>
            <h2 className="text-lg font-bold text-white capitalize truncate">
              {nextSunday.label || 'Culte'} — {formatDateLong(nextSunday.date)}
            </h2>
            {nextSunday.note && (
              <p className="text-xs text-white/60 mt-1 italic truncate">📝 {nextSunday.note}</p>
            )}
            {!nextSunday.dirigeant && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold">
                ⚠️ Pas de dirigeant
              </span>
            )}
          </div>

          {/* counters */}
          <div className="flex items-center gap-5 sm:gap-7 flex-shrink-0">
            <div className="text-center">
              <p className="text-3xl font-bold text-white leading-none">{nextChoristes.length}</p>
              <p className="text-[10px] text-white/45 uppercase tracking-wide mt-1">Choristes</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-3xl font-bold text-white leading-none">{nextAssigned}</p>
              <p className="text-[10px] text-white/45 uppercase tracking-wide mt-1">Assignés</p>
            </div>
          </div>

          <button onClick={() => navigate('/planning')}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/12 border border-white/15 text-white text-xs font-medium hover:bg-white/20 transition-colors">
            Gérer <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* ── ALERT STRIP ──────────────────────────────────────── */}
      {alertSunday && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            <strong>{formatDateLong(alertSunday.date)}</strong> — {!alertSunday.dirigeant ? 'Pas de dirigeant.' : ''}{!alertSunday.son ? ' Pas de sono.' : ''}
            {' '}
            <button onClick={() => navigate('/planning')} className="underline font-semibold">Compléter →</button>
          </span>
        </motion.div>
      )}

      {/* ── STAT CARDS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c, i) => (
          <motion.button
            key={c.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => navigate(c.to)}
            className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                <c.icon className={`w-4.5 h-4.5 ${c.color}`} />
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 opacity-70" />
            </div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">
              <AnimatedCount value={c.value} loading={loading} />
            </p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
              <div className={`h-full rounded-full ${c.bg.replace('/10', '')} opacity-60`}
                style={{ width: `${Math.min(100, (c.value / (c.value + 5)) * 100)}%` }} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Planning table */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              📅 Prochains cultes
            </h2>
            <button onClick={() => navigate('/planning')} className="text-xs text-accent font-medium hover:underline">
              Voir tout →
            </button>
          </div>

          {nextSundays.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">Aucun culte planifié</p>
          ) : (
            <div>
              {nextSundays.map((s, i) => {
                const isJeunesse = s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse');
                const avatars = teamAvatars(s);
                const daysUntil = Math.max(0, Math.ceil((new Date(s.date).getTime() - today.getTime()) / 86400000));
                return (
                  <motion.div key={s.id}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    onClick={() => navigate('/planning')}
                    className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">

                    {/* Date */}
                    <div className="text-center min-w-[40px]">
                      <p className="text-xl font-bold text-foreground leading-none">{new Date(s.date).getDate()}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
                        {new Date(s.date).toLocaleDateString('fr-FR', { month: 'short' })}
                      </p>
                    </div>

                    <div className="w-px h-8 bg-border flex-shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{s.label || 'Culte'}</p>
                        {isJeunesse && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide flex-shrink-0">
                            Jeunesse
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        {s.dirigeant && <span className="flex items-center gap-1"><Mic2 className="w-3 h-3" />{s.dirigeant}</span>}
                        <span>{daysUntil === 0 ? "Aujourd'hui" : `Dans ${daysUntil}j`}</span>
                      </div>
                    </div>

                    {/* Avatars */}
                    <div className="flex items-center -space-x-1.5 flex-shrink-0">
                      {avatars.slice(0, 4).map((name, j) => (
                        <div key={j}
                          className={`w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[8px] font-bold text-white ${avatarColor(name)}`}>
                          {getInitials(name)}
                        </div>
                      ))}
                      {avatars.length > 4 && (
                        <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          +{avatars.length - 4}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <StatusDot sunday={s} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: countdown + quick actions */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Countdown card */}
          {nextSunday && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">⏳ Compte à rebours</h2>
              </div>
              <div className="m-4 rounded-lg bg-primary text-center py-5">
                <p className="text-5xl font-bold text-white leading-none tracking-tight">
                  {daysUntilNext ?? '—'}
                </p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-2">jours</p>
                <p className="text-xs text-white/70 mt-2 font-medium capitalize">
                  {formatDateLong(nextSunday.date)}
                </p>
              </div>
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Équipe complète</span>
                  <span className="font-semibold text-foreground">{completePct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${completePct}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">⚡ Accès rapide</h2>
            </div>
            <div className="p-2">
              {[
                { label: 'Programme du culte', desc: 'Ordre du service', emoji: '📋', to: '/programme', bg: 'bg-accent/10' },
                { label: 'Planning Louange', desc: 'Assignations équipe', emoji: '🎵', to: '/planning', bg: 'bg-amber-500/10' },
                { label: 'Bibliothèque', desc: `${songs.length} chants`, emoji: '🎼', to: '/chants', bg: 'bg-blue-500/10' },
                { label: 'Membres', desc: `${members.length} membres`, emoji: '👥', to: '/membres', bg: 'bg-emerald-500/10' },
              ].map(item => (
                <button key={item.to} onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${item.bg}`}>
                    {item.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Activité récente */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-muted-foreground" /> Activité récente
            </h2>
          </div>
          {activityLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune activité récente</p>
          ) : (
            <div>
              {activityLogs.map((log: any, i: number) => {
                const { icon, bg } = activityIcon(log.action);
                return (
                  <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${bg}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug line-clamp-2">
                        <strong>{log.user_name || 'Système'}</strong> — {log.description || log.action}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.created_at ? new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top chants */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">🎵 Chants récents</h2>
            <button onClick={() => navigate('/chants')} className="text-xs text-accent font-medium hover:underline">Voir tout →</button>
          </div>
          {topSongs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun chant</p>
          ) : (
            <div>
              {topSongs.map((song, i) => (
                <motion.div key={song.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate('/chants')}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <span className="text-[11px] text-muted-foreground w-4 text-right flex-shrink-0 tabular-nums">{i + 1}</span>
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-xs flex-shrink-0">🎵</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{song.author || '—'}</p>
                  </div>
                  {song.key && (
                    <span className="text-[10px] font-mono bg-muted border border-border text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                      {song.key}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Événements à venir */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">📌 Événements</h2>
            <button onClick={() => navigate('/evenements')} className="text-xs text-accent font-medium hover:underline">Voir tout →</button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun événement à venir</p>
          ) : (
            <div>
              {upcomingEvents.map((ev, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate('/evenements')}
                  className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                    ev.type === 'camp' ? 'bg-orange-400' :
                    ev.type === 'conference' ? 'bg-pink-400' :
                    ev.type === 'formation' ? 'bg-teal-400' : 'bg-purple-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(ev.date_start)}{ev.date_end && ev.date_end !== ev.date_start ? ` → ${formatDate(ev.date_end)}` : ''}
                    </p>
                    <span className={`mt-1 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded ${eventBadgeColors[ev.type] || 'bg-muted text-muted-foreground'}`}>
                      {eventTypeLabel[ev.type] || ev.type}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
