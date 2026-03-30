import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMembers, getPlanning, getSongs } from '@/lib/api';
import { Users, Music, CalendarRange, Heart, FileText, ArrowRight, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ members: 0, songs: 0, sundays: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMembers().catch(() => []),
      getSongs().catch(() => []),
      getPlanning(new Date().getFullYear()).catch(() => []),
    ]).then(([m, s, p]) => {
      setStats({ members: m.length, songs: s.length, sundays: p.length });
      setLoading(false);
    });
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Find next sunday
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  const nextSundayStr = nextSunday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statCards = [
    { value: stats.members, label: 'Membres', icon: Users, color: 'text-accent', bg: 'bg-accent/10', trend: '+3 ce mois' },
    { value: stats.songs, label: 'Chants', icon: Music, color: 'text-info', bg: 'bg-info/10', trend: '+2 nouveaux' },
    { value: 1, label: 'Événements à venir', icon: CalendarRange, color: 'text-warning', bg: 'bg-warning/10', trend: 'Ce mois' },
    { value: 14, label: 'Bénévoles confirmés', icon: Heart, color: 'text-gold', bg: 'bg-gold/10', trend: '↑ 82% taux' },
  ];

  const weekEvents = [
    { day: 'Mar 25', time: '19h00', label: 'Réunion de prière', location: 'Salle principale', count: 12, color: 'bg-accent' },
    { day: 'Jeu 27', time: '20h00', label: 'Cellule de jeunes', location: 'Maison frère Marc', count: 25, color: 'bg-success' },
    { day: 'Sam 01', time: '9h00', label: 'Répétition louange', location: 'Église AEF', count: 8, color: 'bg-destructive' },
  ];

  const equipes = [
    { name: 'Louange', icon: '🎵', detail: 'Répétition sam. 9h', count: 8, color: 'bg-success' },
    { name: 'Accueil', icon: '📋', detail: '1 poste à pourvoir', count: 4, color: 'bg-destructive' },
    { name: 'Enfants', icon: '🧸', detail: 'Classes 4-10 ans', count: 6, color: 'bg-success' },
  ];

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-medium text-foreground capitalize">{dateStr}</p>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <FileText className="w-3.5 h-3.5" /> Programme PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            + Nouvel événement
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Bonjour, AEF 👋</h1>
        <p className="text-sm text-muted-foreground">
          Prochain culte dans <strong>{daysUntilSunday} jour{daysUntilSunday > 1 ? 's' : ''}</strong> · Dimanche {nextSunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à 10h00
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.bg}`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <span className="text-2xl font-bold text-foreground">{loading ? '—' : c.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-[11px] text-success font-medium mt-1">↑ {c.trend}</p>
          </motion.div>
        ))}
      </div>

      {/* Prochain culte banner */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6 flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground italic">
            Prochain culte — {nextSundayStr}
          </p>
          <p className="text-xs text-muted-foreground">10h00 · Église AEF</p>
          <button className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gold text-gold-foreground text-xs font-medium">
            ✏️ Définir le thème du culte
          </button>
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-xl font-bold text-foreground">{daysUntilSunday}</p><p className="text-[10px] text-muted-foreground uppercase">Jours</p></div>
          <div><p className="text-xl font-bold text-foreground">14</p><p className="text-[10px] text-muted-foreground uppercase">Bénévoles</p></div>
          <div><p className="text-xl font-bold text-foreground">{loading ? '—' : stats.songs}</p><p className="text-[10px] text-muted-foreground uppercase">Chants</p></div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-foreground">
            📋 Programme
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium">
            Gérer <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Planning de la semaine */}
        <div className="lg:col-span-3 bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              📅 Planning de la semaine
            </h2>
            <span className="text-xs text-accent font-medium cursor-pointer">Voir tout →</span>
          </div>
          <div className="space-y-3">
            {weekEvents.map(e => (
              <div key={e.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="text-right w-12">
                  <p className="text-xs font-semibold text-foreground">{e.day}</p>
                  <p className="text-[10px] text-muted-foreground">{e.time}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${e.color}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground">{e.location}</p>
                </div>
                <span className="text-xs text-muted-foreground">{e.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Équipes du culte */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              🤝 Équipes du culte
            </h2>
            <span className="text-xs text-accent font-medium cursor-pointer">Gérer →</span>
          </div>
          <div className="space-y-3">
            {equipes.map(eq => (
              <div key={eq.name} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className={`w-2 h-2 rounded-full ${eq.color}`} />
                <span className="text-lg">{eq.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{eq.name}</p>
                  <p className="text-[11px] text-muted-foreground">{eq.detail}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{eq.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
