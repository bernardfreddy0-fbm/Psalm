# Planning Save · Rôles · Sidebar · UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la sauvegarde du planning (save + régénération), remplacer le rôle générique `musicien` par 5 rôles instrumentaux, enrichir la sidebar et appliquer 5 corrections UX rapides.

**Architecture:** 4 zones indépendantes. Zone 1 : migration DB + fix backend PHP + fix api.ts. Zone 2 : rôles instrumentaux dans 4 fichiers frontend. Zone 3 : AppLayout sidebar/header. Zone 4 : UX rapides dans AppLayout. Un seul build + déploiement à la fin.

**Tech Stack:** MySQL (o2switch SSH), PHP 8, React 18, TypeScript, Vite, Sonner, Tailwind CSS

---

### Task 1 : Migration DB + sundays.php backend

**Files:**
- Modify: `sundays.php` sur serveur `yellow.o2switch.net`

- [ ] **Step 1 : Vérifier l'état actuel de la table**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "SHOW COLUMNS FROM aef_sundays;" 2>/dev/null'
```

Expected : les colonnes `choristes`, `piano`, `batterie`, `guitare_elec`, `guitare_acou`, `basse`, `son`, `projection`, `video`, `evenement`, `theme`, `dirigeant` (VARCHAR) sont **absentes**.

- [ ] **Step 2 : Exécuter la migration ALTER TABLE**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm 2>/dev/null <<'"'"'SQL'"'"'
ALTER TABLE aef_sundays
  ADD COLUMN dirigeant      VARCHAR(200)  NULL AFTER dirigeant_id,
  ADD COLUMN choristes      TEXT          NULL,
  ADD COLUMN piano          VARCHAR(200)  NULL,
  ADD COLUMN batterie       VARCHAR(200)  NULL,
  ADD COLUMN guitare_elec   VARCHAR(200)  NULL,
  ADD COLUMN guitare_acou   VARCHAR(200)  NULL,
  ADD COLUMN basse          VARCHAR(200)  NULL,
  ADD COLUMN son            TEXT          NULL,
  ADD COLUMN projection     VARCHAR(200)  NULL,
  ADD COLUMN video          TEXT          NULL,
  ADD COLUMN evenement      VARCHAR(200)  NULL,
  ADD COLUMN theme          VARCHAR(200)  NULL;
SQL'
```

Expected : aucune sortie (succès silencieux de MySQL).

