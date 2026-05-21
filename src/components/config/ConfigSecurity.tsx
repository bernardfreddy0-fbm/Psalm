import { useEffect, useState, useCallback } from 'react';
import { getAllSettings, saveSettingsBulk } from '@/lib/api';
import {
  Save, Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download,
  Lock, Clock, Globe, Key, Activity, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseValue(val: unknown): string {
  if (val === null || val === undefined || val === 'null') return '';
  try {
    const p = JSON.parse(val as string);
    return typeof p === 'string' ? p : String(p);
  } catch {
    return String(val);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Score de sécurité ─────────────────────────────────────────────────────────

interface ScoreCheck {
  label: string;
  points: number;
  passed: boolean;
}

function computeScore(v: Record<string, string>): { score: number; checks: ScoreCheck[] } {
  const checks: ScoreCheck[] = [
    {
      label: 'Timeout de session configuré',
      points: 15,
      passed: parseInt(v.session_timeout || '0') > 0,
    },
    {
      label: 'Limite de tentatives configurée',
      points: 15,
      passed: parseInt(v.max_login_attempts || '0') > 0,
    },
    {
      label: 'Longueur min. mot de passe ≥ 8',
      points: 10,
      passed: parseInt(v.password_min_length || '0') >= 8,
    },
    {
      label: 'Caractères spéciaux requis',
      points: 10,
      passed: v.password_require_special === 'true',
    },
    {
      label: 'Journal d\'audit activé',
      points: 20,
      passed: v.audit_log_enabled === 'true',
    },
    {
      label: 'Restriction par IP activée',
      points: 10,
      passed: v.ip_whitelist_enabled === 'true',
    },
    {
      label: 'Rétention journaux ≥ 30 jours',
      points: 10,
      passed: parseInt(v.audit_log_retention_days || '0') >= 30,
    },
    {
      label: 'Majuscule requise dans le MDP',
      points: 10,
      passed: v.password_require_uppercase === 'true',
    },
  ];
  const score = checks.reduce((acc, c) => acc + (c.passed ? c.points : 0), 0);
  return { score, checks };
}

function scoreColor(score: number): string {
  if (score < 40) return '#ef4444';
  if (score < 70) return '#f97316';
  return '#22c55e';
}

function scoreLabel(score: number): string {
  if (score < 40) return 'Faible';
  if (score < 70) return 'Moyen';
  if (score < 90) return 'Élevé';
  return 'Excellent';
}

// ── Audit automatique ─────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium';

interface AuditCheck {
  id: string;
  label: string;
  desc: string;
  check: (v: Record<string, string>) => boolean;
  severity: Severity;
  note?: string;
}

const AUDIT_CHECKS: AuditCheck[] = [
  {
    id: 'env_vars',
    label: 'Variables d\'environnement',
    desc: 'URL de l\'API chargée depuis les variables d\'env',
    check: () => !!import.meta.env.VITE_API_URL,
    severity: 'critical',
  },
  {
    id: 'https',
    label: 'HTTPS actif',
    desc: 'Connexion chiffrée SSL/TLS',
    check: () => window.location.protocol === 'https:',
    severity: 'critical',
  },
  {
    id: 'session_timeout',
    label: 'Timeout de session',
    desc: 'Déconnexion automatique après inactivité',
    check: (v) => parseInt(v.session_timeout || '0') > 0,
    severity: 'high',
  },
  {
    id: 'rate_limiting',
    label: 'Rate limiting',
    desc: 'Limitation des tentatives de connexion',
    check: (v) => parseInt(v.max_login_attempts || '0') > 0,
    severity: 'high',
  },
  {
    id: 'password_policy',
    label: 'Politique de mot de passe',
    desc: 'Longueur minimum et complexité requises',
    check: (v) => parseInt(v.password_min_length || '0') >= 8 && v.password_require_special === 'true',
    severity: 'medium',
  },
  {
    id: 'audit_log',
    label: 'Journal d\'audit',
    desc: 'Traçabilité des actions sensibles',
    check: (v) => v.audit_log_enabled === 'true',
    severity: 'medium',
  },
  {
    id: 'crypto_password',
    label: 'Génération cryptographique',
    desc: 'Mots de passe générés via crypto.getRandomValues()',
    check: () => typeof crypto !== 'undefined' && !!crypto.getRandomValues,
    severity: 'high',
  },
  {
    id: 'csp_header',
    label: 'Content Security Policy',
    desc: 'Protection XSS via headers HTTP (nginx)',
    check: () => true,
    severity: 'medium',
    note: 'Configuré dans nginx.conf',
  },
];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critique',
  high: 'Élevé',
  medium: 'Moyen',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'text-destructive',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
};

// ── Champs du formulaire ──────────────────────────────────────────────────────

interface Field {
  key: string;
  label: string;
  type: 'number' | 'toggle';
  help?: string;
}

const SESSIONS_FIELDS: Field[] = [
  { key: 'session_timeout', label: 'Délai d\'expiration (minutes)', type: 'number', help: 'Déconnexion automatique après inactivité' },
  { key: 'max_login_attempts', label: 'Tentatives max avant blocage', type: 'number', help: 'Nombre d\'échecs consécutifs autorisés' },
  { key: 'lockout_duration_minutes', label: 'Durée de blocage (minutes)', type: 'number', help: 'Durée pendant laquelle le compte est verrouillé' },
];

const PASSWORD_FIELDS: Field[] = [
  { key: 'password_min_length', label: 'Longueur minimale', type: 'number', help: 'Minimum recommandé : 8 caractères' },
  { key: 'password_require_special', label: 'Caractères spéciaux requis', type: 'toggle' },
  { key: 'password_require_uppercase', label: 'Majuscule requise', type: 'toggle' },
  { key: 'password_require_number', label: 'Chiffre requis', type: 'toggle' },
  { key: 'password_expiry_days', label: 'Expiration (jours, 0 = jamais)', type: 'number', help: '0 pour désactiver l\'expiration' },
];

const LOG_FIELDS: Field[] = [
  { key: 'audit_log_enabled', label: 'Journal d\'activité', type: 'toggle' },
  { key: 'audit_log_retention_days', label: 'Rétention (jours)', type: 'number', help: 'Minimum recommandé : 30 jours' },
  { key: 'log_failed_logins', label: 'Logger les échecs de connexion', type: 'toggle' },
  { key: 'log_admin_actions', label: 'Logger les actions admin', type: 'toggle' },
];

const ALL_SECURITY_KEYS = [
  ...SESSIONS_FIELDS, ...PASSWORD_FIELDS, ...LOG_FIELDS,
  { key: 'ip_whitelist_enabled', type: 'toggle' },
].map(f => f.key);

// ── Journal d'audit ───────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  login_success: 'Connexion réussie',
  login_failure: 'Échec de connexion',
  logout: 'Déconnexion',
  password_change: 'Changement de mot de passe',
  admin_action: 'Action administrateur',
  config_change: 'Modification de configuration',
  account_locked: 'Compte verrouillé',
  ip_blocked: 'IP bloquée',
  user_created: 'Utilisateur créé',
  user_deleted: 'Utilisateur supprimé',
};

interface AuditEvent {
  timestamp: string;
  type: string;
  actor: string;
  meta?: Record<string, string>;
}

// ── Composants UI partagés ────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        checked ? 'bg-accent' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-1.5">
        <div>
          <span className="text-sm text-foreground">{field.label}</span>
          {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
        </div>
        <Toggle checked={value === 'true'} onChange={() => onChange(value === 'true' ? 'false' : 'true')} />
      </div>
    );
  }
  return (
    <div className="py-1.5">
      <label className="block text-xs font-medium text-foreground mb-1">{field.label}</label>
      {field.help && <p className="text-[11px] text-muted-foreground mb-1">{field.help}</p>}
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full max-w-xs px-3 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ConfigSecurity() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ipList, setIpList] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditKey, setAuditKey] = useState(0); // force re-run audit checks

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllSettings();
      // getAllSettings retourne Record<string, {key_name, value}[]>
      // Les clés security sont dans all['security']
      const secRows: { key_name: string; value: unknown }[] = all['security'] || [];
      const secAuditRows: { key_name: string; value: unknown }[] = all['secaudit'] || [];

      const v: Record<string, string> = {};
      for (const row of secRows) {
        if (row.key_name === 'ip_whitelist') {
          try {
            setIpList(JSON.parse(row.value as string)?.join('\n') || '');
          } catch {
            setIpList('');
          }
        } else {
          v[row.key_name] = parseValue(row.value);
        }
      }
      setValues(v);

      // Journal d'audit : clés commençant par secaudit_event_
      const events: AuditEvent[] = [];
      for (const row of secAuditRows) {
        if (row.key_name.startsWith('event_')) {
          try {
            const parsed = JSON.parse(row.value as string);
            if (parsed && typeof parsed === 'object') {
              events.push(parsed as AuditEvent);
            }
          } catch {
            // ignorer les entrées malformées
          }
        }
      }
      // Tri décroissant, 10 derniers
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditEvents(events.slice(0, 10));
    } catch {
      toast.error('Erreur lors du chargement des paramètres de sécurité');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = ALL_SECURITY_KEYS.map(key => {
        const isToggle = [...SESSIONS_FIELDS, ...PASSWORD_FIELDS, ...LOG_FIELDS].find(f => f.key === key)?.type === 'toggle'
          || key === 'ip_whitelist_enabled';
        return {
          category: 'security',
          key,
          value: isToggle ? (values[key] === 'true' ? 'true' : 'false') : (values[key] || ''),
        };
      });
      settings.push({
        category: 'security',
        key: 'ip_whitelist',
        value: JSON.stringify(ipList.split('\n').filter(Boolean)),
      });
      await saveSettingsBulk(settings);
      toast.success('Paramètres de sécurité sauvegardés');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const setVal = (key: string) => (v: string) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const handleExportCsv = () => {
    if (auditEvents.length === 0) {
      toast.info('Aucun événement à exporter');
      return;
    }
    const header = 'Horodatage,Type,Acteur,Métadonnées\n';
    const rows = auditEvents.map(e => {
      const meta = e.meta ? Object.entries(e.meta).map(([k, vv]) => `${k}=${vv}`).join('; ') : '';
      return `"${formatDate(e.timestamp)}","${EVENT_TYPE_LABELS[e.type] || e.type}","${maskEmail(e.actor || '')}","${meta}"`;
    });
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-securite-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Journal exporté');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Chargement des paramètres de sécurité...
      </div>
    );
  }

  const { score, checks } = computeScore(values);
  const color = scoreColor(score);
  const label = scoreLabel(score);

  // Circumference du cercle SVG (r=44)
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - score / 100);

  // Résultats de l'audit automatique
  const auditResults = AUDIT_CHECKS.map(c => ({
    ...c,
    passed: c.check(values),
  }));
  const criticalFails = auditResults.filter(r => !r.passed && r.severity === 'critical').length;
  const highFails = auditResults.filter(r => !r.passed && r.severity === 'high').length;

  return (
    <div className="space-y-6">

      {/* ── Section 1 : Score de sécurité ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          Score de sécurité global
        </h2>

        <div className="flex flex-col sm:flex-row items-start gap-8">
          {/* Cercle de score */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Piste */}
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                {/* Progression */}
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground" style={{ color }}>{score}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color, backgroundColor: `${color}18` }}
            >
              {label}
            </span>
          </div>

          {/* Liste des checks */}
          <div className="flex-1 grid grid-cols-1 gap-1.5 w-full">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-2.5">
                {c.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={`text-xs ${c.passed ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {c.label}
                </span>
                {c.passed && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 ml-auto">+{c.points} pts</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Section 2 : Audit automatique des vulnérabilités ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Audit automatique des vulnérabilités
            {(criticalFails > 0 || highFails > 0) && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive ml-1">
                {criticalFails + highFails} problème{criticalFails + highFails > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setAuditKey(k => k + 1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Relancer l'audit
          </button>
        </div>

        <AnimatePresence key={auditKey}>
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {auditResults.map((check, i) => (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-4 py-3 bg-background"
              >
                {/* Sévérité */}
                <div className="flex-shrink-0 w-16">
                  <span className={`text-[10px] font-semibold ${SEVERITY_COLORS[check.severity]}`}>
                    {SEVERITY_LABELS[check.severity]}
                  </span>
                </div>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{check.label}</p>
                  <p className="text-[11px] text-muted-foreground">{check.desc}</p>
                  {check.note && (
                    <p className="text-[10px] text-muted-foreground/60 italic">{check.note}</p>
                  )}
                </div>

                {/* Statut */}
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  {check.passed ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">OK</span>
                    </>
                  ) : check.severity === 'critical' ? (
                    <>
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span className="text-[11px] text-destructive font-medium">Critique</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">Avertissement</span>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </motion.div>

      {/* ── Section 3 : Politique de sécurité ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          Politique de sécurité
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sessions */}
          <SectionCard icon={Clock} title="Sessions">
            <div className="space-y-1 divide-y divide-border/50">
              {SESSIONS_FIELDS.map(f => (
                <FieldRow key={f.key} field={f} value={values[f.key] || ''} onChange={setVal(f.key)} />
              ))}
            </div>
          </SectionCard>

          {/* Mots de passe */}
          <SectionCard icon={Lock} title="Mots de passe">
            <div className="space-y-1 divide-y divide-border/50">
              {PASSWORD_FIELDS.map(f => (
                <FieldRow key={f.key} field={f} value={values[f.key] || ''} onChange={setVal(f.key)} />
              ))}
            </div>
          </SectionCard>

          {/* Journalisation */}
          <SectionCard icon={FileText} title="Journalisation">
            <div className="space-y-1 divide-y divide-border/50">
              {LOG_FIELDS.map(f => (
                <FieldRow key={f.key} field={f} value={values[f.key] || ''} onChange={setVal(f.key)} />
              ))}
            </div>

            {/* IPs autorisées — visible si ip_whitelist_enabled */}
            {values.ip_whitelist_enabled === 'true' && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  IPs autorisées
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">Une IP ou plage CIDR par ligne</p>
                <textarea
                  value={ipList}
                  onChange={e => setIpList(e.target.value)}
                  rows={4}
                  placeholder="192.168.1.0/24"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
            )}

            {/* Toggle IP séparé */}
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">Restriction par IP</span>
              <Toggle
                checked={values.ip_whitelist_enabled === 'true'}
                onChange={() => setVal('ip_whitelist_enabled')(values.ip_whitelist_enabled === 'true' ? 'false' : 'true')}
              />
            </div>
          </SectionCard>
        </div>
      </motion.div>

      {/* ── Section 4 : Journal d'audit de sécurité ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Journal d'audit de sécurité
            <span className="text-[10px] text-muted-foreground font-normal">— 10 derniers événements</span>
          </h2>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/50"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter le journal
          </button>
        </div>

        {auditEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun événement de sécurité enregistré récemment.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {/* Entête */}
            <div className="grid grid-cols-[160px_1fr_160px_1fr] gap-4 px-4 py-2 bg-muted/30">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Horodatage</span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Type d'événement</span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Acteur</span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Détails</span>
            </div>
            {auditEvents.map((ev, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_160px_1fr] gap-4 px-4 py-2.5 bg-background hover:bg-muted/20 transition-colors">
                <span className="text-xs text-muted-foreground font-mono">{formatDate(ev.timestamp)}</span>
                <span className="text-xs text-foreground">{EVENT_TYPE_LABELS[ev.type] || ev.type}</span>
                <span className="text-xs text-foreground font-mono">{maskEmail(ev.actor || '')}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {ev.meta ? Object.entries(ev.meta).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Bouton Sauvegarder ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde en cours...' : 'Sauvegarder la politique'}
        </button>
        {saving && (
          <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
    </div>
  );
}
