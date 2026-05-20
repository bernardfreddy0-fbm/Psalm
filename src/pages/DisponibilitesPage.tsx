import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDisponibilitesAdmin, getAbsencesAdmin, deleteAbsenceAdmin, setDispoDeadline,
  type SundayDispo, type AdminAbsence,
} from '@/lib/api';
import { Calendar, Users, CheckCircle, XCircle, Clock, AlertTriangle, Trash2, CalendarOff } from 'lucide-react';

type Tab = 'dispos' | 'absences';

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function roleBadge(role: string) {
  const r = role.split(',')[0].trim();
  const map: Record<string, string> = {
    conducteur_louange: 'Cond.', responsable_louange: 'Resp.L',
    choriste: 'Chor.', pianiste: 'Piano', batteur: 'Batt.',
    guitariste_electrique: 'Guit.E', guitariste_acoustique: 'Guit.A',
    bassiste: 'Basse', sonorisateur: 'Son.', projectionniste: 'Proj.',
    videaste: 'Vidéo', pasteur: 'Past.', dev: 'Dev',
  };
  return map[r] || r.slice(0, 5);
}

function DispoCard({ sunday }: { sunday: SundayDispo }) {
  const [open, setOpen] = useState(false);
  const rate = sunday.total_members > 0
    ? Math.round(sunday.responded_count / sunday.total_members * 100)
    : 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground">{formatDate(sunday.date)}</span>
            {sunday.is_jeunesse && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">Jeunesse</span>
            )}
            <span className="text-xs text-muted-foreground">{sunday.label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              {sunday.available_count} dispo
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-500" />
              {sunday.responded_count - sunday.available_count} indispo
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {sunday.total_members - sunday.responded_count} sans réponse
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-foreground">{rate}%</div>
          <div className="text-[10px] text-muted-foreground">{sunday.responded_count}/{sunday.total_members}</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-1.5">
          {sunday.responses.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Aucune réponse</p>
          ) : (
            sunday.responses
              .sort((a, b) => (b.available ? 1 : -1) - (a.available ? 1 : -1))
              .map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {r.available === true  && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  {r.available === false && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  {r.available === null  && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="font-medium text-foreground">{r.first_name} {r.last_name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{roleBadge(r.role)}</span>
                  {r.note && <span className="text-muted-foreground italic truncate">{r.note}</span>}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}

function AbsencesTable({ absences, onDelete }: { absences: AdminAbsence[]; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return absences.filter(a =>
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
      a.date_start.includes(q)
    );
  }, [absences, search]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Rechercher un membre..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune absence enregistrée</p>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {filtered.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted/20 transition-colors">
              <CalendarOff className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{a.first_name} {a.last_name}</span>
                <span className="text-[10px] text-muted-foreground ml-2 bg-muted px-1.5 py-0.5 rounded">{roleBadge(a.role)}</span>
                {a.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.reason}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(a.date_start)}</span>
              <button
                onClick={() => onDelete(a.id)}
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                title="Supprimer l'absence"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DisponibilitesPage() {
  const [tab, setTab] = useState<Tab>('dispos');
  const [year, setYear] = useState(new Date().getFullYear());
  const qc = useQueryClient();

  const { data: dispos = [], isLoading: loadingDispos } = useQuery({
    queryKey: ['admin-dispos', year],
    queryFn: () => getDisponibilitesAdmin(year),
  });

  const { data: absences = [], isLoading: loadingAbsences } = useQuery({
    queryKey: ['admin-absences', year],
    queryFn: () => getAbsencesAdmin(year),
  });

  const deleteAbsence = useMutation({
    mutationFn: deleteAbsenceAdmin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-absences'] }),
  });

  const upcomingDispos = dispos.filter(d => d.date >= new Date().toISOString().split('T')[0]);
  const totalResponded = upcomingDispos.reduce((s, d) => s + d.responded_count, 0);
  const totalAvailable = upcomingDispos.reduce((s, d) => s + d.available_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Disponibilités & Absences</h1>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-sm bg-card border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Dimanches à venir', value: upcomingDispos.length, icon: Calendar, color: 'text-primary' },
          { label: 'Réponses reçues', value: totalResponded, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Disponibles', value: totalAvailable, icon: Users, color: 'text-blue-400' },
          { label: 'Absences déclarées', value: absences.filter(a => a.date_start >= new Date().toISOString().split('T')[0]).length, icon: CalendarOff, color: 'text-red-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <kpi.icon className={`w-5 h-5 ${kpi.color} shrink-0`} />
            <div>
              <div className="text-lg font-bold text-foreground">{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
        {([['dispos', '📅 Disponibilités'], ['absences', '🙅 Absences']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dispos' && (
        <div className="space-y-2">
          {loadingDispos ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : dispos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun dimanche pour {year}</p>
          ) : (
            dispos.map(d => <DispoCard key={d.sunday_id} sunday={d} />)
          )}
        </div>
      )}

      {tab === 'absences' && (
        loadingAbsences ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
        ) : (
          <AbsencesTable absences={absences} onDelete={id => deleteAbsence.mutate(id)} />
        )
      )}
    </div>
  );
}
