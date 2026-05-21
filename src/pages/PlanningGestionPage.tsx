import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { exportPlanningPDF } from '@/lib/exportPlanningPDF';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFullPlanning,
  getMembersForPlanning,
  assignSunday,
  getAllAbsences,
  type Sunday,
  type Member,
  type AbsenceWithMember,
} from '@/lib/api';
import { fetchYoutubeVideos, type YoutubeVideo } from '@/lib/youtube';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar, CalendarDays, BarChart3, Settings,
  Search, Loader2, ShieldAlert, FileSpreadsheet, RefreshCw,
} from 'lucide-react';
import {
  type MemberOption,
  type EditState,
  type PoleKey,
  MONTHS,
  lockSunday,
} from '@/components/planning/planningTypes';
import { generateMonthAssignments } from '@/components/planning/autoGenerate';
import { EditModal } from '@/components/planning/EditModal';
import { YearView } from '@/components/planning/YearView';
import { StatsView } from '@/components/planning/StatsView';
import { ConfigView } from '@/components/planning/ConfigView';
import { GeneratePreviewModal } from '@/components/planning/GeneratePreviewModal';
import { MonthKanban } from '@/components/planning/MonthKanban';

// Re-export saveYouthDirectors for any external consumers
export { saveYouthDirectors } from '@/components/planning/planningStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewTab = 'month' | 'year' | 'stats' | 'config';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanningGestionPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();

  const now = new Date();
  const [selectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [viewTab, setViewTab] = useState<ViewTab>('month');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<EditState | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewVariants, setPreviewVariants] = useState<ReturnType<typeof generateMonthAssignments>[] | null>(null);
  const [activeVariant, setActiveVariant] = useState(0);
  const [skipExisting, setSkipExisting] = useState(false);

  const isAdmin = hasPermission('planning_edit');

  const { data: allSundays = [], isLoading } = useQuery({
    queryKey: ['full-planning', selectedYear],
    queryFn: getFullPlanning,
    staleTime: 60000,
    enabled: isAdmin,
  });

  const { data: rawMembers = [] } = useQuery({
    queryKey: ['members-planning'],
    queryFn: getMembersForPlanning,
    staleTime: 300000,
    enabled: isAdmin,
  });

  // Le backend filtre déjà is_active=1 et member_visible=1
  // Dédupliquer par id pour robustesse
  const members: MemberOption[] = [...new Map(
    (rawMembers as Member[]).map(m => [String(m.id), m])
  ).values()]
    .map(m => ({ id: String(m.id), first_name: m.first_name, last_name: m.last_name, role: m.role || '' }));

  // Toutes les absences (pour filtrage dans EditModal)
  const { data: allAbsences = [] } = useQuery<AbsenceWithMember[]>({
    queryKey: ['all-absences'],
    queryFn: getAllAbsences,
    staleTime: 60000,
    enabled: isAdmin,
  });

  const { data: ytVideos = [] } = useQuery<YoutubeVideo[]>({
    queryKey: ['youtube-videos'],
    queryFn: fetchYoutubeVideos,
    staleTime: 30 * 60 * 1000,
    enabled: isAdmin,
  });

  // Year-wide stats
  const yearStats = useMemo(() => {
    const s = allSundays as Sunday[];
    const jeunesseCount = s.filter(x => x.is_jeunesse).length;
    const dirigeants = new Set(s.filter(x => x.dirigeant_id).map(x => x.dirigeant_id));
    const choristes = new Set(s.flatMap(x => (x.assignments?.choriste ?? []).map(p => p.user_id)));
    const musiciens = new Set(s.flatMap(x =>
      (['piano','batterie','guitare_elec','guitare_acou','basse'] as PoleKey[]).flatMap(k =>
        (x.assignments?.[k] ?? []).map(p => p.user_id)
      )
    ));
    return [
      { v: s.length,          l: 'Dimanches',  color: 'text-accent' },
      { v: jeunesseCount,     l: 'Jeunesse',   color: 'text-yellow-500' },
      { v: dirigeants.size,   l: 'Dirigeants', color: 'text-green-500' },
      { v: choristes.size,    l: 'Choristes',  color: 'text-blue-500' },
      { v: musiciens.size,    l: 'Musiciens',  color: 'text-orange-500' },
      { v: 0,                 l: 'Modifiés',   color: 'text-muted-foreground' },
    ];
  }, [allSundays]);

  // Filtered month sundays
  const monthSundays = useMemo(() => {
    return (allSundays as Sunday[]).filter(s => {
      const d = new Date(s.date);
      if (d.getMonth() !== selectedMonth) return false;
      if (search) {
        const q = search.toLowerCase();
        const dir = `${s.dir_first ?? ''} ${s.dir_last ?? ''}`.toLowerCase();
        if (!dir.includes(q) && !(s.label ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allSundays, selectedMonth, search]);

  const VIEW_TABS: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
    { key: 'month', label: 'Par mois',      icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { key: 'year',  label: 'Vue annuelle',  icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: 'stats', label: 'Statistiques',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: 'config',label: 'Configuration', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['full-planning'] });
    setEditTarget(null);
  };

  const handleExport = useCallback(() => {
    const scope = (viewTab === 'month' ? monthSundays : allSundays) as Sunday[];
    if (scope.length === 0) return;
    exportPlanningPDF(scope, selectedMonth, selectedYear);
  }, [allSundays, monthSundays, viewTab, selectedMonth, selectedYear]);

  const handleGenerate = () => {
    if (monthSundays.length === 0) return;
    let sundaysToProcess = monthSundays as Sunday[];
    if (skipExisting) {
      sundaysToProcess = sundaysToProcess.filter(s => !s.dirigeant_id);
    }
    if (sundaysToProcess.length === 0) {
      toast.info('Génération impossible', { description: 'Tous les dimanches de ce mois ont déjà un dirigeant assigné.' });
      return;
    }
    // Générer 3 variantes indépendantes avec randomize
    // allAbsences est injecté pour exclure les membres absents de chaque dimanche
    const variants = [
      generateMonthAssignments(sundaysToProcess, members, allAbsences, true),
      generateMonthAssignments(sundaysToProcess, members, allAbsences, true),
      generateMonthAssignments(sundaysToProcess, members, allAbsences, true),
    ];
    setActiveVariant(0);
    setPreviewVariants(variants);
  };

  const handleConfirmGenerate = async () => {
    if (!previewVariants) return;
    const selected = previewVariants[activeVariant];
    setGenerating(true);
    try {
      for (const a of selected) {
        await assignSunday(a.sundayId, { dirigeant_id: a.dirigeant_id || null, poles: a.poles });
      }
      qc.invalidateQueries({ queryKey: ['full-planning'] });
      setPreviewVariants(null);
    } catch (e) {
      toast.error('Erreur', { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async (s: Sunday) => {
    setLockingId(s.id);
    try {
      await lockSunday(s.id, !s.is_locked);
      qc.invalidateQueries({ queryKey: ['full-planning'] });
    } catch (e) {
      toast.error('Erreur', { description: (e as Error).message });
    } finally {
      setLockingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <ShieldAlert size={40} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Accès réservé</p>
        <p className="text-sm text-muted-foreground">Cette page est accessible aux responsables louange uniquement.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header — empile sur mobile */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground flex items-center gap-2">
            📋 Planning Louange {selectedYear}
          </h1>
          <p className="text-xs text-muted-foreground">
            {(allSundays as Sunday[]).length} dimanches planifiés
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {viewTab === 'month' && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="hidden sm:inline">Conserver assignations existantes</span>
                <span className="sm:hidden">Conserver existantes</span>
              </label>
              <button
                onClick={handleGenerate}
                disabled={generating || monthSundays.length === 0 || members.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-medium active:bg-primary/20 transition-colors disabled:opacity-40 touch-manipulation"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Régénérer
              </button>
            </>
          )}
          <button
            onClick={handleExport}
            disabled={(viewTab === 'month' ? monthSundays : allSundays).length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium active:bg-muted transition-colors disabled:opacity-40 touch-manipulation"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-card rounded-xl border border-border p-3 mb-4 grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {yearStats.map(s => (
          <div key={s.l} className="text-center py-1">
            <p className={`text-xl font-bold ${s.color}`}>{isLoading ? '—' : s.v}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.l}</p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {VIEW_TABS.map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors touch-manipulation ${
              viewTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* === MONTH VIEW === */}
      {viewTab === 'month' && (
        <>
          {/* Month tabs — scrollable horizontalement */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {MONTHS.map((m, i) => {
              const count = (allSundays as Sunday[]).filter(s => new Date(s.date).getMonth() === i).length;
              return (
                <button key={m} onClick={() => setSelectedMonth(i)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors touch-manipulation ${
                    selectedMonth === i ? 'bg-foreground text-card' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {m} {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search bar — pleine largeur sur mobile */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par dirigeant…"
                className="pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm w-full sm:w-52"
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {monthSundays.length} dim.
            </span>
          </div>

          {/* Kanban Board */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : monthSundays.length === 0 ? (
            <div className="bg-card rounded-lg border border-border px-6 py-12 text-center">
              <Calendar size={32} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">
                {search
                  ? 'Aucun résultat pour cette recherche'
                  : `Aucun dimanche planifié pour ${MONTHS[selectedMonth]} ${selectedYear}`}
              </p>
            </div>
          ) : (
            <MonthKanban
              sundays={monthSundays}
              members={members}
              absences={allAbsences}
              videos={ytVideos}
              onLock={handleLock}
              lockingId={lockingId}
              onRefresh={() => qc.invalidateQueries({ queryKey: ['full-planning'] })}
            />
          )}
        </>
      )}

      {/* === YEAR VIEW === */}
      {viewTab === 'year' && (
        isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : (
          <YearView sundays={allSundays as Sunday[]} />
        )
      )}

      {/* === STATS VIEW === */}
      {viewTab === 'stats' && (
        isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : (
          <StatsView sundays={allSundays as Sunday[]} />
        )
      )}

      {/* === CONFIG VIEW === */}
      {viewTab === 'config' && <ConfigView members={members} />}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          edit={editTarget}
          members={members}
          absences={allAbsences}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Generate preview modal */}
      {previewVariants && (
        <GeneratePreviewModal
          variants={previewVariants}
          activeVariant={activeVariant}
          onSelectVariant={setActiveVariant}
          sundays={allSundays as Sunday[]}
          members={members}
          onConfirm={handleConfirmGenerate}
          onClose={() => setPreviewVariants(null)}
          generating={generating}
        />
      )}
    </div>
  );
}
