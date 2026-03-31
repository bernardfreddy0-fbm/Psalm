/**
 * Equity Engine — calculates fairness metrics for rotation distribution
 */

export interface MemberParticipation {
  name: string;
  role: string;
  count: number;
  roles: Record<string, number>;
  lastDate: string;
  daysSinceLast: number;
  equityScore: number; // 0-100, 100 = perfectly balanced
  status: 'balanced' | 'overworked' | 'underused' | 'inactive';
}

export interface RoleEquity {
  role: string;
  members: { name: string; count: number }[];
  gini: number;
  avg: number;
  min: number;
  max: number;
  spread: number; // max - min
}

export interface EquityReport {
  globalGini: number;
  globalScore: number; // 0-100
  totalSundays: number;
  avgParticipation: number;
  members: MemberParticipation[];
  roleEquity: RoleEquity[];
  alerts: EquityAlert[];
  recommendations: Recommendation[];
}

export interface EquityAlert {
  type: 'overworked' | 'underused' | 'long_gap' | 'monopoly';
  severity: 'warning' | 'critical';
  member: string;
  message: string;
}

export interface Recommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  details: string;
}

function parseChoristes(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/** Gini coefficient: 0 = perfect equality, 1 = total inequality */
function calculateGini(values: number[]): number {
  if (values.length <= 1) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  let sumDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sumDiffs / (2 * n * n * mean);
}

export function computeEquityReport(sundays: any[], members: any[]): EquityReport {
  const today = new Date();
  const stats: Record<string, { count: number; roles: Record<string, number>; lastDate: string }> = {};

  // Build member ID → name lookup
  const memberById: Record<number | string, string> = {};
  members.forEach(m => {
    const name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
    if (name) {
      stats[name] = { count: 0, roles: {}, lastDate: '' };
      if (m.id) memberById[m.id] = name;
    }
  });

  // Role-level tracking
  const roleMembers: Record<string, Record<string, number>> = {};

  const addParticipation = (name: string, role: string, date: string) => {
    if (!name) return;
    if (!stats[name]) stats[name] = { count: 0, roles: {}, lastDate: '' };
    stats[name].count++;
    stats[name].roles[role] = (stats[name].roles[role] || 0) + 1;
    if (!stats[name].lastDate || date > stats[name].lastDate) stats[name].lastDate = date;

    if (!roleMembers[role]) roleMembers[role] = {};
    roleMembers[role][name] = (roleMembers[role][name] || 0) + 1;
  };

  // Resolve a field that could be a name string or a member ID
  const resolveName = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number' && memberById[val]) return memberById[val];
    return '';
  };

  // Parse all sundays
  sundays.forEach(s => {
    const date = s.date || '';
    // Dirigeant: support both name string and ID reference
    const dirigeantName = resolveName(s.dirigeant) || resolveName(s.dirigeant_id);
    addParticipation(dirigeantName, 'Dirigeant', date);
    parseChoristes(s.choristes).forEach(c => addParticipation(c, 'Choriste', date));
    addParticipation(resolveName(s.piano), 'Piano', date);
    addParticipation(resolveName(s.batterie), 'Batterie', date);
    addParticipation(resolveName(s.guitare_elec), 'Guitare élec.', date);
    addParticipation(resolveName(s.guitare_acou), 'Guitare acou.', date);
    addParticipation(resolveName(s.basse), 'Basse', date);
    if (s.son) {
      parseChoristes(s.son).forEach(n => addParticipation(n, 'Sonorisation', date));
    }
    addParticipation(resolveName(s.projection), 'Projection', date);
    if (s.video) {
      parseChoristes(s.video).forEach(n => addParticipation(n, 'Vidéo', date));
    }
  });

  const activeCounts = Object.values(stats).filter(s => s.count > 0).map(s => s.count);
  const avgParticipation = activeCounts.length > 0
    ? activeCounts.reduce((s, v) => s + v, 0) / activeCounts.length
    : 0;

  const globalGini = calculateGini(activeCounts);
  const globalScore = Math.round((1 - globalGini) * 100);

  // Build member participation list
  const memberList: MemberParticipation[] = Object.entries(stats).map(([name, s]) => {
    const daysSinceLast = s.lastDate
      ? Math.floor((today.getTime() - new Date(s.lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    let status: MemberParticipation['status'] = 'balanced';
    if (s.count === 0) status = 'inactive';
    else if (s.count > avgParticipation * 1.5) status = 'overworked';
    else if (s.count < avgParticipation * 0.5) status = 'underused';

    const deviation = avgParticipation > 0 ? Math.abs(s.count - avgParticipation) / avgParticipation : 0;
    const equityScore = Math.max(0, Math.round((1 - Math.min(deviation, 1)) * 100));

    return {
      name,
      role: members.find(m => `${m.first_name} ${m.last_name}`.trim() === name)?.role || '',
      count: s.count,
      roles: s.roles,
      lastDate: s.lastDate,
      daysSinceLast,
      equityScore,
      status,
    };
  }).sort((a, b) => b.count - a.count);

  // Role equity analysis
  const roleEquity: RoleEquity[] = Object.entries(roleMembers).map(([role, members]) => {
    const entries = Object.entries(members).map(([name, count]) => ({ name, count }));
    const counts = entries.map(e => e.count);
    const avg = counts.reduce((s, v) => s + v, 0) / counts.length;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    return {
      role,
      members: entries.sort((a, b) => b.count - a.count),
      gini: calculateGini(counts),
      avg: Math.round(avg * 10) / 10,
      min,
      max,
      spread: max - min,
    };
  }).sort((a, b) => b.gini - a.gini);

  // Generate alerts
  const alerts: EquityAlert[] = [];
  memberList.forEach(m => {
    if (m.status === 'overworked') {
      alerts.push({
        type: 'overworked',
        severity: m.count > avgParticipation * 2 ? 'critical' : 'warning',
        member: m.name,
        message: `${m.name} est sollicité ${m.count} fois (moyenne: ${Math.round(avgParticipation)})`,
      });
    }
    if (m.daysSinceLast > 60 && m.count > 0) {
      alerts.push({
        type: 'long_gap',
        severity: m.daysSinceLast > 90 ? 'critical' : 'warning',
        member: m.name,
        message: `${m.name} n'a pas servi depuis ${m.daysSinceLast} jours`,
      });
    }
  });

  roleEquity.forEach(r => {
    if (r.members.length >= 2 && r.gini > 0.3) {
      const top = r.members[0];
      alerts.push({
        type: 'monopoly',
        severity: r.gini > 0.5 ? 'critical' : 'warning',
        member: top.name,
        message: `Poste "${r.role}" : ${top.name} fait ${top.count}/${r.members.reduce((s, m) => s + m.count, 0)} services (Gini: ${(r.gini * 100).toFixed(0)}%)`,
      });
    }
  });

  // Generate recommendations
  const recommendations: Recommendation[] = [];
  if (globalGini > 0.3) {
    recommendations.push({
      action: 'Rééquilibrer la charge globale',
      priority: globalGini > 0.5 ? 'high' : 'medium',
      details: `Le coefficient de Gini global est de ${(globalGini * 100).toFixed(0)}%. Objectif : < 20%.`,
    });
  }

  const inactive = memberList.filter(m => m.status === 'inactive');
  if (inactive.length > 5) {
    recommendations.push({
      action: 'Intégrer les membres inactifs',
      priority: 'medium',
      details: `${inactive.length} membres n'ont jamais été assignés cette année.`,
    });
  }

  roleEquity.filter(r => r.spread > 3 && r.members.length > 2).forEach(r => {
    const underused = r.members.filter(m => m.count < r.avg * 0.5);
    if (underused.length > 0) {
      recommendations.push({
        action: `Diversifier le poste "${r.role}"`,
        priority: 'medium',
        details: `${underused.map(m => m.name).join(', ')} pourrai${underused.length > 1 ? 'ent' : 't'} être davantage sollicité${underused.length > 1 ? 's' : ''}.`,
      });
    }
  });

  return {
    globalGini,
    globalScore,
    totalSundays: sundays.length,
    avgParticipation: Math.round(avgParticipation * 10) / 10,
    members: memberList,
    roleEquity,
    alerts: alerts.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1)),
    recommendations: recommendations.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    }),
  };
}
