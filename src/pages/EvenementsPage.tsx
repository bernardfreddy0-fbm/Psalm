import { useEffect, useState, useMemo } from 'react';
import { getPlanning } from '@/lib/api';
import { CalendarRange, ChevronLeft, ChevronRight, Plus, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const EVENT_TYPES = [
  { key: 'culte', label: 'Culte', color: 'bg-accent', dot: 'bg-accent' },
  { key: 'jeunesse', label: 'Jeunesse', color: 'bg-yellow-500', dot: 'bg-yellow-500' },
  { key: 'special', label: 'Événement spécial', color: 'bg-purple-500', dot: 'bg-purple-500' },
  { key: 'repetition', label: 'Répétition', color: 'bg-green-500', dot: 'bg-green-500' },
];

export default function EvenementsPage() {
  const [sundays, setSundays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    setLoading(true);
    getPlanning(currentYear).then(setSundays).catch(() => setSundays([])).finally(() => setLoading(false));
  }, [currentYear]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const days: { date: string; day: number; isCurrentMonth: boolean; events: any[] }[] = [];

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth, -i);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), isCurrentMonth: false, events: [] });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dateStr = d.toISOString().split('T')[0];
      const events = sundays.filter(s => s.date === dateStr);
      days.push({ date: dateStr, day: i, isCurrentMonth: true, events });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), isCurrentMonth: false, events: [] });
    }

    return days;
  }, [currentMonth, currentYear, sundays]);

  const selectedEvents = selectedDate ? sundays.filter(s => s.date === selectedDate) : [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    return sundays
      .filter(s => s.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [sundays, todayStr]);

  // Monthly stats
  const monthEvents = sundays.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const jeunesseCount = monthEvents.filter(s => s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse')).length;
  const specialCount = monthEvents.filter(s => s.evenement).length;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getEventType = (s: any) => {
    if (s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse')) return EVENT_TYPES[1];
    if (s.evenement) return EVENT_TYPES[2];
    return EVENT_TYPES[0];
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-accent">{monthEvents.length}</p>
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
          <p className="text-[10px] text-muted-foreground uppercase">Total année</p>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Calendar */}
          <div className="lg:col-span-3 bg-card rounded-lg border border-border p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <h3 className="text-sm font-bold text-foreground">{MONTHS[currentMonth]} {currentYear}</h3>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>)}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map((day, i) => {
                const isToday = day.date === todayStr;
                const isSelected = day.date === selectedDate;
                const hasEvents = day.events.length > 0;
                return (
                  <button key={i} onClick={() => setSelectedDate(day.date)}
                    className={`min-h-[60px] p-1 text-left transition-colors relative ${
                      day.isCurrentMonth ? 'bg-card' : 'bg-muted/30'
                    } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} hover:bg-muted/50`}>
                    <span className={`text-[11px] font-medium inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      isToday ? 'bg-primary text-primary-foreground' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {day.day}
                    </span>
                    {hasEvents && (
                      <div className="mt-0.5 space-y-0.5">
                        {day.events.slice(0, 2).map((e: any) => {
                          const type = getEventType(e);
                          return (
                            <div key={e.id} className={`text-[8px] px-1 py-0.5 rounded truncate text-white ${type.dot}`}>
                              {e.label || 'Culte'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3">
              {EVENT_TYPES.slice(0, 3).map(t => (
                <div key={t.key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar: selected date or upcoming */}
          <div className="lg:col-span-1 space-y-4">
            {selectedDate ? (
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-foreground capitalize">
                    {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <button onClick={() => setSelectedDate(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                {selectedEvents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEvents.map(e => {
                      const type = getEventType(e);
                      return (
                        <div key={e.id} className="p-3 rounded-md bg-muted/50 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${type.dot}`} />
                            <span className="text-xs font-bold text-foreground">{e.label || 'Culte'}</span>
                          </div>
                          {e.dirigeant && <p className="text-[11px] text-muted-foreground">🎤 {e.dirigeant}</p>}
                          {e.piano && <p className="text-[11px] text-muted-foreground">🎹 {e.piano}</p>}
                          {e.son && <p className="text-[11px] text-muted-foreground">🔊 {e.son}</p>}
                          {e.note && <p className="text-[11px] text-muted-foreground mt-1 italic">📝 {e.note}</p>}
                        </div>
                      );
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
                  {upcomingEvents.slice(0, 6).map(e => {
                    const type = getEventType(e);
                    return (
                      <button key={e.id} onClick={() => { setSelectedDate(e.date); const d = new Date(e.date); setCurrentMonth(d.getMonth()); }}
                        className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${type.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{e.label || 'Culte'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
            <div className="col-span-3">Date</div>
            <div className="col-span-2">Label</div>
            <div className="col-span-2">Dirigeant</div>
            <div className="col-span-2">Équipe</div>
            <div className="col-span-2">Note</div>
          </div>
          {upcomingEvents.map((s, i) => {
            const type = getEventType(s);
            return (
              <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-1"><span className={`w-3 h-3 rounded-full inline-block ${type.dot}`} /></div>
                <div className="col-span-3 text-sm font-medium text-foreground capitalize">
                  {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                </div>
                <div className="col-span-2 text-xs text-foreground">{s.label || 'Culte'}</div>
                <div className="col-span-2 text-xs text-muted-foreground">{s.dirigeant || '—'}</div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {[s.piano, s.batterie, s.son].filter(Boolean).length > 0
                    ? `${[s.piano, s.batterie, s.son].filter(Boolean).length} assignés`
                    : '—'}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{s.note || '—'}</div>
              </motion.div>
            );
          })}
          {upcomingEvents.length === 0 && (
            <div className="py-12 text-center text-xs text-muted-foreground">Aucun événement à venir</div>
          )}
        </div>
      )}
    </div>
  );
}