- [ ] **Step 3 : Vérifier les colonnes ajoutées**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "SHOW COLUMNS FROM aef_sundays;" 2>/dev/null'
```

Expected : la table contient maintenant `dirigeant`, `choristes`, `piano`, `batterie`, `guitare_elec`, `guitare_acou`, `basse`, `son`, `projection`, `video`, `evenement`, `theme`.

- [ ] **Step 4 : Patcher sundays.php — élargir la whitelist du case update**

La ligne actuelle dans `sundays.php` (vers ligne 75) :
```
        foreach (['date', 'label', 'theme', 'dirigeant', 'is_locked'] as $field) {
```

Utiliser Python via SSH pour la remplacer proprement :

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net 'python3 - <<'"'"'PYEOF'"'"'
import re

with open("/home/bqzk4896/api-psalm.a-e-f.fr/sundays.php", "r") as f:
    content = f.read()

old = "        foreach (['\''date'\'', '\''label'\'', '\''theme'\'', '\''dirigeant'\'', '\''is_locked'\''] as \$field) {"
new = """        \$allowed = [
            '\''date'\'', '\''label'\'', '\''theme'\'', '\''dirigeant'\'', '\''dirigeant_id'\'',
            '\''is_jeunesse'\'', '\''is_locked'\'', '\''note'\'',
            '\''choristes'\'', '\''piano'\'', '\''batterie'\'', '\''guitare_elec'\'', '\''guitare_acou'\'',
            '\''basse'\'', '\''son'\'', '\''projection'\'', '\''video'\'', '\''evenement'\''
        ];
        foreach (\$allowed as \$field) {"""

if old in content:
    content = content.replace(old, new)
    with open("/home/bqzk4896/api-psalm.a-e-f.fr/sundays.php", "w") as f:
        f.write(content)
    print("OK: patched")
else:
    print("ERROR: pattern not found")
PYEOF'
```

Expected : `OK: patched`

- [ ] **Step 5 : Vérifier le patch PHP**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'grep -A 8 "allowed = \[" ~/api-psalm.a-e-f.fr/sundays.php'
```

Expected : doit afficher le nouvel array `$allowed` avec tous les champs.

- [ ] **Step 6 : Tester le save via POST**

```bash
curl -s -X POST "https://api-psalm.a-e-f.fr/sundays.php?action=update" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test" \
  -d '{"id": "1", "dirigeant": "TestDirigent", "choristes": "Alice,Bob", "piano": "Charlie"}' 2>&1
```

Expected : `{"success":true}`

- [ ] **Step 7 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add docs/superpowers/plans/2026-04-01-planning-roles-sidebar-ux.md
git commit -m "feat: migrate aef_sundays columns + patch sundays.php update whitelist"
```

---

### Task 2 : api.ts — updateSunday → POST JSON

**Files:**
- Modify: `src/lib/api.ts` (ligne 130–133)

- [ ] **Step 1 : Remplacer updateSunday par la version POST**

Dans `src/lib/api.ts`, remplacer :

```typescript
export const updateSunday = (id: string, data: Record<string, string>) => {
  const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api(`sundays.php?action=update&id=${id}&${params}`);
};
```

Par :

```typescript
export const updateSunday = async (id: string, data: Record<string, string>) => {
  const res = await fetch(`${API_BASE}/sundays.php?action=update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': getToken(),
    },
    body: JSON.stringify({ id, ...data }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || json.message || 'Erreur mise à jour');
  return json;
};
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/lib/api.ts
git commit -m "fix: updateSunday uses POST JSON body instead of GET querystring"
```

---

### Task 3 : PlanningPage.tsx — EditForm + openEdit + handleUpdate + membersByRole

**Files:**
- Modify: `src/pages/PlanningPage.tsx`

- [ ] **Step 1 : Ajouter `evenement` à l'interface EditForm**

Remplacer :

```typescript
interface EditForm {
  id: string;
  date: string;
  label: string;
  dirigeant: string;
  choristes: string[];
  is_jeunesse: boolean;
  note: string;
  piano: string;
  batterie: string;
  guitare_elec: string;
  guitare_acou: string;
  basse: string;
  son: string;
  projection: string;
  video: string;
}
```

Par :

```typescript
interface EditForm {
  id: string;
  date: string;
  label: string;
  dirigeant: string;
  choristes: string[];
  is_jeunesse: boolean;
  note: string;
  piano: string;
  batterie: string;
  guitare_elec: string;
  guitare_acou: string;
  basse: string;
  son: string;
  projection: string;
  video: string;
  evenement: string;
}
```

- [ ] **Step 2 : Ajouter `evenement` dans openEdit**

Remplacer dans `openEdit` :

```typescript
  const openEdit = (s: any) => {
    setEditing({
      id: s.id,
      date: s.date,
      label: s.label || 'Culte',
      dirigeant: s.dirigeant || '',
      choristes: parseChoristes(s.choristes),
      is_jeunesse: !!s.is_jeunesse,
      note: s.note || '',
      piano: s.piano || '',
      batterie: s.batterie || '',
      guitare_elec: s.guitare_elec || '',
      guitare_acou: s.guitare_acou || '',
      basse: s.basse || '',
      son: s.son || '',
      projection: s.projection || '',
      video: s.video || '',
    });
  };
```

Par :

```typescript
  const openEdit = (s: any) => {
    setEditing({
      id: s.id,
      date: s.date,
      label: s.label || 'Culte',
      dirigeant: s.dirigeant || '',
      choristes: parseChoristes(s.choristes),
      is_jeunesse: !!s.is_jeunesse,
      note: s.note || '',
      piano: s.piano || '',
      batterie: s.batterie || '',
      guitare_elec: s.guitare_elec || '',
      guitare_acou: s.guitare_acou || '',
      basse: s.basse || '',
      son: s.son || '',
      projection: s.projection || '',
      video: s.video || '',
      evenement: s.evenement || '',
    });
  };
```

- [ ] **Step 3 : Ajouter `evenement` dans handleUpdate**

Remplacer dans `handleUpdate` :

```typescript
      const data: Record<string, string> = {
        label: editing.label,
        dirigeant: editing.dirigeant,
        choristes: editing.choristes.join(','),
        is_jeunesse: editing.is_jeunesse ? '1' : '0',
        note: editing.note,
        piano: editing.piano,
        batterie: editing.batterie,
        guitare_elec: editing.guitare_elec,
        guitare_acou: editing.guitare_acou,
        basse: editing.basse,
        son: editing.son,
        projection: editing.projection,
        video: editing.video,
      };
