import { useEffect, useState } from 'react';
import { getSystemStats, clearCache, getBackupUrl } from '@/lib/api';
import { Database, HardDrive, Users, Music, Calendar, Activity, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ConfigMaintenance() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    getSystemStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await clearCache();
      toast.success(res?.message || 'Cache nettoyé');
    } catch { toast.error('Erreur'); }
    finally { setClearing(false); }
  };

  const handleBackup = () => {
    const token = localStorage.getItem('aef_admin_token') || '';
    window.open(`${getBackupUrl()}&token=${encodeURIComponent(token)}`, '_blank');
    toast.success('Téléchargement lancé');
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  const db = stats?.database || {};
  const sys = stats?.system || {};
  const sessions = stats?.sessions || {};

  const statCards = [
    { icon: Users, label: 'Utilisateurs', value: db.users_count || 0, color: 'text-accent' },
    { icon: Calendar, label: 'Planning', value: db.planning_count || 0, color: 'text-success' },
    { icon: Music, label: 'Chants', value: db.songs_count || 0, color: 'text-gold' },
    { icon: Activity, label: 'Logs', value: db.logs_count || 0, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <s.icon className={`w-5 h-5 mb-2 ${s.color}`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* System info */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4" /> Système
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">PHP</span>
            <span className="text-foreground font-medium">{sys.php_version || '—'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">Mémoire</span>
            <span className="text-foreground font-medium">{formatBytes(sys.memory_usage || 0)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">Disque libre</span>
            <span className="text-foreground font-medium">{formatBytes(sys.disk_free_space || 0)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">Sessions actives</span>
            <span className="text-foreground font-medium">{sessions.active || 0}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Database className="w-4 h-4" /> Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleBackup}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium">
            <Download className="w-4 h-4" /> Sauvegarder la BDD
          </button>
          <button onClick={handleClearCache} disabled={clearing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-foreground text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> {clearing ? 'Nettoyage...' : 'Vider le cache'}
          </button>
        </div>
      </div>
    </div>
  );
}
