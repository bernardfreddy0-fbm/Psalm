import { type Sunday, type AbsenceWithMember, getAbsentMemberIds } from '@/lib/api';
import {
  loadYouthDirectors,
  loadExperiencedDirigents,
  loadExperienced,
  loadExperiencedMusicians,
} from './planningStorage';
import { type MemberOption } from './planningTypes';

export function isSecondSunday(dateStr: string): boolean {
  const day = new Date(dateStr).getDate();
  return day >= 8 && day <= 14;
}

/** Fisher-Yates shuffle — retourne un nouveau tableau mélangé */
export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMonthAssignments(
  sundays: Sunday[],
  members: MemberOption[],
  absences: AbsenceWithMember[] = [],
  randomize = false,
) {
  const parseRoles = (role: string) => role.split(',').map(r => r.trim()).filter(Boolean);

  // Pools complets par rôle (rotation/repos calculés sur tous les membres)
  const cats = {
    dirigeants:       members.filter(m => parseRoles(m.role).some(r => ['dirigeant','conducteur_louange','responsable_louange','pasteur'].includes(r))),
    choristes:        members.filter(m => parseRoles(m.role).includes('choriste')),
    pianistes:        members.filter(m => parseRoles(m.role).includes('pianiste')),
    batteurs:         members.filter(m => parseRoles(m.role).includes('batteur')),
    guitaristesElec:  members.filter(m => parseRoles(m.role).includes('guitariste_electrique')),
    guitaristesAcou:  members.filter(m => parseRoles(m.role).includes('guitariste_acoustique')),
    bassistes:        members.filter(m => parseRoles(m.role).includes('bassiste')),
    sonorisateurs:    members.filter(m => parseRoles(m.role).includes('sonorisateur')),
    projectionnistes: members.filter(m => parseRoles(m.role).includes('projectionniste')),
    videastes:        members.filter(m => parseRoles(m.role).includes('videaste')),
  };

  const lastServed = new Map<string, number>();

  // Charger les sets expérimentés
  const expDirigentsSet = loadExperiencedDirigents();
  const expChorSet      = loadExperienced();
  const expMusiciansSet = loadExperiencedMusicians();

  function pickN(
    pool: MemberOption[],
    n: number,
    used: Set<string>,
    idx: number,
    rest: number,
    opts?: { randomize?: boolean; experiencedIds?: Set<string> }
  ): MemberOption[] {
    const { randomize: rand = false, experiencedIds } = opts ?? {};

    const eligible = pool
      .filter(m => !used.has(m.id))
      .filter(m => { const l = lastServed.get(m.id); return l === undefined || (idx - l) >= rest; });

    let avail: MemberOption[];
    if (rand) {
      // Mode aléatoire : mélange total, pas de hiérarchie expérimentés/autres
      avail = shuffled(eligible);
    } else if (experiencedIds && experiencedIds.size > 0) {
      // Mode déterministe : expérimentés en priorité, triés par lastServed
      const exp    = eligible.filter(m => experiencedIds.has(`${m.first_name} ${m.last_name}`));
      const nonExp = eligible.filter(m => !experiencedIds.has(`${m.first_name} ${m.last_name}`));
      avail = [
        ...exp.sort((a, b) => (lastServed.get(a.id) ?? -999) - (lastServed.get(b.id) ?? -999)),
        ...nonExp.sort((a, b) => (lastServed.get(a.id) ?? -999) - (lastServed.get(b.id) ?? -999)),
      ];
    } else {
      avail = eligible.sort((a, b) => (lastServed.get(a.id) ?? -999) - (lastServed.get(b.id) ?? -999));
    }

    let sel = avail.slice(0, n);

    // Fallback si pas assez d'éligibles (ignore repos)
    if (sel.length < n) {
      const rem = pool
        .filter(m => !used.has(m.id) && !sel.find(s => s.id === m.id))
        .sort((a, b) => (lastServed.get(a.id) ?? -999) - (lastServed.get(b.id) ?? -999));
      sel = [...sel, ...rem.slice(0, n - sel.length)];
    }
    return sel;
  }

  return sundays.map((sunday, idx) => {
    const used = new Set<string>();
    const mark = (m: MemberOption) => { used.add(m.id); lastServed.set(m.id, idx); };

    // IDs des membres absents CE dimanche — exclus de toute sélection
    const absentIds = getAbsentMemberIds(absences, sunday.date);
    const avail = (pool: MemberOption[]) => pool.filter(m => !absentIds.has(m.id));

    // 1. Dirigeant — repos 8 semaines, règles jeunesse
    const youthSet = loadYouthDirectors();
    const isJeunesse = isSecondSunday(sunday.date);
    let dirigeantPool = avail(cats.dirigeants);
    if (isJeunesse) {
      const youthPool = dirigeantPool.filter(m => youthSet.has(`${m.first_name} ${m.last_name}`));
      if (youthPool.length > 0) dirigeantPool = youthPool;
    } else {
      const nonYouthPool = dirigeantPool.filter(m => !youthSet.has(`${m.first_name} ${m.last_name}`));
      if (nonYouthPool.length > 0) dirigeantPool = nonYouthPool;
    }
    const [dir] = pickN(dirigeantPool, 1, used, idx, 8,
      isJeunesse ? { randomize } : { randomize, experiencedIds: expDirigentsSet }
    );
    if (dir) mark(dir);

    // 2. Choristes — 6 max, repos 1 semaine
    const chors = pickN(avail(cats.choristes), 6, used, idx, 1, { randomize, experiencedIds: expChorSet });
    chors.forEach(mark);

    // 3. Piano
    const [piano] = pickN(avail(cats.pianistes), 1, used, idx, 1, { randomize, experiencedIds: expMusiciansSet });
    if (piano) mark(piano);

    // 4. Batterie
    const [batt] = pickN(avail(cats.batteurs), 1, used, idx, 1, { randomize, experiencedIds: expMusiciansSet });
    if (batt) mark(batt);

    // 5. Guitare — alternance élec/acou
    const useElec = idx % 2 === 0;
    const gPool = useElec
      ? (avail(cats.guitaristesElec).length > 0 ? avail(cats.guitaristesElec) : avail(cats.guitaristesAcou))
      : (avail(cats.guitaristesAcou).length > 0 ? avail(cats.guitaristesAcou) : avail(cats.guitaristesElec));
    const [guitare] = pickN(gPool, 1, used, idx, 1, { randomize, experiencedIds: expMusiciansSet });
    if (guitare) mark(guitare);

    // 6. Basse
    const [basse] = pickN(avail(cats.bassistes), 1, used, idx, 1, { randomize, experiencedIds: expMusiciansSet });
    if (basse) mark(basse);

    // 7. Sonorisation — 2 personnes
    const sonos = pickN(avail(cats.sonorisateurs), 2, used, idx, 1, { randomize });
    sonos.forEach(mark);

    // 8. Projection
    const [proj] = pickN(avail(cats.projectionnistes), 1, used, idx, 1, { randomize });
    if (proj) mark(proj);

    // 9. Vidéo — 2 personnes
    const vids = pickN(avail(cats.videastes), 2, used, idx, 1, { randomize });
    vids.forEach(mark);

    return {
      sundayId: sunday.id,
      is_jeunesse: isJeunesse,
      dirigeant_id: dir?.id ?? '',
      poles: {
        choriste:     chors.map(m => m.id),
        piano:        piano ? [piano.id] : [],
        batterie:     batt ? [batt.id] : [],
        guitare_elec: useElec && guitare ? [guitare.id] : [],
        guitare_acou: !useElec && guitare ? [guitare.id] : [],
        basse:        basse ? [basse.id] : [],
        sonorisation: sonos.map(m => m.id),
        projection:   proj ? [proj.id] : [],
        video:        vids.map(m => m.id),
      },
    };
  });
}