```

Par :

```typescript
      const data: Record<string, string> = {
        label: editing.label,
        dirigeant: editing.dirigeant,
        choristes: editing.choristes.join(','),
        is_jeunesse: editing.is_jeunesse ? '1' : '0',
        note: editing.note,
        piano: editing.piano,
        batterie: editing.batterie,
        guitare_elec: editing.guitare_elec,
        guitare_acou: editing.guitare_acou,
        basse: editing.basse,
        son: editing.son,
        projection: editing.projection,
        video: editing.video,
        evenement: editing.evenement || '',
      };
```

- [ ] **Step 4 : Mettre à jour membersByRole pour filtrer par rôle**

Dans `membersByRole` (useMemo, vers ligne 112), remplacer le bloc entier de calcul des listes (de `const allMembers` jusqu'à la fin du `return { ... }`) :

```typescript
    const allMembers = members.map((m: any) => ({
      ...m,
      parsedRoles: parseRoles(m.role),
      instruments: getInstruments(m),
    }));

    return {
      all: allMembers.map(toOption),
      dirigeants: allMembers.filter(m =>
        m.parsedRoles.includes('dirigeant') ||
        m.parsedRoles.includes('conducteur_louange') ||
        m.parsedRoles.includes('responsable_louange')
      ).map(toOption),
      choristes: allMembers.filter(m => m.parsedRoles.includes('choriste')).map(toOption),
      piano: allMembers.filter(m => m.parsedRoles.includes('pianiste')).map(toOption),
      batterie: allMembers.filter(m => m.parsedRoles.includes('batteur')).map(toOption),
      guitare_elec: allMembers.filter(m => m.parsedRoles.includes('guitariste_electrique')).map(toOption),
      guitare_acou: allMembers.filter(m => m.parsedRoles.includes('guitariste_acoustique')).map(toOption),
      basse: allMembers.filter(m => m.parsedRoles.includes('bassiste')).map(toOption),
      son: allMembers.filter(m => m.parsedRoles.includes('sonorisateur')).map(toOption),
      projection: allMembers.filter(m => m.parsedRoles.includes('projectionniste')).map(toOption),
      video: allMembers.filter(m => m.parsedRoles.includes('videaste')).map(toOption),
    };
```

Note : la fonction `getInstruments` et le `MEMBER_REGISTRY` import peuvent rester — ils ne sont plus utilisés dans membersByRole mais peuvent l'être ailleurs. Ne pas les supprimer.

- [ ] **Step 5 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur liée à `EditForm` ou `membersByRole`.

- [ ] **Step 6 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/PlanningPage.tsx
git commit -m "fix: PlanningPage adds evenement field, membersByRole uses instrument roles"
```

---

### Task 4 : planningGenerator.ts — categorisation par rôle

**Files:**
- Modify: `src/lib/planningGenerator.ts` (fonction `categorizeMembers` + logique guitare, vers lignes 143–156 et 262–274)

- [ ] **Step 1 : Remplacer categorizeMembers**

Remplacer la fonction `categorizeMembers` (lignes 143–156) :

```typescript
function categorizeMembers(members: MemberForPlanning[]) {
  return {
    dirigeants: members.filter(m => m.roles.includes('dirigeant') || m.roles.includes('conducteur_louange') || m.roles.includes('responsable_louange')),
    choristesExperimentes: members.filter(m => m.experienced && m.roles.includes('choriste')),
    choristes: members.filter(m => m.roles.includes('choriste')),
    pianistes: members.filter(m => m.roles.includes('pianiste')),
    batteurs: members.filter(m => m.roles.includes('batteur')),
    guitaristesElec: members.filter(m => m.roles.includes('guitariste_electrique')),
    guitaristesAcou: members.filter(m => m.roles.includes('guitariste_acoustique')),
    guitaristes: members.filter(m =>
      m.roles.includes('guitariste_electrique') || m.roles.includes('guitariste_acoustique')
    ),
    bassistes: members.filter(m => m.roles.includes('bassiste')),
    sonorisateurs: members.filter(m => m.roles.includes('sonorisateur')),
    projectionnistes: members.filter(m => m.roles.includes('projectionniste')),
    videastes: members.filter(m => m.roles.includes('videaste')),
  };
}
```

