/**
 * ── Bibliothèque de sécurité — AEF Admin ────────────────────────────────────
 * Détection de menaces, sanitisation des entrées, rate limiting, session guard.
 *
 * Niveau de protection : application frontend (défense en profondeur).
 * La sécurité primaire reste gérée par Supabase RLS + Auth côté serveur.
 */

// ── Patterns d'attaque connus ────────────────────────────────────────────────

const XSS_PATTERNS = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on\w+\s*=\s*["'`]/i,         // onclick=, onerror=, etc.
  /data\s*:\s*text\/html/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /\beval\s*\(/i,
  /\bdocument\s*\.\s*cookie/i,
  /\bwindow\s*\.\s*location/i,
];

const SQLI_PATTERNS = [
  /\bUNION\b[\s\S]*\bSELECT\b/i,
  /\bDROP\b[\s\S]*\bTABLE\b/i,
  /\bTRUNCATE\b[\s\S]*\bTABLE\b/i,
  /\bDELETE\b[\s\S]*\bFROM\b/i,
  /\bINSERT\b[\s\S]*\bINTO\b/i,
  /['";]\s*--/,                   // commentaire SQL
  /\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,  // OR 1=1
  /\bOR\b\s+\bTRUE\b/i,
  /\b1\s*=\s*1\b/,
];

const PATH_TRAVERSAL = [/\.\.[/\\]/, /%2e%2e[/\\%]/i];

const ALL_THREATS = [...XSS_PATTERNS, ...SQLI_PATTERNS, ...PATH_TRAVERSAL];

// ── Fonctions publiques ───────────────────────────────────────────────────────

/**
 * Détecte si une valeur contient un pattern malveillant.
 * Retourne le type de menace détecté ou null.
 */
export function detectThreat(value: string): 'xss' | 'sqli' | 'traversal' | null {
  if (!value) return null;
  if (XSS_PATTERNS.some(p => p.test(value))) return 'xss';
  if (SQLI_PATTERNS.some(p => p.test(value))) return 'sqli';
  if (PATH_TRAVERSAL.some(p => p.test(value))) return 'traversal';
  return null;
}

/**
 * Valide un ensemble de champs de formulaire.
 * Retourne la première erreur trouvée ou null.
 */
export function validateFormSecurity(fields: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    const threat = detectThreat(value);
    if (threat === 'xss') return `Caractères non autorisés détectés dans le champ "${key}".`;
    if (threat === 'sqli') return `Syntaxe non autorisée détectée dans le champ "${key}".`;
    if (threat === 'traversal') return `Chemin non autorisé détecté dans le champ "${key}".`;
  }
  return null;
}

/**
 * Échappe les caractères HTML dangereux (protection XSS en affichage).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Nettoie un champ texte : trim + supprime les caractères de contrôle.
 */
export function sanitizeText(value: string): string {
  return value
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // caractères de contrôle
}

/**
 * Validation email conforme RFC 5322 (simplifiée).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,10}$/.test(email);
}

/**
 * Validation mot de passe robuste.
 * Retourne null si valide, sinon la règle non respectée.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(password)) return 'Au moins une majuscule requise.';
  if (!/[a-z]/.test(password)) return 'Au moins une minuscule requise.';
  if (!/[0-9]/.test(password)) return 'Au moins un chiffre requis.';
  return null;
}

// ── Rate Limiting (stockage sessionStorage) ──────────────────────────────────

const RATE_LIMIT_KEY = 'aef_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface RateLimitState {
  count: number;
  lockUntil?: number;
  firstAttemptAt?: number;
}

export function getRateLimitState(): RateLimitState {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { count: 0 };
    const state: RateLimitState = JSON.parse(raw);
    // Lockout expiré → reset
    if (state.lockUntil && Date.now() > state.lockUntil) {
      sessionStorage.removeItem(RATE_LIMIT_KEY);
      return { count: 0 };
    }
    return state;
  } catch {
    return { count: 0 };
  }
}

export function recordFailedAttempt(): RateLimitState {
  const state = getRateLimitState();
  const count = (state.count || 0) + 1;
  const newState: RateLimitState = {
    count,
    firstAttemptAt: state.firstAttemptAt ?? Date.now(),
    lockUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : undefined,
  };
  try { sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState)); } catch { /* */ }
  return newState;
}

export function resetRateLimit(): void {
  try { sessionStorage.removeItem(RATE_LIMIT_KEY); } catch { /* */ }
}

export function isLockedOut(): boolean {
  const state = getRateLimitState();
  return !!(state.lockUntil && Date.now() < state.lockUntil);
}

export function getLockoutRemainingSeconds(): number {
  const state = getRateLimitState();
  if (!state.lockUntil) return 0;
  return Math.max(0, Math.ceil((state.lockUntil - Date.now()) / 1000));
}

export function getRemainingAttempts(): number {
  const state = getRateLimitState();
  return Math.max(0, MAX_ATTEMPTS - (state.count || 0));
}

// ── Session Activity Tracker ─────────────────────────────────────────────────

const LAST_ACTIVITY_KEY = 'aef_last_activity';
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 heures d'inactivité

export function touchActivity(): void {
  try { sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* */ }
}

export function isSessionExpired(): boolean {
  try {
    const last = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    if (!last) return false; // première visite
    return Date.now() - Number(last) > SESSION_TIMEOUT_MS;
  } catch {
    return false;
  }
}

export function clearActivity(): void {
  try {
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(RATE_LIMIT_KEY);
  } catch { /* */ }
}

// ── Génération de tokens sécurisés ───────────────────────────────────────────

const CHARSET_STRONG = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
const CHARSET_ALPHANUM = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateSecurePassword(length = 14): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, v => CHARSET_STRONG[v % CHARSET_STRONG.length]).join('');
}

export function generateToken(length = 32): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, v => CHARSET_ALPHANUM[v % CHARSET_ALPHANUM.length]).join('');
}

// ── Masquage des données sensibles ───────────────────────────────────────────

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const masked = user.length <= 2
    ? '*'.repeat(user.length)
    : `${user[0]}${'*'.repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}`;
  return `${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{2})/g, '*');
}
