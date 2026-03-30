import { useEffect, useState } from 'react';
import { getMembers, getPlanning, getSongs } from '@/lib/api';
import { Users, Calendar, Music, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const [stats, setStats] = useState({ members: 0, sundays: 0, songs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMembers().catch(() => []),
      getPlanning(new Date().getFullYear()).catch(() => []),
      getSongs().catch(() => []),
    ]).then(([m, p, s]) => {
      setStats({ members: m.length, sundays: p.length, songs: s.length });
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: 'Membres', value: stats.members, icon: Users, color: 'bg-accent/10 text-accent' },
    { label: 'Dimanches', value: stats.sundays, icon: Calendar, color: 'bg-success/10 text-success' },
    { label: 'Chants', value: stats.songs, icon: Music, color: 'bg-gold/10 text-gold' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-lg border border-border p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {loading ? '—' : card.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-2">Bienvenue</h2>
        <p className="text-sm text-muted-foreground">
          Gérez votre équipe de louange, planifiez les dimanches et organisez vos chants depuis cette interface.
        </p>
      </div>
    </div>
  );
}