- [ ] **Step 2 : Mettre à jour la section Musiciens dans generatePlanning**

Remplacer le commentaire `// 4. Musiciens` et le bloc correspondant (lignes ~261–274) :

```typescript
    // 4. Musiciens (1-week rest)
    const [piano] = pickMembers(cats.pianistes, 1, usedThisSunday, usedTracker, weekIdx, 1);
    if (piano) { usedThisSunday.add(fullName(piano)); usedTracker.set(fullName(piano), weekIdx); }

    const [batterie] = pickMembers(cats.batteurs, 1, usedThisSunday, usedTracker, weekIdx, 1);
    if (batterie) { usedThisSunday.add(fullName(batterie)); usedTracker.set(fullName(batterie), weekIdx); }

    // Alternate guitar: even weeks = electric, odd weeks = acoustic
    const useElectric = weekIdx % 2 === 0;
    const elecPool = cats.guitaristesElec.length > 0 ? cats.guitaristesElec : cats.guitaristes;
    const acouPool = cats.guitaristesAcou.length > 0 ? cats.guitaristesAcou : cats.guitaristes;
    const [guitare] = pickMembers(useElectric ? elecPool : acouPool, 1, usedThisSunday, usedTracker, weekIdx, 1);
    if (guitare) { usedThisSunday.add(fullName(guitare)); usedTracker.set(fullName(guitare), weekIdx); }

    const [basse] = pickMembers(cats.bassistes, 1, usedThisSunday, usedTracker, weekIdx, 1);
    if (basse) { usedThisSunday.add(fullName(basse)); usedTracker.set(fullName(basse), weekIdx); }
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/lib/planningGenerator.ts
git commit -m "feat: planningGenerator uses instrument roles (pianiste/batteur/guitariste/bassiste)"
```

---

### Task 5 : ComptesPage.tsx — ROLES + ROLE_COLORS

**Files:**
- Modify: `src/pages/ComptesPage.tsx` (lignes 7–31)

- [ ] **Step 1 : Remplacer le tableau ROLES**

Remplacer :

```typescript
const ROLES = [
  'conducteur_louange', 'responsable_technique',
  'pasteur', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste', 'dev'
];
```

Par :

```typescript
const ROLES = [
  'conducteur_louange', 'responsable_technique',
  'pasteur', 'choriste',
  'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste',
  'sonorisateur', 'projectionniste', 'videaste', 'dev'
];
```

- [ ] **Step 2 : Ajouter les couleurs des nouveaux rôles dans ROLE_COLORS**

Remplacer :

```typescript
const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-destructive/10 text-destructive',
  responsable_louange: 'bg-accent/10 text-accent',
  conducteur_louange: 'bg-accent/10 text-accent',
  dev: 'bg-foreground/10 text-foreground',
  choriste: 'bg-success/10 text-success',
  musicien: 'bg-gold/10 text-gold',
  sonorisateur: 'bg-info/10 text-info',
  projectionniste: 'bg-warning/10 text-warning',
  videaste: 'bg-purple-500/10 text-purple-600',
  responsable_technique: 'bg-info/10 text-info',
};
```

Par :

```typescript
const ROLE_COLORS: Record<string, string> = {
  pasteur: 'bg-destructive/10 text-destructive',
  responsable_louange: 'bg-accent/10 text-accent',
  conducteur_louange: 'bg-accent/10 text-accent',
  dev: 'bg-foreground/10 text-foreground',
  choriste: 'bg-success/10 text-success',
  musicien: 'bg-gold/10 text-gold',
  pianiste: 'bg-gold/10 text-gold',
  batteur: 'bg-gold/10 text-gold',
  guitariste_electrique: 'bg-gold/10 text-gold',
  guitariste_acoustique: 'bg-gold/10 text-gold',
  bassiste: 'bg-gold/10 text-gold',
  sonorisateur: 'bg-info/10 text-info',
  projectionniste: 'bg-warning/10 text-warning',
  videaste: 'bg-purple-500/10 text-purple-600',
  responsable_technique: 'bg-info/10 text-info',
};
```

