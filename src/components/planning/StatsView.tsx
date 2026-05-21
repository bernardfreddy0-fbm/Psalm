import { type Sunday } from '@/lib/api';
import { getInitials } from './planningTypes';

// ── Stats view ────────────────────────────────────────────────────────────────

export function StatsView({ sundays }: { sundays: Sunday[] }) {
  const dirigeants = new Map<string, number>();
  const choristes = new Map<string, number>();

  sundays.forEach(s => {
    if (s.dirigeant_id) {
      const key = `${s.dir_first} ${s.dir_last ?? ''}`.trim();
      dirigeants.set(key, (dirigeants.get(key) ?? 0) + 1);
    }
    (s.assignments?.choriste ?? []).forEach(p => {
      const key = `${p.first_name} ${p.last_name}`;
      choristes.set(key, (choristes.get(key) ?? 0) + 1);
    });
  });

  const topDirig = [...dirigeants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topChor = [...choristes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="text-green-500">🎤</span> Top Dirigeants
        </h3>
        {topDirig.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {topDirig.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center text-[10px] font-bold text-green-600 dark:text-green-400 shrink-0">
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground truncate">{name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{count}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(count / sundays.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="text-blue-500">🎵</span> Top Choristes
        </h3>
        {topChor.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {topChor.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground truncate">{name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{count}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / sundays.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
