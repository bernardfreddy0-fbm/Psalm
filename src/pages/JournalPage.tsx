import { useEffect, useState, useCallback } from 'react';
import { getActivityLogs, getActivitySummary, type ActivityLog } from '@/lib/api';
import { RefreshCw, Filter, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  absence:  { emoji: '🙅', label: 'Absence',        color: 'text-destructive',   bg: 'bg-destructive/10' },
  dispo:    { emoji: '📅', label: 'Disponibilité',   color: 'text-blue-600',      bg: 'bg-blue-500/10' },
  member:   { emoji: '👤', label: 'Membre',          color: 'text-emerald-600',   bg: 'bg-emerald-500/10' },
  planning: { emoji: '🗓️', label: 'Planning',        color: 'text-amber-600',     bg: 'bg-amber-500/10' },
  song:     { emoji: '🎵', label: 'Chant',           color: 'text-purple-600',    bg: 'bg-purple-500/10' },
};

const FILTERS = [
  { value: '', label: 'Tout' },
  { value: 'absence',  label: 'Absences' },
  { value: 'dispo',    label: 'Disponibilités' },
  { value: 'member',   label: 'Membres' },
  { value: 'planning', label: 'Planning' },
  { value: 'song',     label: 'Chants' },
];

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 2) return 'Hier';
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diff > 86400 * 365 ? 'numeric' : undefined });
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Group logs by date
function groupByDay(logs: ActivityLog[]): { date: string; label: string; items: ActivityLog[] }[] {
  const groups: Record<string, ActivityLog[]> = {};
  for (const log of logs) {
    const day = log.created_at ? log.created_at.slice(0, 10) : 'unknown';
    if (!groups[day]) groups[day] = [];
    groups[day].push(log);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const d = new Date(date + 'T12:00:00');
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      const label = diff === 0 ? "Aujourd'hui" :
                    diff === 1 ? 'Hier' :
                    diff < 7  ? `Il y a ${diff} jours` :
                    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      return { date, label, items };
    });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [showMore, setShowMore] = useState(false);
  const PAGE_SIZE = 30;
  const EXTENDED_SIZE = 80;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [logsData, summaryData] = await Promise.all([
        getActivityLogs({ limit: showMore ? EXTENDED_SIZE : PAGE_SIZE, type: filter || undefined }),
        getActivitySummary(7),
      ]);
      setLogs(logsData.items);
      setSummary(summaryData);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, showMore]);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByDay(logs);

  const summaryCards = [
    { key: 'absences',  label: 'Absences',      emoji: '🙅', color: 'text-destructive',  bg: 'bg-destructive/10' },
    { key: 'dispos',    label: 'Dispos mises à jour', emoji: '📅', color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { key: 'members',   label: 'Nouveaux membres', emoji: '👤', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { key: 'songs',     label: 'Nouveaux chants', emoji: '🎵',   color: 'text-purple-600', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">📋 Journal d'activité</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Historique des 60 derniers jours</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* ── Summary cards (7 days) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {summaryCards.map(c => (
          <div key={c.key} className="bg-card border border-border rounded-xl p-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm mb-2 ${c.bg}`}>
              {c.emoji}
            </div>
            <p className={`text-xl font-bold ${c.color} leading-none`}>
              {loading ? '—' : (summary[c.key] ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{c.label}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">7 derniers jours</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted/60 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm font-medium text-foreground">Aucune activité récente</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter ? 'Essayez un autre filtre' : 'Aucune action enregistrée dans les 60 derniers jours'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <AnimatePresence>
            {grouped.map(group => (
              <motion.div key={group.date} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                {/* Day label */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Items */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {group.items.map((log, i) => {
                    const cfg = TYPE_CONFIG[log.type] || { emoji: '📝', label: log.type, color: 'text-muted-foreground', bg: 'bg-muted' };
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-3 px-4 py-3 ${i < group.items.length - 1 ? 'border-b border-border' : ''}`}
                      >
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                          {cfg.emoji}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug">
                            {log.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {log.detail && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {log.detail}
                              </span>
                            )}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>

                        {/* Time */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[10px] text-muted-foreground" title={formatDateFull(log.created_at)}>
                            {formatTimeAgo(log.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Load more */}
          {!showMore && logs.length >= PAGE_SIZE && (
            <button
              onClick={() => setShowMore(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Voir plus d'activité
            </button>
          )}
        </div>
      )}
    </div>
  );
}
