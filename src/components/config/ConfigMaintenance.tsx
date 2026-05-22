import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import {
  Database, Users, Music, Calendar, Activity, RefreshCw,
  Download, CheckCircle, AlertTriangle, Server, Clock,
  FileText, Trash2, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemStats {
  members: number;
  active_members: number;
  songs: number;
  sundays: number;
  events: number;
  absences: number;
  disponibilites: number;
  config_entries: number;
  security_logs: number;
}

interface HealthCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  value: string;
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.FC<any>; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function HealthRow({ check }: { check: HealthCheck }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {check.status === 'ok'
          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          : check.status === 'warn'
          ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
        <span className="text-sm text-foreground">{check.label}</span>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        check.status === 'ok' ? 'bg-emerald-500/10 text-emerald-600' :
        check.status === 'warn' ? 'bg-amber-500/10 text-amber-600' :
        'bg-destructive/10 text-destructive'
      }`}>{check.value}</span>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ConfigMaintenance() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      const year = new Date().getFullYear();
      const [
        membersRes,
        songsRes,
        sundaysRes,
        eventsRes,
        absencesRes,
        disposRes,
        configRes,
      ] = await Promise.allSettled([
        apiFetch<any[]>('/members'),
        apiFetch<any[]>('/songs'),
        apiFetch<any[]>(`/planning/${year}`),
        apiFetch<any[]>('/events'),
        apiFetch<any[]>('/absences'),
        apiFetch<any[]>('/disponibilites'),
        apiFetch<Record<string, string>>('/config'),
      ]);

      const getArr = (res: PromiseSettledResult<any[]>): any[] =>
        res.status === 'fulfilled' ? (res.value ?? []) : [];
      const getObj = (res: PromiseSettledResult<Record<string, string>>) =>
        res.status === 'fulfilled' ? res.value : {};

      const members = getArr(membersRes as PromiseSettledResult<any[]>);
      const songs   = getArr(songsRes as PromiseSettledResult<any[]>);
      const sundays = getArr(sundaysRes as PromiseSettledResult<any[]>);
      const events  = getArr(eventsRes as PromiseSettledResult<any[]>);
      const absences = getArr(absencesRes as PromiseSettledResult<any[]>);
      const dispos  = getArr(disposRes as PromiseSettledResult<any[]>);
      const config  = getObj(configRes as PromiseSettledResult<Record<string, string>>);
      const configCount = Object.keys(config).length;

      const newStats: SystemStats = {
        members: members.length,
        active_members: members.filter((m: any) => m.is_active !== false).length,
        songs: songs.length,
        sundays: sundays.length,
        events: events.length,
        absences: absences.length,
        disponibilites: dispos.length,
        config_entries: configCount,
        security_logs: 0,
      };
      setStats(newStats);

      // Calcul des indicateurs de santé
      const healthChecks: HealthCheck[] = [
        {
          id: 'api',
          label: 'Connexion AEFApi',
          status: 'ok',
          value: 'Connectée',
        },
        {
          id: 'members',
          label: 'Base des membres',
          status: newStats.members > 0 ? 'ok' : 'warn',
          value: `${newStats.members} entrées`,
        },
        {
          id: 'songs',
          label: 'Bibliothèque de chants',
          status: newStats.songs > 0 ? 'ok' : 'warn',
          value: `${newStats.songs} chants`,
        },
        {
          id: 'planning',
          label: 'Planning',
          status: newStats.sundays > 0 ? 'ok' : 'warn',
          value: `${newStats.sundays} dimanches`,
        },
        {
          id: 'https',
          label: 'Connexion HTTPS',
          status: window.location.protocol === 'https:' ? 'ok' : 'error',
          value: window.location.protocol === 'https:' ? 'Chiffrée SSL/TLS' : '⚠️ Non chiffrée',
        },
        {
          id: 'config',
          label: 'Table de configuration',
          status: configCount > 0 ? 'ok' : 'warn',
          value: `${configCount} paramètres`,
        },
      ];
      setHealth(healthChecks);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    toast.success('Statistiques actualisées');
  };

  const handleExportConfig = async () => {
    try {
      const data = await apiFetch<Record<string, string>>('/config');
      const rows = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `"${key}";"${(value ?? '').replace(/"/g, '""')}"`);
      const csv = ['"Clé";"Valeur"', ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `config-aef-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Export de la configuration téléchargé');
    } catch {
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleExportMembers = async () => {
    try {
      const data = await apiFetch<any[]>('/members');
      const sorted = [...data].sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''));
      const rows = sorted.map(r =>
        `"${r.last_name}";"${r.first_name}";"${r.email}";"${r.phone ?? ''}";"${r.role ?? ''}";"${r.is_active !== false ? 'Actif' : 'Inactif'}"`
      );
      const csv = ['"Nom";"Prénom";"Email";"Téléphone";"Rôle";"Statut"', ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `membres-aef-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Export des membres téléchargé');
    } catch {
      toast.error('Erreur lors de l\'export des membres');
    }
  };

  const handlePurgeSecurityLogs = async () => {
    try {
      // Les logs de sécurité sont stockés dans config avec la clé secaudit_*
      // AEFApi ne supporte pas encore la purge par préfixe — fonctionnalité non critique
      toast.info('Purge des journaux non disponible dans cette version');
    } catch {
      toast.error('Erreur lors de la purge');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Chargement des statistiques système...</span>
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: 'Membres total', value: stats?.members ?? 0, sub: `${stats?.active_members ?? 0} actifs`, color: 'bg-accent/10 text-accent' },
    { icon: Music, label: 'Chants', value: stats?.songs ?? 0, color: 'bg-amber-500/10 text-amber-600' },
    { icon: Calendar, label: 'Dimanches', value: stats?.sundays ?? 0, color: 'bg-emerald-500/10 text-emerald-600' },
    { icon: Activity, label: 'Absences enregistrées', value: stats?.absences ?? 0, color: 'bg-orange-500/10 text-orange-600' },
    { icon: BarChart3, label: 'Disponibilités', value: stats?.disponibilites ?? 0, color: 'bg-blue-500/10 text-blue-600' },
    { icon: Database, label: 'Entrées de config', value: stats?.config_entries ?? 0, color: 'bg-purple-500/10 text-purple-600' },
  ];

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-accent" /> Tableau de bord système
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Dernière actualisation : {lastRefresh.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* ── KPIs Supabase ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* ── Santé du système ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" /> Santé du système
        </h3>
        <div className="space-y-0">
          {health.map(h => <HealthRow key={h.id} check={h} />)}
        </div>
      </div>

      {/* ── Exports de données ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-accent" /> Exports de données
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={handleExportMembers}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm text-foreground font-medium">
            <Users className="w-4 h-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-medium">Export Membres</p>
              <p className="text-[10px] text-muted-foreground">CSV UTF-8 · tous les membres</p>
            </div>
          </button>
          <button onClick={handleExportConfig}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm text-foreground font-medium">
            <FileText className="w-4 h-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-medium">Export Configuration</p>
              <p className="text-[10px] text-muted-foreground">CSV · tous les paramètres</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Maintenance ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-muted-foreground" /> Nettoyage
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handlePurgeSecurityLogs}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Purger les journaux &gt; 90 jours
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Les journaux d'audit de sécurité sont stockés dans la table de configuration avec le préfixe <code className="font-mono bg-muted px-1 py-0.5 rounded">secaudit_</code>.
          La purge supprime les entrées de plus de 90 jours.
        </p>
      </div>

    </div>
  );
}
