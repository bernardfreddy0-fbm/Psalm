import { useEffect, useState, useMemo } from 'react';
import { getPlanning, getMembers } from '@/lib/api';
import { Repeat, Users, BarChart3, AlertTriangle, CheckCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

type ViewTab = 'overview' | 'members' | 'equity';

function parseChoristes(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export default function RotationsPage() {
  const [sundays, setSundays] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<ViewTab>('overview');
  const [roleFilter, setRoleFilter] = useState('Tous');

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

  // Compute participation stats per member
  const participationStats = useMemo(() => {
    const stats: Record<string, { name: string; role: string; instrument: string; count: number; roles: Record<string, number>; lastDate: string }> = {};

    members.forEach(m => {
      const name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
      stats[name] = { name, role: m.role || '', instrument: m.instrument || '', count: 0, roles: {}, lastDate: '' };
    });

    sundays.forEach(s => {
      const addParticipation = (name: string, role: string) => {
        if (!name) return;
        if (!stats[name]) stats[name] = { name, role: '', instrument: '', count: 0, roles: {}, lastDate: '' };
        stats[name].count++;
        stats[name].roles[role] = (stats[name].roles[role] || 0) + 1;
        if (!stats[name].lastDate || s.date > stats[name].lastDate) stats[name].lastDate = s.date;
      };

      addParticipation(s.dirigeant, 'Dirigeant');
      parseChoristes(s.choristes).forEach(c => addParticipation(c, 'Choriste'));
      addParticipation(s.piano, 'Piano');
      addParticipation(s.batterie, 'Batterie');
      addParticipation(s.guitare_elec, 'Guitare élec.');
      addParticipation(s.guitare_acou, 'Guitare acou.');
      addParticipation(s.basse, 'Basse');
      addParticipation(s.son, 'Sonorisation');
      addParticipation(s.projection, 'Projection');
      addParticipation(s.video, 'Vidéo');
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [sundays, members]);

  const activeParticipants = participationStats.filter(p => p.count > 0);
  const inactiveParticipants = participationStats.filter(p => p.count === 0);
  const avgParticipation = activeParticipants.length > 0
    ? Math.round(activeParticipants.reduce((s, p) => s + p.count, 0) / activeParticipants.length)
    : 0;

  // Role distribution
  const roleDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    sundays.forEach(s => {
      if (s.dirigeant) dist['Dirigeant'] = (dist['Dirigeant'] || 0) + 1;
      parseChoristes(s.choristes).forEach(() => { dist['Choriste'] = (dist['Choriste'] || 0) + 1; });
      if (s.piano) dist['Piano'] = (dist['Piano'] || 0) + 1;
      if (s.batterie) dist['Batterie'] = (dist['Batterie'] || 0) + 1;
      if (s.guitare_elec) dist['Guitare élec.'] = (dist['Guitare élec.'] || 0) + 1;
      if (s.guitare_acou) dist['Guitare acou.'] = (dist['Guitare acou.'] || 0) + 1;
      if (s.basse) dist['Basse'] = (dist['Basse'] || 0) + 1;
      if (s.son) dist['Sonorisation'] = (dist['Sonorisation'] || 0) + 1;
      if (s.projection) dist['Projection'] = (dist['Projection'] || 0) + 1;
      if (s.video) dist['Vidéo'] = (dist['Vidéo'] || 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [sundays]);

  const ROLE_FILTERS = ['Tous', 'Dirigeant', 'Choriste', 'Piano', 'Batterie', 'Guitare', 'Basse', 'Sonorisation', 'Projection', 'Vidéo'];

  const filteredStats = roleFilter === 'Tous'
    ? activeParticipants
    : activeParticipants.filter(p => {
        const roleKeys = Object.keys(p.roles);
        return roleKeys.some(r => r.toLowerCase().includes(roleFilter.toLowerCase()));
      });

  const maxCount = Math.max(...filteredStats.map(p => p.count), 1);

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement des rotations...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🔄 Rotations & Participation</h1>
          <p className="text-xs text-muted-foreground">Suivi de la répartition équitable des services {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { v: activeParticipants.length, l: 'Participants actifs', icon: Users, color: 'text-accent' },
          { v: inactiveParticipants.length, l: 'Non assignés', icon: AlertTriangle, color: 'text-destructive' },
          { v: avgParticipation, l: 'Moy. services/personne', icon: BarChart3, color: 'text-green-500' },
          { v: sundays.length, l: 'Dimanches total', icon: CheckCircle, color: 'text-muted-foreground' },
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { key: 'overview' as ViewTab, label: 'Vue d\'ensemble', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: 'members' as ViewTab, label: 'Par membre', icon: <Users className="w-3.5 h-3.5" /> },
          { key: 'equity' as ViewTab, label: 'Équité', icon: <Repeat className="w-3.5 h-3.5" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Vue d'ensemble */}
      {viewTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">📊 Répartition par poste</h3>
            <div className="space-y-2">
              {roleDistribution.map(([role, count]) => {
                const max = Math.max(...roleDistribution.map(r => r[1]), 1);
                return (
                  <div key={role} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 truncate">{role}</span>
                    <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                      <div className="bg-accent h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${(count / max) * 100}%`, minWidth: '24px' }}>
                        <span className="text-[10px] text-accent-foreground font-bold">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {roleDistribution.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée d'assignation</p>}
            </div>
          </div>

          {/* Top participants */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">🏆 Top 10 participants</h3>
            <div className="space-y-2">
              {activeParticipants.slice(0, 10).map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}.</span>
                  <span className="text-sm font-medium text-foreground flex-1">{p.name}</span>
                  <div className="flex gap-1">
                    {Object.entries(p.roles).map(([role, count]) => (
                      <span key={role} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                        {role} ×{count}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-foreground">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Par membre */}
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
              <div className="col-span-3">Rôles</div>
              <div className="col-span-4">Fréquence</div>
              <div className="col-span-1 text-center">Total</div>
              <div className="col-span-1 text-center">Statut</div>
            </div>
            {filteredStats.map((p, i) => {
              const isOverworked = p.count > avgParticipation * 1.5;
              const isUnderused = p.count < avgParticipation * 0.5 && p.count > 0;
              return (
                <motion.div key={p.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-12 px-4 py-2.5 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors">
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    {p.lastDate && <p className="text-[10px] text-muted-foreground">Dernier: {new Date(p.lastDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-0.5">
                    {Object.entries(p.roles).map(([role, count]) => (
                      <span key={role} className="text-[9px] px-1 py-0.5 rounded bg-muted text-foreground">{role} ×{count}</span>
                    ))}
                  </div>
                  <div className="col-span-4">
                    <div className="bg-muted rounded-full h-4 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${isOverworked ? 'bg-destructive' : isUnderused ? 'bg-yellow-500' : 'bg-accent'}`}
                        style={{ width: `${(p.count / maxCount) * 100}%`, minWidth: '4px' }} />
                    </div>
                  </div>
                  <div className="col-span-1 text-center text-sm font-bold text-foreground">{p.count}</div>
                  <div className="col-span-1 text-center">
                    {isOverworked ? <TrendingUp className="w-4 h-4 text-destructive mx-auto" /> :
                     isUnderused ? <TrendingDown className="w-4 h-4 text-yellow-500 mx-auto" /> :
                     <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                  </div>
                </motion.div>
              );
            })}
            {filteredStats.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">Aucun participant pour ce filtre</div>
            )}
          </div>
        </div>
      )}

      {/* Équité */}
      {viewTab === 'equity' && (
        <div className="space-y-4">
          {/* Alerts */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">⚠️ Alertes d'équité</h3>
            <div className="space-y-2">
              {activeParticipants.filter(p => p.count > avgParticipation * 1.5).length > 0 ? (
                activeParticipants.filter(p => p.count > avgParticipation * 1.5).map(p => (
                  <div key={p.name} className="flex items-center gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                    <TrendingUp className="w-4 h-4 text-destructive flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">Sollicité {p.count} fois (moyenne: {avgParticipation})</p>
                    </div>
                    <span className="text-xs font-bold text-destructive">Sur-sollicité</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Aucun membre sur-sollicité</p>
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">😴 Membres inactifs ({inactiveParticipants.length})</h3>
            {inactiveParticipants.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {inactiveParticipants.map(p => (
                  <div key={p.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span className="text-foreground truncate">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">{p.role ? p.role.replace(/_/g, ' ') : '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Tous les membres ont été assignés</p>
            )}
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">📈 Distribution de la charge</h3>
            <div className="flex items-end gap-1 h-32">
              {activeParticipants.map((p, i) => {
                const height = (p.count / maxCount) * 100;
                const isOverworked = p.count > avgParticipation * 1.5;
                const isUnderused = p.count < avgParticipation * 0.5;
                return (
                  <div key={p.name} className="flex-1 flex flex-col items-center justify-end group relative" style={{ minWidth: '4px' }}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-card text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {p.name}: {p.count}
                    </div>
                    <div className={`w-full rounded-t transition-all ${isOverworked ? 'bg-destructive' : isUnderused ? 'bg-yellow-500' : 'bg-accent'}`}
                      style={{ height: `${height}%`, minHeight: '2px' }} />
                  </div>
                );
              })}
            </div>
            {avgParticipation > 0 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Ligne de moyenne: {avgParticipation} services · 🔴 Sur-sollicité · 🟡 Sous-sollicité · 🔵 Équilibré
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
