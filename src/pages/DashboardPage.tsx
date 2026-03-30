import { useEffect, useState } from 'react';
import { getMembers, getPlanning, getSongs } from '@/lib/api';
import { Users, Calendar, Music, BookOpen } from 'lucide-react';
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
    { label: 'Membres', value: stats.members, icon: Users, accent: 'bg-accent/15 text-accent' },
    { label: 'Dimanches planifiés', value: stats.sundays, icon: Calendar, accent: 'bg-success/15 text-success' },
    { label: 'Chants', value: stats.songs, icon: Music, accent: 'bg-gold/15 text-gold' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">Accueil</h1>
      <p className="text-sm text-muted-foreground mb-6">Communauté chrétienne vivante — Cultes, Événements & Fraternité</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="warm-card rounded-lg border border-border p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${card.accent}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground font-display">
              {loading ? '—' : card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick links matching WordPress footer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="warm-card rounded-lg border border-border p-5">
          <h2 className="text-lg font-display font-semibold text-foreground mb-3">Participer</h2>
          <ul className="space-y-2 text-sm">
            <li className="text-gold hover:underline cursor-pointer">Événements</li>
            <li className="text-gold hover:underline cursor-pointer">Équipes</li>
            <li className="text-gold hover:underline cursor-pointer">Louange</li>
            <li className="text-gold hover:underline cursor-pointer">Nous rejoindre</li>
          </ul>
        </div>
        <div className="warm-card rounded-lg border border-border p-5">
          <h2 className="text-lg font-display font-semibold text-foreground mb-3">Ressources</h2>
          <ul className="space-y-2 text-sm">
            <li className="text-gold hover:underline cursor-pointer">Sermons</li>
            <li className="text-gold hover:underline cursor-pointer">Espace membre</li>
            <li className="text-gold hover:underline cursor-pointer">Contact</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
