import { type Sunday } from '@/lib/api';
import { MONTHS, isPast } from './planningTypes';

// ── Year view ─────────────────────────────────────────────────────────────────

export function YearView({ sundays }: { sundays: Sunday[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MONTHS.map((monthName, i) => {
        const monthSundays = sundays.filter(s => new Date(s.date).getMonth() === i);
        return (
          <div key={monthName} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{monthName}</h3>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {monthSundays.length} dim.
              </span>
            </div>
            {monthSundays.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun dimanche</p>
            ) : (
              <div className="space-y-1">
                {monthSundays.map(s => {
                  const dir = s.dir_first ? `${s.dir_first} ${s.dir_last ?? ''}`.trim() : null;
                  const past = isPast(s.date);
                  return (
                    <div key={s.id} className={`flex items-center justify-between text-xs ${past ? 'opacity-50' : ''}`}>
                      <span className="text-muted-foreground">
                        {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {s.is_jeunesse ? ' 👥' : ''}
                      </span>
                      <span className={dir ? 'text-foreground font-medium' : 'text-amber-500'}>
                        {dir ?? 'Sans dirigeant'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
