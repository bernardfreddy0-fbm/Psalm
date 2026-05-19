import { useEffect, useState, useMemo } from 'react';
import { getPlanning, getSpecialEvents, createSpecialEvent, deleteSpecialEvent, loadPrograms, type SpecialEvent } from '@/lib/api';
import { CalendarRange, ChevronLeft, ChevronRight, Plus, X, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const EVENT_TYPES = [
  { key: 'culte', label: 'Culte', color: 'bg-accent', dot: 'bg-accent' },
  { key: 'jeunesse', label: 'Jeunesse', color: 'bg-yellow-500', dot: 'bg-yellow-500' },
  { key: 'special', label: 'Événement spécial', color: 'bg-purple-500', dot: 'bg-purple-500' },
  { key: 'repetition', label: 'Répétition', color: 'bg-green-500', dot: 'bg-green-500' },
  { key: 'conference', label: 'Conférence', color: 'bg-pink-500', dot: 'bg-pink-500' },
  { key: 'camp', label: 'Camp / Retraite', color: 'bg-orange-500', dot: 'bg-orange-500' },
  { key: 'formation', label: 'Formation', color: 'bg-teal-500', dot: 'bg-teal-500' },
  { key: 'autre', label: 'Autre', color: 'bg-slate-400', dot: 'bg-slate-400' },
  { key: 'programme', label: 'Programme du culte', color: 'bg-indigo-500', dot: 'bg-indigo-500' },
];

const SPECIAL_EVENT_TYPES = ['special', 'conference', 'camp', 'formation', 'autre'] as const;

/** Returns Sunday dates (YYYY-MM-DD) that fall within the range */
function getSundaysInRange(start: string, end?: string): string[] {
  const dates = getDatesInRange(start, end);
  return dates.filter(d => new Date(d).getDay() === 0);
}

function getTypeInfo(key: string) {
  return EVENT_TYPES.find(t => t.key === key) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

/** Dates between date_start and date_end inclusive */
function getDatesInRange(start: string, end?: string): string[] {
  if (!end || end <= start) return [start];
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

interface NewEventForm {
  title: string;
  date_start: string;
  date_end: string;
  type: typeof SPECIAL_EVENT_TYPES[number];
  description: string;
  location: string;
}

const emptyForm: NewEventForm = {
  title: '',
  date_start: '',
  date_end: '',
  type: 'special',
  description: '',
  location: '',
};

export default function EvenementsPage() {
  const [sundays, setSundays] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [programmeDates, setprogrammeDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventForm, setNewEventForm] = useState<NewEventForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getPlanning(currentYear).catch(() => [] as any[]),
      getSpecialEvents().catch(() => [] as SpecialEvent[]),
      loadPrograms().catch(() => []),
    ]).then(([s, e, progs]) => {
      setSundays(s);
      setSpecialEvents(e);
      // Extract unique dates from Programme du culte (filter to current year)
      const sundayDatesSet = new Set((s as any[]).map((x: any) => x.date));
      const progDates = progs
        .map(p => p.key_name)
        .filter(d => d.startsWith(String(currentYear)) && !sundayDatesSet.has(d));
      setprogrammeDates(progDates);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentYear]);

  // Build a map: date → list of items (sundays + special events + programme du culte)
  const dateMap = useMemo(() => {
    const map = new Map<string, { type: 'sunday' | 'special' | 'programme'; data: any }[]>();

    const add = (date: string, item: { type: 'sunday' | 'special' | 'programme'; data: any }) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    };

    sundays.forEach(s => add(s.date, { type: 'sunday', data: s }));

    specialEvents.forEach(e => {
      const dates = getDatesInRange(e.date_start, e.date_end);
      dates.forEach(d => add(d, { type: 'special', data: e }));
    });

    // Programme du culte dates not already covered by a sunday entry
    programmeDates.forEach(d => add(d, { type: 'programme', data: { date: d } }));

    return map;
  }, [sundays, specialEvents, programmeDates]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7;
    const days: { date: string; day: number; isCurrentMonth: boolean; items: { type: 'sunday' | 'special'; data: any }[] }[] = [];

    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth, -i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, items: dateMap.get(dateStr) || [] });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, day: i, isCurrentMonth: true, items: dateMap.get(dateStr) || [] });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, items: dateMap.get(dateStr) || [] });
    }
    return days;
  }, [currentMonth, currentYear, dateMap]);

  const selectedItems = selectedDate ? (dateMap.get(selectedDate) || []) : [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Upcoming = sundays + special events from today
  const upcomingItems = useMemo(() => {
    const items: { date: string; label: string; typeKey: string; data: any }[] = [];
    sundays.filter(s => s.date >= todayStr).forEach(s => {
      const isJeunesse = s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse');
      items.push({ date: s.date, label: s.label || 'Culte', typeKey: isJeunesse ? 'jeunesse' : s.evenement ? 'special' : 'culte', data: s });
    });
    specialEvents.filter(e => e.date_start >= todayStr || (e.date_end && e.date_end >= todayStr)).forEach(e => {
      items.push({ date: e.date_start, label: e.title, typeKey: e.type, data: e });
    });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
  }, [sundays, specialEvents, todayStr]);

  // Monthly stats
  const monthItems = [...dateMap.entries()]
    .filter(([date]) => {
      const d = new Date(date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .flatMap(([, items]) => items);

  const monthSundays = monthItems.filter(i => i.type === 'sunday').map(i => i.data);
  const jeunesseCount = monthSundays.filter(s => s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse')).length;
  const specialCount = specialEvents.filter(e => {
    const d = new Date(e.date_start);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getItemTypeKey = (item: { type: 'sunday' | 'special' | 'programme'; data: any }): string => {
    if (item.type === 'special') return item.data.type || 'special';
    if (item.type === 'programme') return 'programme';
    const s = item.data;
    if (s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse')) return 'jeunesse';
    if (s.evenement) return 'special';
    return 'culte';
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createSpecialEvent({
        title: newEventForm.title,
        date_start: newEventForm.date_start,
        date_end: newEventForm.date_end || undefined,
        type: newEventForm.type,
        description: newEventForm.description || undefined,
        location: newEventForm.location || undefined,
      });
      setShowNewEventModal(false);
      setNewEventForm(emptyForm);
      loadData();
    } catch {
      alert('Erreur lors de la création de l\'événement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpecialEvent = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return;
    try {
      await deleteSpecialEvent(id);
      loadData();
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">📅 Événements</h1>
          <p className="text-xs text-muted-foreground">Calendrier des cultes et événements {currentYear}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            <button onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              Calendrier
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              Liste
            </button>
          </div>
          <button onClick={() => setShowNewEventModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Événement multi-jours
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-accent">{monthSundays.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Cultes ce mois</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-yellow-500">{jeunesseCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Jeunesse</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-purple-500">{specialCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Spéciaux</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{sundays.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Total dimanches</p>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Calendar */}
          <div className="lg:col-span-3 bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()); setSelectedDate(todayStr); }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border">
                  Aujourd'hui
                </button>
                <h3 className="text-sm font-bold text-foreground">{MONTHS[currentMonth]} {currentYear}</h3>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map((day, i) => {
                const isToday = day.date === todayStr;
                const isSelected = day.date === selectedDate;
                const hasItems = day.items.length > 0;
                return (
                  <button key={i} onClick={() => setSelectedDate(day.date)}
                    className={`min-h-[64px] p-1 text-left transition-colors relative ${
                      day.isCurrentMonth ? 'bg-card' : 'bg-muted/30'
                    } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} hover:bg-muted/50`}>
                    <span className={`text-[11px] font-medium inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      isToday ? 'bg-primary text-primary-foreground' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {day.day}
                    </span>
                    {hasItems && (
                      <div className="mt-0.5 space-y-0.5">
                        {day.items.slice(0, 2).map((item, j) => {
                          const typeKey = getItemTypeKey(item);
                          const typeInfo = getTypeInfo(typeKey);
                          const label = item.type === 'special' ? item.data.title : (item.data.label || 'Culte');
                          return (
                            <div key={j} className={`text-[8px] px-1 py-0.5 rounded truncate text-white ${typeInfo.dot}`}>
                              {item.type === 'special' && item.data.date_end ? '↔ ' : ''}{label}
                            </div>
                          );
                        })}
                        {day.items.length > 2 && (
                          <div className="text-[8px] text-muted-foreground px-1">
                            +{day.items.length - 2} autre{day.items.length - 2 > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-3 flex-wrap">
              {EVENT_TYPES.map(t => (
                <div key={t.key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {selectedDate ? (
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-foreground capitalize">
                    {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <button onClick={() => setSelectedDate(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                {selectedItems.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItems.map((item, i) => {
                      const typeKey = getItemTypeKey(item);
                      const typeInfo = getTypeInfo(typeKey);
                      if (item.type === 'programme') {
                        return (
                          <div key={i} className="p-3 rounded-md bg-muted/50 border border-border">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${typeInfo.dot}`} />
                              <span className="text-xs font-bold text-foreground">Programme du culte</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">📋 Programme enregistré</p>
                          </div>
                        );
                      }
                      if (item.type === 'sunday') {
                        const s = item.data;
                        return (
                          <div key={i} className="p-3 rounded-md bg-muted/50 border border-border">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${typeInfo.dot}`} />
                              <span className="text-xs font-bold text-foreground">{s.label || 'Culte'}</span>
                            </div>
                            {s.dirigeant && <p className="text-[11px] text-muted-foreground">🎤 {s.dirigeant}</p>}
                            {s.piano && <p className="text-[11px] text-muted-foreground">🎹 {s.piano}</p>}
                            {s.son && <p className="text-[11px] text-muted-foreground">🔊 {s.son}</p>}
                            {s.note && <p className="text-[11px] text-muted-foreground mt-1 italic">📝 {s.note}</p>}
                          </div>
                        );
                      } else {
                        const e = item.data as SpecialEvent;
                        return (
                          <div key={i} className="p-3 rounded-md bg-muted/50 border border-border">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${typeInfo.dot}`} />
                                <span className="text-xs font-bold text-foreground">{e.title}</span>
                              </div>
                              {e.id && (
                                <button onClick={() => handleDeleteSpecialEvent(e.id!)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {e.date_end && e.date_end !== e.date_start && (
                              <p className="text-[11px] text-muted-foreground">
                                📆 Du {new Date(e.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au {new Date(e.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                            {e.location && <p className="text-[11px] text-muted-foreground">📍 {e.location}</p>}
                            {e.description && <p className="text-[11px] text-muted-foreground mt-1 italic">📝 {e.description}</p>}
                            <span className={`mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-full text-white ${typeInfo.color}`}>{typeInfo.label}</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucun événement ce jour</p>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">📅 Prochains événements</h3>
                <div className="space-y-2">
                  {upcomingItems.slice(0, 6).map((item, i) => {
                    const typeInfo = getTypeInfo(item.typeKey);
                    return (
                      <button key={i} onClick={() => { setSelectedDate(item.date); const d = new Date(item.date); setCurrentMonth(d.getMonth()); setCurrentYear(d.getFullYear()); }}
                        className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${typeInfo.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <div className="col-span-1">Type</div>
            <div className="col-span-3">Date(s)</div>
            <div className="col-span-3">Label</div>
            <div className="col-span-2">Dirigeant</div>
            <div className="col-span-2">Lieu</div>
            <div className="col-span-1"></div>
          </div>
          {upcomingItems.map((item, i) => {
            const typeInfo = getTypeInfo(item.typeKey);
            const isSpecial = item.data.date_start !== undefined;
            const dateLabel = isSpecial && item.data.date_end && item.data.date_end !== item.data.date_start
              ? `${new Date(item.data.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${new Date(item.data.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-1"><span className={`w-3 h-3 rounded-full inline-block ${typeInfo.dot}`} /></div>
                <div className="col-span-3 text-xs font-medium text-foreground capitalize">{dateLabel}</div>
                <div className="col-span-3 text-xs text-foreground">{item.label}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{isSpecial ? '—' : (item.data.dirigeant || '—')}</div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{isSpecial ? (item.data.location || '—') : '—'}</div>
                <div className="col-span-1 flex justify-end">
                  {isSpecial && item.data.id && (
                    <button onClick={() => handleDeleteSpecialEvent(item.data.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          {upcomingItems.length === 0 && (
            <div className="py-12 text-center text-xs text-muted-foreground">Aucun événement à venir</div>
          )}
        </div>
      )}

      {/* Modal nouvel événement multi-jours */}
      <AnimatePresence>
        {showNewEventModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewEventModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-accent" /> Nouvel événement
                </h3>
                <button onClick={() => setShowNewEventModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Titre *</label>
                  <input required value={newEventForm.title} onChange={e => setNewEventForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex : Camp de jeunes, Conférence..."
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Date début *</label>
                    <input required type="date" value={newEventForm.date_start}
                      onChange={e => {
                        const newStart = e.target.value;
                        setNewEventForm(f => ({
                          ...f,
                          date_start: newStart,
                          date_end: f.date_end && f.date_end < newStart ? '' : f.date_end,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Date fin</label>
                    <input type="date" value={newEventForm.date_end} min={newEventForm.date_start}
                      onChange={e => setNewEventForm(f => ({ ...f, date_end: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {newEventForm.date_start && newEventForm.date_end && newEventForm.date_end > newEventForm.date_start && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-md">
                      📆 Durée : {getDatesInRange(newEventForm.date_start, newEventForm.date_end).length} jours
                      — apparaîtra sur chaque journée du calendrier
                    </p>
                    {getSundaysInRange(newEventForm.date_start, newEventForm.date_end).length > 0 && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-md">
                        ⛪ Dimanche(s) inclus : {getSundaysInRange(newEventForm.date_start, newEventForm.date_end)
                          .map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))
                          .join(', ')} — pensez à mettre à jour le Planning Louange si nécessaire.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Type</label>
                  <select value={newEventForm.type} onChange={e => setNewEventForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring">
                    {SPECIAL_EVENT_TYPES.map(t => (
                      <option key={t} value={t}>{getTypeInfo(t).label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Lieu</label>
                  <input value={newEventForm.location} onChange={e => setNewEventForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Ex : Salle communautaire..."
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Description</label>
                  <textarea rows={2} value={newEventForm.description} onChange={e => setNewEventForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Informations complémentaires..."
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring resize-none" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowNewEventModal(false)}
                    className="flex-1 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors">
                    {saving ? 'Enregistrement...' : 'Créer l\'événement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