Note : `musicien` est conservé pour la rétro-compatibilité des membres existants.

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/ComptesPage.tsx
git commit -m "feat: replace musicien with 5 instrument roles in ComptesPage"
```

---

### Task 6 : MembresPage.tsx — ROLE_LABELS + POLE_ROLES

**Files:**
- Modify: `src/pages/MembresPage.tsx` (lignes 15–35)

- [ ] **Step 1 : Remplacer ROLE_LABELS**

Remplacer :

```typescript
const ROLE_LABELS: Record<string, string> = {
  dirigeant: 'Dirigeant',
  conducteur_louange: 'Dirigeant',
  choriste: 'Choriste',
  musicien: 'Musicien',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
  responsable_louange: 'Resp. Louange',
  responsable_technique: 'Resp. Technique',
  pasteur: 'Pasteur',
  dev: 'Dev',
};
```

Par :

```typescript
const ROLE_LABELS: Record<string, string> = {
  dirigeant: 'Dirigeant',
  conducteur_louange: 'Dirigeant',
  choriste: 'Choriste',
  musicien: 'Musicien',
  pianiste: 'Pianiste',
  batteur: 'Batteur',
  guitariste_electrique: 'Guit. élec.',
  guitariste_acoustique: 'Guit. acou.',
  bassiste: 'Bassiste',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
  responsable_louange: 'Resp. Louange',
  responsable_technique: 'Resp. Technique',
  pasteur: 'Pasteur',
  dev: 'Dev',
};
```

- [ ] **Step 2 : Remplacer POLE_ROLES**

Remplacer :

```typescript
const POLE_ROLES: Record<string, string[]> = {
  'Choriste & Dirigeant': ['choriste', 'dirigeant', 'conducteur_louange', 'responsable_louange'],
  'Musique': ['musicien'],
  'Sonorisation': ['sonorisateur', 'responsable_technique'],
  'Projection': ['projectionniste'],
  'Vidéo': ['videaste'],
};
```

Par :

```typescript
const POLE_ROLES: Record<string, string[]> = {
  'Choriste & Dirigeant': ['choriste', 'dirigeant', 'conducteur_louange', 'responsable_louange'],
  'Musique': ['musicien', 'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste'],
  'Sonorisation': ['sonorisateur', 'responsable_technique'],
  'Projection': ['projectionniste'],
  'Vidéo': ['videaste'],
};
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/MembresPage.tsx
git commit -m "feat: MembresPage supports 5 instrument roles in labels and pole filters"
```

---

### Task 7 : AppLayout.tsx — Sidebar · Header · UX

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1 : Ajouter l'import getSongs**

En haut du fichier, ajouter l'import après les imports existants de lucide-react et framer-motion :

```typescript
import { getSongs } from '@/lib/api';
```

- [ ] **Step 2 : Ajouter ROLE_DISPLAY et formatRole avant AppLayout**

Ajouter après la constante `pageTitles` (ligne ~61) :

```typescript
const ROLE_DISPLAY: Record<string, string> = {
  responsable_louange: 'Conducteur Louange',
  conducteur_louange: 'Conducteur Louange',
  responsable_technique: 'Resp. Technique',
  pasteur: 'Pasteur',
  choriste: 'Choriste',
  pianiste: 'Pianiste',
  batteur: 'Batteur',
  guitariste_electrique: 'Guitariste élec.',
  guitariste_acoustique: 'Guitariste acou.',
  bassiste: 'Bassiste',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
  dev: 'Développeur',
  musicien: 'Musicien',
};

function formatRole(role?: string): string {
  if (!role) return 'Membre';
  const firstRole = role.split(',')[0].trim();
  return ROLE_DISPLAY[firstRole] || firstRole.replace(/_/g, ' ');
}
```

- [ ] **Step 3 : Ajouter songCount state + useEffect dans AppLayout**

Dans le corps de `AppLayout()`, après `const location = ...` :

```typescript
  const [songCount, setSongCount] = useState<number | null>(null);
  useEffect(() => {
    getSongs().then(songs => setSongCount(songs.length)).catch(() => {});
  }, []);
