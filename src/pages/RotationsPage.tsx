import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlanning, getMembers } from '@/lib/api';
import { Repeat, Users, BarChart3, AlertTriangle, CheckCircle, RefreshCw, TrendingUp, TrendingDown, Shield, Target, Lightbulb, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { computeEquityReport, type EquityReport } from '@/lib/equityEngine';

type ViewTab = 'overview' | 'members' | 'equity' | 'roles';

export default function RotationsPage() {
  const navigate = useNavigate();
  const [sundays, setSundays] = useState<Awaited<ReturnType<typeof getPlanning>>>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getMembers>>>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<ViewTab>('overview');
  const [roleFilter, setRoleFilter] = useState('Tous');
  const [periodFilter, setPeriodFilter] = useState<'annee' | 'semestre' | 'trimestre'>('annee');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPlanning(new Date().getFullYear()).catch(() => []),
      getMembers().catch(() => []),
    ]).then(([s, m]) => {
      setSundays(s);
      setMembers(m);
    }).finally(() => setLoading(false));
  }, []);

  const filteredSundays = useMemo(() => {
    if (periodFilter === 'annee') return sundays;
    const months = periodFilter === 'semestre' ? 6 : 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return sundays.filter(s => s.date >= cutoffStr);
  }, [sundays, periodFilter]);

  const report: EquityReport | null = useMemo(() => {
    if (!filteredSundays.length && !members.length) return null;
    return computeEquityReport(filteredSundays, members);
  }, [filteredSundays, members]);

  const ROLE_FILTERS = ['Tous', 'Dirigeant', 'Choriste', 'Piano', 'Batterie', 'Guitare', 'Basse', 'Sonorisation', 'Projection', 'Vidéo'];

  const filteredMembers = useMemo(() => {
    if (!report) return [];
    const active = report.members.filter(m => m.count > 0);
    if (roleFilter === 'Tous') return active;
    return active.filter(m => Object.keys(m.roles).some(r => r.toLowerCase().includes(roleFilter.toLowerCase())));
  }, [report, roleFilter]);

  const maxCount = Math.max(...(filteredMembers.map(m => m.count)), 1);

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement des rotations...</p>
      </div>
    );
  }

  if (!report) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Aucune donnée disponible</div>;
  }

  const activeCount = report.members.filter(m => m.count > 0).length;
  const inactiveCount = report.members.filter(m => m.count === 0).length;

  const giniColor = report.globalGini < 0.2 ? 'text-green-500' : report.globalGini < 0.35 ? 'text-yellow-500' : 'text-destructive';
  const giniLabel = report.globalGini < 0.2 ? 'Excellent' : report.globalGini < 0.35 ? 'Acceptable' : 'Déséquilibré';

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔄 Rotations & Équité</h1>
          <p className="text-xs text-muted-foreground">Algorithme de répartition équitable · {new Date().getFullYear()}</p>
        </div>
        <div className="flex gap-1">
          {([
            { key: 'annee', label: 'Année' },
            { key: 'semestre', label: 'Semestre' },
            { key: 'trimestre', label: 'Trimestre' },
          ] as const).map(p => (
            <button key={p.key} onClick={() => setPeriodFilter(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${periodFilter === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { v: `${report.globalScore}%`, l: 'Score d\'équité', icon: Shield, color: giniColor },
          { v: activeCount, l: 'Participants actifs', icon: Users, color: 'text-accent' },
          { v: inactiveCount, l: 'Non assignés', icon: AlertTriangle, color: inactiveCount > 5 ? 'text-destructive' : 'text-muted-foreground' },
          { v: report.avgParticipation, l: 'Moy. services', icon: BarChart3, color: 'text-green-500' },
          { v: report.alerts.filter(a => a.severity === 'critical').length, l: 'Alertes critiques', icon: Activity, color: 'text-destructive' },
        ].map((s, i) => (
          <motion.div key={s.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className={`text-2xl font-bold ${s.color}`}>{s.v}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.l}</p>
          </motion.div>
        ))}
      </div>

      {/* Gini meter */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">Indice d'équité globale (Gini)</span>
          <span className={`text-xs font-bold ${giniColor}`}>{(report.globalGini * 100).toFixed(1)}% — {giniLabel}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${report.globalGini < 0.2 ? 'bg-green-500' : report.globalGini < 0.35 ? 'bg-yellow-500' : 'bg-destructive'}`}
            style={{ width: `${Math.min(report.globalGini * 200, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">0% Parfait</span>
          <span className="text-[9px] text-muted-foreground">50%+ Critique</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'overview' as ViewTab, label: 'Vue d\'ensemble', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: 'members' as ViewTab, label: 'Par membre', icon: <Users className="w-3.5 h-3.5" /> },
          { key: 'roles' as ViewTab, label: 'Par poste', icon: <Target className="w-3.5 h-3.5" /> },
          { key: 'equity' as ViewTab, label: 'Alertes & conseils', icon: <Lightbulb className="w-3.5 h-3.5" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              viewTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== VUE D'ENSEMBLE ===== */}
      {viewTab === 'overview' && (
        <div className="space-y-4">
          {/* Distribution chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">📊 Distribution de la charge</h3>
            <div className="flex items-end gap-[2px] h-36">
              {report.members.filter(m => m.count > 0).map((p) => {
                const height = (p.count / maxCount) * 100;
                return (
                  <div key={p.name} className="flex-1 flex flex-col items-center justify-end group relative" style={{ minWidth: '3px' }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-card text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {p.name}: {p.count} · Score: {p.equityScore}%
                    </div>
                    <div className={`w-full rounded-t transition-all ${
                      p.status === 'overworked' ? 'bg-destructive' : p.status === 'underused' ? 'bg-yellow-500' : 'bg-accent'
                    }`} style={{ height: `${height}%`, minHeight: '2px' }} />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-destructive inline-block" /> Sur-sollicité</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-yellow-500 inline-block" /> Sous-sollicité</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-accent inline-block" /> Équilibré</span>
            </div>
          </div>

          {/* Top & Bottom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-destructive" /> Top 5 — Plus sollicités
              </h3>
              <div className="space-y-2">
                {report.members.filter(m => m.count > 0).slice(0, 5).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'overworked' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
                    }`}>{p.count} services</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-yellow-500" /> Top 5 — Moins sollicités
              </h3>
              <div className="space-y-2">
                {[...report.members].filter(m => m.count > 0).sort((a, b) => a.count - b.count).slice(0, 5).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600">{p.count} services</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rest gap */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">⏱️ Repos depuis dernier service</h3>
            <div className="space-y-1.5">
              {report.members
                .filter(m => m.daysSinceLast > 0)
                .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
                .slice(0, 10)
                .map(m => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-xs text-foreground w-36 truncate">{m.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.daysSinceLast > 90 ? 'bg-destructive' : m.daysSinceLast > 45 ? 'bg-yellow-500' : 'bg-accent'}`}
                        style={{ width: `${Math.min((m.daysSinceLast / 120) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold w-14 text-right ${m.daysSinceLast > 90 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {m.daysSinceLast}j
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== PAR MEMBRE ===== */}
      {viewTab === 'members' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap mb-2">
            {ROLE_FILTERS.map(f => (
              <button key={f} onClick={() => setRoleFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  roleFilter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {f}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              <div className="col-span-3">Membre</div>
              <div className="col-span-2">Rôles</div>
              <div className="col-span-3">Fréquence</div>
              <div className="col-span-1 text-center">Total</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-1 text-center">Repos</div>
              <div className="col-span-1 text-center">Statut</div>
            </div>
            {filteredMembers.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 px-4 py-2.5 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-3">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.lastDate && <p className="text-[10px] text-muted-foreground">Dernier: {new Date(p.lastDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>}
                </div>
                <div className="col-span-2 flex flex-wrap gap-0.5">
                  {Object.entries(p.roles).map(([role, count]) => (
                    <span key={role} className="text-[9px] px-1 py-0.5 rounded bg-muted text-foreground">{role} ×{count}</span>
                  ))}
                </div>
                <div className="col-span-3">
                  <div className="bg-muted rounded-full h-4 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      p.status === 'overworked' ? 'bg-destructive' : p.status === 'underused' ? 'bg-yellow-500' : 'bg-accent'
                    }`} style={{ width: `${(p.count / maxCount) * 100}%`, minWidth: '4px' }} />
                  </div>
                </div>
                <div className="col-span-1 text-center text-sm font-bold text-foreground">{p.count}</div>
                <div className="col-span-1 text-center">
                  <span className={`text-[10px] font-bold ${p.equityScore >= 70 ? 'text-green-500' : p.equityScore >= 40 ? 'text-yellow-500' : 'text-destructive'}`}>
                    {p.equityScore}%
                  </span>
                </div>
                <div className="col-span-1 text-center text-[10px] text-muted-foreground">
                  {p.daysSinceLast >= 0 ? `${p.daysSinceLast}j` : '—'}
                </div>
                <div className="col-span-1 text-center">
                  {p.status === 'overworked' ? <TrendingUp className="w-4 h-4 text-destructive mx-auto" /> :
                   p.status === 'underused' ? <TrendingDown className="w-4 h-4 text-yellow-500 mx-auto" /> :
                   <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                </div>
              </motion.div>
            ))}
            {filteredMembers.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">Aucun participant pour ce filtre</div>
            )}
          </div>
        </div>
      )}

      {/* ===== PAR POSTE ===== */}
      {viewTab === 'roles' && (
        <div className="space-y-4">
          {report.roleEquity.map(r => {
            const giniPct = (r.gini * 100).toFixed(0);
            const roleGiniColor = r.gini < 0.2 ? 'text-green-500' : r.gini < 0.35 ? 'text-yellow-500' : 'text-destructive';
            const roleBarColor = r.gini < 0.2 ? 'bg-green-500' : r.gini < 0.35 ? 'bg-yellow-500' : 'bg-destructive';
            const maxInRole = Math.max(...r.members.map(m => m.count), 1);
            return (
              <div key={r.role} className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">{r.role}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{r.members.length} membres · Moy: {r.avg}</span>
                    <span className={`text-[10px] font-bold ${roleGiniColor}`}>Gini: {giniPct}%</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-3 overflow-hidden">
                  <div className={`h-full rounded-full ${roleBarColor}`} style={{ width: `${Math.min(r.gini * 200, 100)}%` }} />
                </div>
                <div className="space-y-1.5">
                  {r.members.map(m => (
                    <div key={m.name} className="flex items-center gap-2">
                      <span className="text-xs text-foreground w-36 truncate">{m.name}</span>
                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                        <div className="bg-accent h-full rounded-full" style={{ width: `${(m.count / maxInRole) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-foreground w-8 text-right">{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ALERTES & CONSEILS ===== */}
      {viewTab === 'equity' && (
        <div className="space-y-4">
          {/* Alerts */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Alertes ({report.alerts.length})
            </h3>
            {report.alerts.length > 0 ? (
              <div className="space-y-2">
                {report.alerts.map((a, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-md border ${
                    a.severity === 'critical' ? 'bg-destructive/5 border-destructive/20' : 'bg-yellow-500/5 border-yellow-500/20'
                  }`}>
                    {a.type === 'overworked' ? <TrendingUp className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" /> :
                     a.type === 'long_gap' ? <RefreshCw className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" /> :
                     a.type === 'monopoly' ? <Target className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" /> :
                     <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{a.message}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      a.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-600'
                    }`}>
                      {a.severity === 'critical' ? 'Critique' : 'Attention'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Aucune alerte — la répartition est équilibrée !</p>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-yellow-500" /> Recommandations
            </h3>
            {report.recommendations.length > 0 ? (
              <div className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <div key={i} className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        r.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                        r.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {r.priority === 'high' ? '🔴 Haute' : r.priority === 'medium' ? '🟡 Moyenne' : '🟢 Basse'}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{r.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.details}</p>
                    <button
                      onClick={() => navigate('/planning')}
                      className="mt-2 text-[11px] text-accent hover:underline font-medium transition-colors">
                      → Voir le planning
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Tout est bien équilibré, pas de recommandation.</p>
            )}
          </div>

          {/* Inactive members */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">😴 Membres non assignés ({report.members.filter(m => m.count === 0).length})</h3>
            {report.members.filter(m => m.count === 0).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {report.members.filter(m => m.count === 0).map(p => (
                  <div key={p.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span className="text-foreground truncate flex-1">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground">{p.role ? p.role.replace(/_/g, ' ') : '—'}</span>
                    <button
                      onClick={() => navigate('/planning')}
                      className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors flex-shrink-0">
                      + Assigner
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Tous les membres ont été assignés</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
