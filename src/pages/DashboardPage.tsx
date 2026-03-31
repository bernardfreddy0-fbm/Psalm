import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getPlanning, getSongs } from '@/lib/api';
import { Users, Music, CalendarRange, Heart, ArrowRight, Pen, Clock, Mic2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function parseChoristes(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [sundays, setSundays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMembers().catch(() => []),
      getSongs().catch(() => []),
      getPlanning(new Date().getFullYear()).catch(() => []),
    ]).then(([m, s, p]) => {
      setMembers(m);
      setSongs(s);
      setSundays(p);
      setLoading(false);
    });
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Next 3 sundays from real data
  const nextSundays = useMemo(() =>
    sundays.filter(s => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
  [sundays, todayStr]);

  const daysUntilNext = nextSundays.length > 0
    ? Math.ceil((new Date(nextSundays[0].date).getTime() - today.getTime()) / 86400000)
    : null;

  // Active participants count
  const activeParticipants = useMemo(() => {
    const set = new Set<string>();
    sundays.forEach(s => {
      if (s.dirigeant) set.add(s.dirigeant);
      parseChoristes(s.choristes).forEach(c => set.add(c));
      [s.piano, s.batterie, s.guitare_elec, s.guitare_acou, s.basse, s.son, s.projection, s.video].filter(Boolean).forEach(n => set.add(n));
    });
    return set.size;
  }, [sundays]);

  const statCards = [
    { value: members.length, label: 'Membres', icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
    { value: songs.length, label: 'Chants', icon: Music, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { value: sundays.length, label: 'Cultes planifiés', icon: CalendarRange, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { value: activeParticipants, label: 'Bénévoles actifs', icon: Heart, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  const formatDateShort = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const formatDateLong = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-medium text-foreground capitalize">{dateStr}</p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/programme')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors">
            📋 Programme
          </button>
          <button onClick={() => navigate('/evenements')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            + Événement
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          Bonjour{user?.first_name ? `, ${user.first_name}` : ''} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {daysUntilNext !== null
            ? <>Prochain culte dans <strong>{daysUntilNext} jour{daysUntilNext > 1 ? 's' : ''}</strong> · {formatDateLong(nextSundays[0].date)}</>
            : 'Aucun culte planifié à venir'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.bg}`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <span className="text-2xl font-bold text-foreground">{loading ? '—' : c.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Next sunday banner */}
      {nextSundays.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground capitalize">
                Prochain culte — {formatDateLong(nextSundays[0].date)}
              </p>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                {nextSundays[0].dirigeant && <span className="flex items-center gap-1"><Mic2 className="w-3 h-3" /> {nextSundays[0].dirigeant}</span>}
                {nextSundays[0].piano && <span>🎹 {nextSundays[0].piano}</span>}
                {nextSundays[0].son && <span>🔊 {nextSundays[0].son}</span>}
              </div>
              {nextSundays[0].note && <p className="text-xs text-muted-foreground mt-1 italic">📝 {nextSundays[0].note}</p>}
            </div>
            <div className="flex gap-4 text-center">
              <div><p className="text-xl font-bold text-foreground">{daysUntilNext}</p><p className="text-[10px] text-muted-foreground uppercase">Jours</p></div>
              <div><p className="text-xl font-bold text-foreground">{parseChoristes(nextSundays[0].choristes).length}</p><p className="text-[10px] text-muted-foreground uppercase">Choristes</p></div>
            </div>
            <button onClick={() => navigate('/cultes')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium">
              Gérer <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Next 3 sundays */}
        <div className="lg:col-span-3 bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground">📅 Prochains cultes</h2>
            <button onClick={() => navigate('/cultes')} className="text-xs text-accent font-medium">Voir tout →</button>
          </div>
          {nextSundays.length > 0 ? (
            <div className="space-y-3">
              {nextSundays.map((s, i) => {
                const isJeunesse = s.is_jeunesse || (s.label || '').toLowerCase().includes('jeunesse');
                const assignedCount = [s.dirigeant, s.piano, s.batterie, s.guitare_elec, s.guitare_acou, s.basse, s.son, s.projection, s.video].filter(Boolean).length + parseChoristes(s.choristes).length;
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    onClick={() => navigate('/cultes')}
                    className="flex items-center gap-4 p-3 rounded-md bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="text-center min-w-[50px]">
                      <p className="text-lg font-bold text-foreground">{new Date(s.date).getDate()}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{new Date(s.date).toLocaleDateString('fr-FR', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{s.label || 'Culte'}</p>
                        {isJeunesse && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-600 font-semibold">Jeunesse</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.dirigeant || 'Pas de dirigeant'} · {assignedCount} assigné{assignedCount > 1 ? 's' : ''}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">Aucun culte planifié</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold text-foreground mb-4">⚡ Accès rapide</h2>
          <div className="space-y-2">
            {[
              { label: 'Programme du culte', desc: 'Organiser l\'ordre du service', icon: '📋', to: '/programme' },
              { label: 'Planning Louange', desc: 'Gérer les assignations', icon: '🎵', to: '/cultes' },
              { label: 'Rotations', desc: 'Suivi de participation', icon: '🔄', to: '/rotations' },
              { label: 'Bibliothèque', desc: `${songs.length} chants disponibles`, icon: '🎼', to: '/chants' },
              { label: 'Membres', desc: `${members.length} membres`, icon: '👥', to: '/membres' },
            ].map(item => (
              <button key={item.to} onClick={() => navigate(item.to)}
                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors text-left">
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
