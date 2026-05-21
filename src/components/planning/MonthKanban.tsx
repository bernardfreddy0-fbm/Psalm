import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { assignSunday, getAbsentMemberIds, type Sunday, type AbsenceWithMember } from '@/lib/api';
import {
  type EditState,
  type MemberOption,
  KANBAN_ROWS,
  ROW_CHIP_COLOR,
  buildEditState,
  getInitials,
  isPast,
} from './planningTypes';
import { shareOnWhatsApp } from './whatsapp';
import { Lock, Unlock, X, Loader2, Check, Plus, Share2, CheckCircle2, PlaySquare, Pencil } from 'lucide-react';
import { findVideoForSunday, type YoutubeVideo } from '@/lib/youtube';
import { YoutubeVideoModal } from '@/components/YoutubeVideoModal';

// ── Groupes visuels ───────────────────────────────────────────────────────────

const GROUPS = [
  {
    key:       'chant',
    label:     'Chant',
    emoji:     '🎙️',
    rows:      ['dirigeant', 'choriste'],
    banner:    'bg-emerald-600 dark:bg-emerald-700',
    rowBg:     'bg-emerald-50/70 dark:bg-emerald-600/20',
    sectionBg: 'bg-emerald-50/40 dark:bg-emerald-600/10',
  },
  {
    key:       'musiciens',
    label:     'Musiciens',
    emoji:     '🎵',
    rows:      ['piano', 'batterie', 'guitare_elec', 'guitare_acou', 'basse'],
    banner:    'bg-orange-500 dark:bg-orange-600',
    rowBg:     'bg-orange-50/70 dark:bg-orange-500/20',
    sectionBg: 'bg-orange-50/40 dark:bg-orange-500/10',
  },
  {
    key:       'technique',
    label:     'Technique',
    emoji:     '🔊',
    rows:      ['sonorisation', 'projection', 'video'],
    banner:    'bg-violet-600 dark:bg-violet-700',
    rowBg:     'bg-violet-50/70 dark:bg-violet-600/20',
    sectionBg: 'bg-violet-50/40 dark:bg-violet-600/10',
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getConfirmationStats(s: Sunday): { confirmed: number; total: number } {
  const asgmt = s.assignments ?? {};
  let confirmed = 0, total = 0;
  if (s.dirigeant_id) total++;
  for (const people of Object.values(asgmt)) {
    for (const p of (people as any[])) {
      total++;
      if (p.confirmed === '1' || p.confirmed === true) confirmed++;
    }
  }
  return { confirmed, total };
}

function getCategoryDots(edit: EditState): boolean[] {
  return [
    !!edit.dirigeant_id,
    (edit.poles.choriste ?? []).length > 0,
    ['piano', 'batterie', 'guitare_elec', 'guitare_acou', 'basse'].some(k => (edit.poles[k] ?? []).length > 0),
    ['sonorisation', 'projection', 'video'].some(k => (edit.poles[k] ?? []).length > 0),
  ];
}

function CategoryDots({ dots }: { dots: boolean[] }) {
  return (
    <div className="flex gap-0.5">
      {dots.map((filled, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

// ── Chip partagé ──────────────────────────────────────────────────────────────

function MemberChip({
  name, absent, rowKey, locked, onRemove,
}: {
  name: string; absent: boolean; rowKey: string; locked: boolean; onRemove: () => void;
}) {
  return (
    <span
      title={absent ? `${name} — absent ce dimanche` : name}
      className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold max-w-[120px] leading-tight ${
        absent
          ? 'bg-amber-500 text-white dark:bg-amber-600/80'
          : (ROW_CHIP_COLOR[rowKey] ?? 'bg-primary text-primary-foreground')
      }`}
    >
      {absent && <span className="text-[8px] shrink-0">⚠</span>}
      <span className="truncate">{name.split(' ')[0]}</span>
      {!locked && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="hover:opacity-60 shrink-0 ml-0.5 touch-manipulation"
        >
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ── Bottom sheet mobile ────────────────────────────────────────────────────────
// Composant isolé pour éviter les problèmes de closure dans le composant parent.

interface SheetProps {
  roleLabel: string;
  roleEmoji: string;
  dateLabel: string;
  available: MemberOption[];
  absent: MemberOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function MobileBottomSheet({ roleLabel, roleEmoji, dateLabel, available, absent, onSelect, onClose }: SheetProps) {
  const [search, setSearch] = useState('');
  const [dragY, setDragY]   = useState(0);
  const dragStart            = useRef(0);
  const isDragging           = useRef(false);
  const listRef              = useRef<HTMLDivElement>(null);

  const sq = search.toLowerCase();
  const filteredAvail  = available.filter(m => !sq || `${m.first_name} ${m.last_name}`.toLowerCase().includes(sq));
  const filteredAbsent = absent.filter(m => !sq || `${m.first_name} ${m.last_name}`.toLowerCase().includes(sq));

  // Poignée : glisser vers le bas pour fermer
  function onHandleTouchStart(e: React.TouchEvent) {
    dragStart.current = e.touches[0].clientY;
    isDragging.current = true;
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStart.current;
    if (delta > 0) setDragY(delta);
  }
  function onHandleTouchEnd() {
    isDragging.current = false;
    if (dragY > 90) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.52)' }}
        onClick={onClose}
      />

      {/* Sheet — animation CSS via classe, PAS via état React */}
      <div
        className="mobile-sheet fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-2xl"
        style={{
          /*
           * CRITIQUE : utiliser "height" et non "max-height".
           * Avec max-height, le parent flex n'a pas de hauteur définie → les
           * enfants flex:1 obtiennent 0px → la liste ne peut pas défiler.
           * Avec height, le parent a une hauteur définie → flex:1 fonctionne.
           * dvh = "dynamic viewport height" : ne se redimensionne pas quand
           * le clavier iOS apparaît, contrairement à vh.
           */
          height: 'min(82dvh, 82vh)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 0.2s ease-out' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* ── Poignée (zone de drag) ── */}
        <div
          className="flex justify-center pt-3 pb-1 shrink-0 select-none"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between px-5 pb-3 shrink-0">
          <div>
            <p className="text-base font-bold text-foreground leading-snug">
              {roleEmoji} {roleLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 touch-manipulation"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* ── Recherche ── */}
        <div className="px-4 pb-3 shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            inputMode="search"
            autoComplete="off"
            className="w-full rounded-xl border border-input bg-muted px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* ── Séparateur ── */}
        <div className="h-px bg-border shrink-0" />

        {/* ── Liste — zone scrollable ──────────────────────────────────────
            CRITIQUE pour iOS :
            • flex: '1 1 0px'  →  flex-grow + flex-shrink + flex-basis=0
            • minHeight: 0      →  sans ça, le flex child ne peut pas défiler
            • overflow: 'auto'  →  scroll natif
            • WebkitOverflowScrolling: 'touch'  →  momentum scroll iOS
            ─────────────────────────────────────────────────────────────── */}
        <div
          ref={listRef}
          style={{
            flex: '1 1 0px',
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {filteredAvail.length === 0 && filteredAbsent.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <span className="text-3xl opacity-50">😶</span>
              <p className="text-sm text-muted-foreground">Aucun membre disponible</p>
            </div>
          )}

          {/* Disponibles */}
          {filteredAvail.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-muted/50 transition-colors touch-manipulation border-b border-border/40 last:border-b-0"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                {getInitials(`${m.first_name} ${m.last_name}`)}
              </div>
              <div className="flex-1 min-w-0">
                {/* Noms complets — pas de truncate */}
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {m.first_name} {m.last_name}
                </p>
                {m.role && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {m.role.split(',')[0].trim().replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            </button>
          ))}

          {/* Absents */}
          {filteredAbsent.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-y border-amber-100 dark:border-amber-900/30 sticky top-0 z-10">
                <span>⚠️</span>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Absents ce dimanche
                </span>
              </div>
              {filteredAbsent.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4 border-b border-border/40 last:border-b-0 opacity-40"
                >
                  <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-600 text-sm shrink-0">
                    {getInitials(`${m.first_name} ${m.last_name}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {m.first_name} {m.last_name}
                    </p>
                    {m.role && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {m.role.split(',')[0].trim().replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Espace bas pour ne pas que le dernier item colle au bord */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function MonthKanban({
  sundays, members, absences, videos, onLock, lockingId, onRefresh, onEdit,
}: {
  sundays: Sunday[];
  members: MemberOption[];
  absences: AbsenceWithMember[];
  videos?: YoutubeVideo[];
  onLock: (s: Sunday) => void;
  lockingId: string | null;
  onRefresh: () => void;
  onEdit?: (edit: EditState) => void;
}) {
  const [edits, setEdits]           = useState<Record<string, EditState>>({});
  const [dirty, setDirty]           = useState<Set<string>>(new Set());
  const [saving, setSaving]         = useState<Set<string>>(new Set());
  const [videoModal, setVideoModal] = useState<{ videoId: string; title: string } | null>(null);
  const [activePopover, setActivePopover] = useState<{ sundayId: string; role: string } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [isMobile, setIsMobile]     = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const desktopPopoverRef           = useRef<HTMLDivElement>(null);

  // Détecter mobile/desktop
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Sync edits
  useEffect(() => {
    setEdits(prev => {
      const next = { ...prev };
      sundays.forEach(s => { if (!dirty.has(s.id)) next[s.id] = buildEditState(s); });
      return next;
    });
  }, [sundays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fermer le popover desktop au clic extérieur / scroll
  useEffect(() => {
    if (!activePopover || isMobile) return;
    const close = () => { setActivePopover(null); setPopoverPos(null); setPickerSearch(''); };
    const onMouseDown = (e: MouseEvent) => {
      if (desktopPopoverRef.current && !desktopPopoverRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [activePopover, isMobile]);

  const getEdit = (id: string) => edits[id] ?? null;

  function getAssigned(edit: EditState, rowKey: string): string[] {
    if (rowKey === 'dirigeant') return edit.dirigeant_id ? [edit.dirigeant_id] : [];
    return edit.poles[rowKey] ?? [];
  }

  function getPool(roles: string[]): MemberOption[] {
    if (roles.length === 0) return members;
    return members.filter(m => m.role.split(',').map(r => r.trim()).some(r => roles.includes(r)));
  }

  function getMemberName(id: string): string {
    const m = members.find(m => m.id === id);
    return m ? `${m.first_name} ${m.last_name}` : String(id);
  }

  function updateEdit(sundayId: string, updater: (prev: EditState) => EditState) {
    setEdits(prev => ({ ...prev, [sundayId]: updater(prev[sundayId]) }));
    setDirty(prev => new Set([...prev, sundayId]));
  }

  function openPopover(e: React.MouseEvent<HTMLButtonElement>, sundayId: string, role: string) {
    if (activePopover?.sundayId === sundayId && activePopover?.role === role) {
      setActivePopover(null); setPopoverPos(null); setPickerSearch('');
      return;
    }
    if (!isMobile) {
      const rect = e.currentTarget.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 240 - 12);
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(left, 12) });
    } else {
      setPopoverPos(null);
    }
    setActivePopover({ sundayId, role });
    setPickerSearch('');
  }

  function closePopover() {
    setActivePopover(null);
    setPopoverPos(null);
    setPickerSearch('');
  }

  function assignMember(memberId: string) {
    if (!activePopover) return;
    const { sundayId, role } = activePopover;
    if (role === 'dirigeant') {
      updateEdit(sundayId, s => ({ ...s, dirigeant_id: memberId }));
    } else {
      updateEdit(sundayId, s => {
        const cur = s.poles[role] ?? [];
        if (cur.includes(memberId)) return s;
        const alreadyInOtherPole = Object.entries(s.poles).some(([p, ids]) => p !== role && ids.includes(memberId));
        if (alreadyInOtherPole) return s;
        return { ...s, poles: { ...s.poles, [role]: [...cur, memberId] } };
      });
    }
    closePopover();
  }

  function removeMember(sundayId: string, role: string, memberId: string) {
    if (role === 'dirigeant') {
      updateEdit(sundayId, s => ({ ...s, dirigeant_id: '' }));
    } else {
      updateEdit(sundayId, s => ({
        ...s,
        poles: { ...s.poles, [role]: (s.poles[role] ?? []).filter(id => id !== memberId) },
      }));
    }
  }

  async function saveSunday(sundayId: string) {
    const edit = edits[sundayId];
    if (!edit) return;
    setSaving(prev => new Set([...prev, sundayId]));
    try {
      await assignSunday(sundayId, { dirigeant_id: edit.dirigeant_id || null, note: edit.note || null, poles: edit.poles });
      setDirty(prev => { const n = new Set(prev); n.delete(sundayId); return n; });
      onRefresh();
    } catch (ex) {
      toast.error('Erreur', { description: (ex as Error).message });
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(sundayId); return n; });
    }
  }

  // ── Données pour le picker ──────────────────────────────────────────────────

  const popoverSunday   = activePopover ? (sundays.find(s => s.id === activePopover.sundayId) ?? null) : null;
  const popoverRow      = activePopover ? (KANBAN_ROWS.find(r => r.key === activePopover.role) ?? null) : null;
  const popoverEdit     = activePopover ? getEdit(activePopover.sundayId) : null;
  const popoverAbsent   = popoverSunday ? getAbsentMemberIds(absences, popoverSunday.date) : new Set<string>();
  const popoverAssigned = popoverEdit && activePopover ? getAssigned(popoverEdit, activePopover.role) : [];
  const popoverPool     = popoverRow ? getPool(popoverRow.roles) : [];
  const notAssigned     = popoverPool.filter(m => !popoverAssigned.includes(m.id));
  const sq              = pickerSearch.toLowerCase();
  const filteredAvail   = notAssigned.filter(m => !popoverAbsent.has(m.id)).filter(m => !sq || `${m.first_name} ${m.last_name}`.toLowerCase().includes(sq));
  const filteredAbsent  = notAssigned.filter(m => popoverAbsent.has(m.id)).filter(m => !sq || `${m.first_name} ${m.last_name}`.toLowerCase().includes(sq));

  // ── Cellule chips (desktop + mobile) ───────────────────────────────────────

  function ChipsCell({ s, row, locked }: { s: Sunday; row: typeof KANBAN_ROWS[number]; locked: boolean }) {
    const edit = getEdit(s.id);
    if (!edit) return null;
    const absentIds = getAbsentMemberIds(absences, s.date);
    const assigned  = getAssigned(edit, row.key);
    const canAdd    = !locked && (row.key !== 'dirigeant' || assigned.length === 0);
    const isOpen    = activePopover?.sundayId === s.id && activePopover?.role === row.key;
    return (
      <div className="flex flex-wrap gap-1 min-h-[22px]">
        {assigned.map(id => (
          <MemberChip
            key={id}
            name={getMemberName(id)}
            absent={absentIds.has(id)}
            rowKey={row.key}
            locked={locked}
            onRemove={() => removeMember(s.id, row.key, id)}
          />
        ))}
        {canAdd && (
          <button
            onClick={e => openPopover(e, s.id, row.key)}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-all shrink-0 touch-manipulation ${
              isOpen
                ? 'bg-primary text-primary-foreground scale-110'
                : 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground active:scale-95'
            }`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    );
  }

  // ── En-tête de colonne ──────────────────────────────────────────────────────

  function SundayHeader({ s, compact = false }: { s: Sunday; compact?: boolean }) {
    const locked = !!s.is_locked;
    const past   = isPast(s.date);
    const isDirty   = dirty.has(s.id);
    const isSaving  = saving.has(s.id);
    const isLocking = lockingId === s.id;
    const edit      = getEdit(s.id);
    const dots      = edit ? getCategoryDots(edit) : [false, false, false, false];
    const { confirmed, total } = getConfirmationStats(s);

    return (
      <div className={`flex flex-col gap-1 ${past ? 'opacity-70' : ''}`}>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {locked && <Lock size={9} className="text-amber-500 shrink-0" />}
            <span className={`font-bold text-foreground ${compact ? 'text-[11px]' : 'text-sm'}`}>
              {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
            {!!s.is_jeunesse && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-medium leading-none">
                Jss
              </span>
            )}
          </div>
          <button
            onClick={() => onLock(s)}
            disabled={isLocking}
            className={`p-1 rounded touch-manipulation ${locked ? 'text-amber-500' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {isLocking ? <Loader2 size={9} className="animate-spin" /> : locked ? <Lock size={9} /> : <Unlock size={9} />}
          </button>
        </div>
        {!isDirty && <CategoryDots dots={dots} />}
        {isDirty && (
          <button
            onClick={() => saveSunday(s.id)}
            disabled={isSaving}
            className="flex items-center justify-center gap-1 w-full px-1 py-0.5 text-[10px] font-semibold rounded bg-primary text-primary-foreground disabled:opacity-60 touch-manipulation"
          >
            {isSaving ? <Loader2 size={8} className="animate-spin" /> : <Check size={8} />}
            Sauvegarder
          </button>
        )}
        {!isDirty && total > 0 && (
          <div className={`flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${
            confirmed === total ? 'bg-emerald-100 text-emerald-700' : confirmed === 0 ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-700'
          }`}>
            <CheckCircle2 size={8} /> {confirmed}/{total}
          </div>
        )}
        {!isDirty && onEdit && (
          <button
            onClick={() => onEdit(edit ?? buildEditState(s))}
            className="flex items-center justify-center gap-1 w-full px-1 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary touch-manipulation"
          >
            <Pencil size={8} /> Éditer
          </button>
        )}
        {!isDirty && s.dir_first && (
          <button
            onClick={() => shareOnWhatsApp(s)}
            className="flex items-center justify-center gap-1 w-full px-1 py-0.5 text-[10px] font-semibold rounded bg-[#25D366]/10 text-[#25D366] touch-manipulation"
          >
            <Share2 size={8} /> WhatsApp
          </button>
        )}
        {(() => {
          const video = videos?.length ? findVideoForSunday(s.date, videos) : null;
          if (!video || isDirty) return null;
          return (
            <button
              onClick={() => setVideoModal({ videoId: video.videoId, title: video.title })}
              className="flex items-center justify-center gap-1 w-full px-1 py-0.5 text-[10px] font-semibold rounded bg-red-600/10 text-red-600 dark:text-red-400 touch-manipulation"
            >
              <PlaySquare size={8} /> Vidéo
            </button>
          );
        })()}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DESKTOP TABLE (md+)
  // ════════════════════════════════════════════════════════════════════════════

  const DesktopTable = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto scrollbar-none">
        <table className="border-collapse text-xs" style={{ minWidth: `${160 + sundays.length * 200}px` }}>
          <thead>
            <tr className="border-b-2 border-border bg-muted/20">
              <th className="sticky left-0 z-20 bg-card bg-muted/30 w-40 min-w-[160px] px-3 py-3 text-left border-r border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Rôle</span>
              </th>
              {sundays.map(s => (
                <th key={s.id} className={`min-w-[200px] px-2 py-2 text-left border-r border-border last:border-r-0 align-top font-normal ${isPast(s.date) ? 'opacity-70' : ''} ${s.is_locked ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}>
                  <SundayHeader s={s} compact />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(group => (
              <>
                <tr key={`grp-${group.key}`}>
                  <td colSpan={sundays.length + 1} className={`${group.banner} py-1.5 px-3 border-b border-border/20`}>
                    <span className="text-white text-[10px] font-bold uppercase tracking-widest">{group.emoji} {group.label}</span>
                  </td>
                </tr>
                {KANBAN_ROWS.filter(r => (group.rows as readonly string[]).includes(r.key)).map(row => (
                  <tr key={row.key} className="border-b border-border last:border-b-0">
                    <td className={`sticky left-0 z-10 border-r border-border px-3 py-2.5 min-w-[160px] align-middle bg-card ${group.rowBg}`}>
                      <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">{row.emoji} {row.label}</span>
                    </td>
                    {sundays.map(s => (
                      <td key={s.id} className={`border-r border-border last:border-r-0 px-2 py-2 align-top ${s.is_locked ? 'bg-amber-50/20 dark:bg-amber-950/5' : 'hover:bg-muted/5'}`}>
                        <ChipsCell s={s} row={row} locked={!!s.is_locked} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE CARDS (< md)
  // ════════════════════════════════════════════════════════════════════════════

  const MobileCards = () => (
    <div className="flex flex-col gap-4">
      {sundays.map(s => {
        const locked  = !!s.is_locked;
        const isDirty = dirty.has(s.id);
        const past    = isPast(s.date);

        return (
          <div key={s.id} className={`bg-card rounded-xl border border-border overflow-hidden shadow-sm ${past ? 'opacity-80' : ''}`}>

            {/* En-tête carte */}
            <div className={`px-4 py-3 border-b border-border flex items-start justify-between gap-2 ${locked ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-muted/20'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground capitalize">
                    {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  {!!s.is_jeunesse && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">Jeunesse</span>
                  )}
                  {locked && <Lock size={11} className="text-amber-500" />}
                </div>
                {(() => {
                  const edit = getEdit(s.id);
                  const dots = edit ? getCategoryDots(edit) : [false, false, false, false];
                  return <div className="mt-1.5"><CategoryDots dots={dots} /></div>;
                })()}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isDirty ? (
                  <button
                    onClick={() => saveSunday(s.id)}
                    disabled={saving.has(s.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground disabled:opacity-60 touch-manipulation"
                  >
                    {saving.has(s.id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Sauvegarder
                  </button>
                ) : (
                  <>
                    {onEdit && (
                      <button
                        onClick={() => { const e = getEdit(s.id); onEdit(e ?? buildEditState(s)); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary/10 text-primary touch-manipulation"
                      >
                        <Pencil size={12} /> Éditer
                      </button>
                    )}
                    {s.dir_first && (
                      <button
                        onClick={() => shareOnWhatsApp(s)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#25D366]/10 text-[#25D366] touch-manipulation"
                      >
                        <Share2 size={12} /> WhatsApp
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => onLock(s)}
                  disabled={lockingId === s.id}
                  className={`p-2.5 rounded-lg touch-manipulation ${locked ? 'text-amber-500 bg-amber-100/60' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {lockingId === s.id ? <Loader2 size={14} className="animate-spin" /> : locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>
            </div>

            {/* Sections groupées */}
            {GROUPS.map(group => {
              const groupRows = KANBAN_ROWS.filter(r => (group.rows as readonly string[]).includes(r.key));
              return (
                <div key={group.key} className="border-b border-border last:border-b-0">
                  <div className={`${group.banner} px-4 py-2`}>
                    <span className="text-white text-[11px] font-bold uppercase tracking-widest">{group.emoji} {group.label}</span>
                  </div>
                  {groupRows.map((row, i) => (
                    <div
                      key={row.key}
                      className={`flex items-start gap-3 px-4 py-3 ${i < groupRows.length - 1 ? 'border-b border-border/50' : ''} ${group.sectionBg}`}
                    >
                      <span className="text-[11px] font-semibold text-foreground whitespace-nowrap w-28 shrink-0 pt-1">
                        {row.emoji} {row.label}
                      </span>
                      <div className="flex-1">
                        <ChipsCell s={s} row={row} locked={locked} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Pied : badge confirmations */}
            {(() => {
              const { confirmed, total } = getConfirmationStats(s);
              if (total === 0) return null;
              return (
                <div className="px-4 py-2.5 bg-muted/10 border-t border-border">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
                    confirmed === total ? 'bg-emerald-100 text-emerald-700' : confirmed === 0 ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <CheckCircle2 size={12} /> {confirmed}/{total} confirmés
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <>
      <div className="hidden md:block"><DesktopTable /></div>
      <div className="md:hidden"><MobileCards /></div>

      {/* ── DESKTOP : Popover flottant ── */}
      {activePopover && !isMobile && popoverPos && (
        <div
          ref={desktopPopoverRef}
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
          className="w-56 bg-popover border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/40">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wide">
              {popoverRow?.emoji} {popoverRow?.label}
            </span>
            <button onClick={closePopover} className="text-muted-foreground hover:text-foreground p-0.5"><X size={11} /></button>
          </div>
          <div className="p-1.5 border-b border-border">
            <input
              autoFocus
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-background border border-input rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredAvail.length === 0 && filteredAbsent.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun membre disponible</p>
            )}
            {filteredAvail.map(m => (
              <button key={m.id} onClick={() => assignMember(m.id)} className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                  {getInitials(`${m.first_name} ${m.last_name}`)}
                </div>
                <span className="text-xs text-foreground truncate">{m.first_name} {m.last_name}</span>
              </button>
            ))}
            {filteredAbsent.length > 0 && (
              <>
                <div className="px-2.5 py-1 text-[9px] font-semibold text-amber-600 uppercase tracking-wide border-t border-border bg-amber-50/50">⚠ Absents</div>
                {filteredAbsent.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 opacity-40">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-600 shrink-0">
                      {getInitials(`${m.first_name} ${m.last_name}`)}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{m.first_name} {m.last_name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE : Bottom sheet — composant isolé ── */}
      {activePopover && isMobile && popoverRow && popoverSunday && (
        <MobileBottomSheet
          key={`${activePopover.sundayId}-${activePopover.role}`}
          roleLabel={popoverRow.label}
          roleEmoji={popoverRow.emoji}
          dateLabel={new Date(popoverSunday.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          available={filteredAvail}
          absent={filteredAbsent}
          onSelect={assignMember}
          onClose={closePopover}
        />
      )}

      {/* ── Modal vidéo YouTube ── */}
      {videoModal && (
        <YoutubeVideoModal
          videoId={videoModal.videoId}
          title={videoModal.title}
          onClose={() => setVideoModal(null)}
        />
      )}
    </>
  );
}