```

- [ ] **Step 4 : Remplacer navSections — label Cultes + retirer sub**

Remplacer la constante `navSections` entière :

```typescript
const navSections = [
  {
    label: 'PRINCIPAL',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/programme', icon: FileText, label: 'Programme du culte' },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      { to: '/evenements', icon: CalendarRange, label: 'Événements' },
      { to: '/cultes', icon: Church, label: 'Planning Louange' },
    ],
  },
  {
    label: 'ÉQUIPES',
    items: [
      { to: '/membres', icon: Users, label: 'Membres' },
      { to: '/rotations', icon: Repeat, label: 'Rotations' },
    ],
  },
  {
    label: 'LOUANGE',
    items: [
      { to: '/chants', icon: Music, label: 'Bibliothèque' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { to: '/comptes', icon: UserCog, label: 'Comptes' },
      { to: '/permissions', icon: Key, label: 'Permissions' },
      { to: '/configuration', icon: Settings, label: 'Configuration' },
    ],
  },
];
```

- [ ] **Step 5 : Mettre à jour pageTitles — Cultes → Planning Louange**

Remplacer dans `pageTitles` :

```typescript
  '/cultes': 'Planning Louange',
```

(Remplacer l'ancienne ligne `'/cultes': 'Cultes',` ou `'/cultes': 'Planning Louange'` selon l'état actuel.)

- [ ] **Step 6 : Mettre à jour le rendu du badge chants (dynamique)**

Dans la section JSX du NavLink, remplacer la logique d'affichage du badge :

Trouver :
```tsx
                      {'badge' in item && item.badge && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
```

Remplacer par :

```tsx
                      {item.to === '/chants' && songCount !== null && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {songCount}
                        </span>
                      )}
```

- [ ] **Step 7 : Supprimer le rendu des sub-items**

Trouver et supprimer le bloc JSX qui affiche les sous-liens (il est conditionnel sur `isActive` et `item.sub`) :

```tsx
                    {'sub' in item && item.sub && isActive && (
                      <div className="ml-9 mt-0.5 space-y-0.5">
                        {item.sub.map(s => (
                          <p key={s} className="text-[12px] text-sidebar-foreground/50 py-1 cursor-pointer hover:text-sidebar-foreground/80">
                            · {s}
                          </p>
                        ))}
                      </div>
                    )}
```

Le supprimer entièrement.

- [ ] **Step 8 : Enrichir le header desktop**

Remplacer :

```tsx
        <header className="h-12 border-b border-border flex items-center px-4 lg:px-6 bg-card shrink-0">
          <button className="lg:hidden mr-3 text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
        </header>
```

Par :

```tsx
        <header className="h-12 border-b border-border flex items-center px-4 lg:px-6 bg-card shrink-0">
          <button className="lg:hidden mr-3 text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          {subtitle && (
            <h1 className="text-sm font-semibold text-foreground hidden lg:block">{subtitle}</h1>
          )}
          <div className="ml-auto hidden lg:flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-accent-foreground">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-[13px] text-muted-foreground">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
            </span>
          </div>
        </header>
```

- [ ] **Step 9 : Remplacer le formatage du rôle en bas de sidebar**

Remplacer :

```tsx
              {user?.role?.replace(/_/g, ' ') || 'Membre'}
```

Par :

```tsx
              {formatRole(user?.role)}
```

- [ ] **Step 10 : Vérifier la compilation TypeScript**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 11 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/components/AppLayout.tsx
git commit -m "feat: sidebar Planning Louange label, formatRole, enriched header, dynamic song count"
```

---

### Task 8 : Build TypeScript final + déploiement production

**Files:**
- Generate: `dist/`

- [ ] **Step 1 : Build complet**

```bash
cd /Users/fbm/Desktop/Psalm && npm run build 2>&1 | tail -10
```

Expected : `✓ built in ~5s` avec `dist/index.html` et `dist/assets/index-[hash].js`.

- [ ] **Step 2 : Déployer sur o2switch**

```bash
cd /Users/fbm/Desktop/Psalm
scp -o StrictHostKeyChecking=no dist/index.html \
  bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/index.html
scp -o StrictHostKeyChecking=no dist/assets/* \
  bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/assets/
```

Expected : transfert sans erreur.

- [ ] **Step 3 : Vérifier HTTP 200**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://admin-psalm.a-e-f.fr/admin/
```

Expected : `HTTP 200`

- [ ] **Step 4 : Vérifier que le bon bundle est servi**

```bash
curl -s https://admin-psalm.a-e-f.fr/admin/index.html | grep -o 'assets/index-[^"]*\.js'
```

Expected : un hash différent de l'ancien (`index-Y3iCJzSP.js`).

- [ ] **Step 5 : Commit final**

```bash
cd /Users/fbm/Desktop/Psalm
git add -A
git commit -m "chore: deploy planning/roles/sidebar/ux improvements to production"
```
