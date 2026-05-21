import { type Sunday } from '@/lib/api';
import { supabaseAdmin as supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface EditState {
  sundayId: string;
  date: string;
  dirigeant_id: string;
  note: string;
  poles: Record<string, string[]>;
}

export interface PreviewAssignment {
  sundayId: string;
  date?: string;
  dirigeant_id: string;
  is_jeunesse?: boolean;
  poles: Record<string, string[]>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

export const POLE_KEYS = [
  'choriste','piano','batterie','guitare_elec','guitare_acou',
  'basse','sonorisation','projection','video',
] as const;

export type PoleKey = typeof POLE_KEYS[number];

export const POLE_LABEL: Record<string, string> = {
  choriste: 'Choristes', piano: 'Piano', batterie: 'Batterie',
  guitare_elec: 'Guitare élec.', guitare_acou: 'Guitare acou.',
  basse: 'Basse', sonorisation: 'Sonorisation', projection: 'Projection', video: 'Vidéo',
};

// Rôles requis pour apparaître dans chaque pôle
export const POLE_ROLES: Record<string, string[]> = {
  choriste:     ['choriste'],
  piano:        ['pianiste'],
  batterie:     ['batteur'],
  guitare_elec: ['guitariste_electrique'],
  guitare_acou: ['guitariste_acoustique'],
  basse:        ['bassiste'],
  sonorisation: ['sonorisateur'],
  projection:   ['projectionniste'],
  video:        ['videaste'],
};

export const KANBAN_ROWS: { key: string; label: string; emoji: string; roles: string[] }[] = [
  { key: 'dirigeant',    label: 'Dirigeant',     emoji: '🎤', roles: ['dirigeant','conducteur_louange','responsable_louange','pasteur'] },
  { key: 'choriste',     label: 'Choristes',     emoji: '🎵', roles: ['choriste'] },
  { key: 'piano',        label: 'Piano',         emoji: '🎹', roles: ['pianiste'] },
  { key: 'batterie',     label: 'Batterie',      emoji: '🥁', roles: ['batteur'] },
  { key: 'guitare_elec', label: 'Guitare élec.', emoji: '🎸', roles: ['guitariste_electrique'] },
  { key: 'guitare_acou', label: 'Guitare acou.', emoji: '🎼', roles: ['guitariste_acoustique'] },
  { key: 'basse',        label: 'Basse',         emoji: '🎵', roles: ['bassiste'] },
  { key: 'sonorisation', label: 'Sonorisation',  emoji: '🔊', roles: ['sonorisateur'] },
  { key: 'projection',   label: 'Projection',    emoji: '📽️', roles: ['projectionniste'] },
  { key: 'video',        label: 'Vidéo',         emoji: '🎥', roles: ['videaste'] },
];

export const ROW_CHIP_COLOR: Record<string, string> = {
  dirigeant:    'bg-emerald-600 text-white dark:bg-emerald-700/80 dark:text-emerald-100',
  choriste:     'bg-blue-600 text-white dark:bg-blue-700/80 dark:text-blue-100',
  piano:        'bg-orange-500 text-white dark:bg-orange-600/80 dark:text-orange-100',
  batterie:     'bg-orange-500 text-white dark:bg-orange-600/80 dark:text-orange-100',
  guitare_elec: 'bg-amber-500 text-white dark:bg-amber-600/80 dark:text-amber-100',
  guitare_acou: 'bg-amber-500 text-white dark:bg-amber-600/80 dark:text-amber-100',
  basse:        'bg-orange-500 text-white dark:bg-orange-600/80 dark:text-orange-100',
  sonorisation: 'bg-violet-600 text-white dark:bg-violet-700/80 dark:text-violet-100',
  projection:   'bg-violet-600 text-white dark:bg-violet-700/80 dark:text-violet-100',
  video:        'bg-violet-600 text-white dark:bg-violet-700/80 dark:text-violet-100',
};

// ── Utils ─────────────────────────────────────────────────────────────────────

export function buildEditState(s: Sunday): EditState {
  const poles: Record<string, string[]> = {};
  POLE_KEYS.forEach((k: PoleKey) => {
    // String() obligatoire : MySQL renvoie des entiers, les IDs membres sont des strings
    poles[k] = (s.assignments?.[k] ?? []).map(p => String(p.user_id));
  });
  const rawDir = s.dirigeant_id;
  return {
    sundayId: s.id,
    date: s.date,
    dirigeant_id: rawDir != null ? String(rawDir) : '',
    note: s.note ?? '',
    poles,
  };
}

export function fmtDate(d: string) {
  const x = new Date(d);
  return x.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateLong(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function isPast(d: string) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return x < t;
}

export function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

export async function lockSunday(sundayId: string, locked: boolean): Promise<void> {
  const { error } = await supabase
    .from('sundays')
    .update({ is_locked: locked })
    .eq('id', Number(sundayId));
  if (error) throw new Error(error.message);
}
