// ── Youth director helpers ─────────────────────────────────────────────────────

export const YOUTH_DIRECTORS_KEY = 'aef_youth_directors';
export const DEFAULT_YOUTH_DIRECTORS = [
  'Laura Alcime', 'Eilyne Massillon', 'Ismaelle Dorcius',
  'Ismaël Panier', 'Sméralda Gelin', 'Kétia Nicolas',
];

export function loadYouthDirectors(): Set<string> {
  try {
    const stored = localStorage.getItem(YOUTH_DIRECTORS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set(DEFAULT_YOUTH_DIRECTORS);
}

export function saveYouthDirectors(names: Set<string>): void {
  localStorage.setItem(YOUTH_DIRECTORS_KEY, JSON.stringify([...names]));
}

// ── Experienced dirigeants (hors jeunesse) ────────────────────────────────────

export const EXPERIENCED_DIRS_KEY = 'aef_experienced_dirigeants';

export function loadExperiencedDirigents(): Set<string> {
  try {
    const stored = localStorage.getItem(EXPERIENCED_DIRS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export function saveExperiencedDirigents(names: Set<string>): void {
  localStorage.setItem(EXPERIENCED_DIRS_KEY, JSON.stringify([...names]));
}

// ── Experienced musicians (piano, batterie, guitares, basse) ──────────────────

export const EXPERIENCED_MUSICIANS_KEY = 'aef_experienced_musicians';

export function loadExperiencedMusicians(): Set<string> {
  try {
    const stored = localStorage.getItem(EXPERIENCED_MUSICIANS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export function saveExperiencedMusicians(names: Set<string>): void {
  localStorage.setItem(EXPERIENCED_MUSICIANS_KEY, JSON.stringify([...names]));
}

// ── Experienced members (choristes) ───────────────────────────────────────────

export const EXPERIENCED_KEY = 'aef_experienced_members';

export function loadExperienced(): Set<string> {
  try {
    const stored = localStorage.getItem(EXPERIENCED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

export function saveExperienced(names: Set<string>): void {
  localStorage.setItem(EXPERIENCED_KEY, JSON.stringify([...names]));
}
