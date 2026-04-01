# Planning Save · Rôles Instrumentaux · Sidebar · UX — Design

**Date :** 2026-04-01

---

## Périmètre

4 zones d'amélioration indépendantes sur la plateforme AEF Admin :

1. **Planning** — Corriger la sauvegarde (save manuel + régénération)
2. **Rôles instrumentaux** — Remplacer `musicien` par 5 rôles spécifiques
3. **Sidebar** — Label, formatage rôle, header enrichi
4. **UX rapides** — 5 petites corrections transverses

---

## Zone 1 : Planning — Save + Régénérer

### Diagnostic

- `updateSunday` dans `api.ts` utilise GET querystring → intercepté par Varnish → PHP jamais exécuté
- La table `aef_sundays` ne contient pas les colonnes d'équipe (`choristes`, `piano`, etc.)
- `sundays.php` `case 'update'` n'accepte que `date`, `label`, `theme`, `dirigeant`, `is_locked`
- Tout ce que le frontend envoie pour les équipes est silencieusement ignoré

### Migration SQL

```sql
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
```

### Backend — `sundays.php` `case 'update'`

Remplacer la whitelist actuelle par :

```php
$allowed = [
  'date', 'label', 'theme', 'dirigeant', 'dirigeant_id',
  'is_jeunesse', 'is_locked', 'note',
  'choristes', 'piano', 'batterie', 'guitare_elec', 'guitare_acou',
  'basse', 'son', 'projection', 'video', 'evenement'
];
foreach ($allowed as $field) {
    if (isset($input[$field])) {
        $fields[] = "$field = ?";
        $values[] = $input[$field];
    }
}
```

Le reste du `case 'update'` (vérification `empty($fields)`, `$values[] = $id`, `prepare/execute`) reste identique.

### Frontend — `api.ts`

`updateSunday` passe de GET querystring à POST JSON body :

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

### Frontend — `PlanningPage.tsx` `handleUpdate`

Ajouter `evenement` au payload (actuellement absent) :

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
  evenement: editing.evenement || '',  // ← ajout
};
```

L'`EditForm` interface doit inclure `evenement: string`. La fonction `openEdit` doit l'initialiser : `evenement: s.evenement || ''`.

---

## Zone 2 : Rôles instrumentaux

### Changement

`musicien` (rôle générique) → 5 rôles spécifiques :
- `pianiste`
- `batteur`
- `guitariste_electrique`
- `guitariste_acoustique`
- `bassiste`

### `ComptesPage.tsx`

```typescript
const ROLES = [
  'conducteur_louange', 'responsable_technique',
  'pasteur', 'choriste',
  'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste',
  'sonorisateur', 'projectionniste', 'videaste', 'dev'
];
```

Ajouter les couleurs dans `ROLE_COLORS` :
```typescript
pianiste: 'bg-gold/10 text-gold',
batteur: 'bg-gold/10 text-gold',
guitariste_electrique: 'bg-gold/10 text-gold',
guitariste_acoustique: 'bg-gold/10 text-gold',
bassiste: 'bg-gold/10 text-gold',
```

Rétro-compatibilité : `musicien` reste dans `ROLE_COLORS` pour l'affichage des membres existants.

### `MembresPage.tsx`

```typescript
const ROLE_LABELS: Record<string, string> = {
  // ... existants ...
  pianiste: 'Pianiste',
  batteur: 'Batteur',
  guitariste_electrique: 'Guit. élec.',
  guitariste_acoustique: 'Guit. acou.',
  bassiste: 'Bassiste',
  musicien: 'Musicien', // rétro-compat
};

const POLE_ROLES: Record<string, string[]> = {
  'Choriste & Dirigeant': ['choriste', 'dirigeant', 'conducteur_louange', 'responsable_louange'],
  'Musique': ['musicien', 'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste'],
  'Sonorisation': ['sonorisateur', 'responsable_technique'],
  'Projection': ['projectionniste'],
  'Vidéo': ['videaste'],
};
```

### `planningGenerator.ts`

`categorizeMembers` filtre par **rôle** pour les postes musicaux :

```typescript
function categorizeMembers(members: MemberForPlanning[]) {
  return {
    dirigeants: members.filter(m =>
      m.roles.includes('dirigeant') ||
      m.roles.includes('conducteur_louange') ||
      m.roles.includes('responsable_louange')
    ),
    choristesExperimentes: members.filter(m => m.experienced && m.roles.includes('choriste')),
    choristes: members.filter(m => m.roles.includes('choriste')),
    pianistes: members.filter(m => m.roles.includes('pianiste')),
    batteurs:  members.filter(m => m.roles.includes('batteur')),
    guitaristes: members.filter(m =>
      m.roles.includes('guitariste_electrique') ||
      m.roles.includes('guitariste_acoustique')
    ),
    guitaristesElec: members.filter(m => m.roles.includes('guitariste_electrique')),
    guitaristesAcou: members.filter(m => m.roles.includes('guitariste_acoustique')),
    bassistes: members.filter(m => m.roles.includes('bassiste')),
    sonorisateurs: members.filter(m => m.roles.includes('sonorisateur')),
    projectionnistes: members.filter(m => m.roles.includes('projectionniste')),
    videastes: members.filter(m => m.roles.includes('videaste')),
  };
}
```

La logique de guitare alternée (pair/impair) devient plus précise : semaines paires → pool `guitaristesElec`, impaires → pool `guitaristesAcou`. Si le pool est vide, fallback sur `guitaristes`.

### `PlanningPage.tsx` — `membersByRole`

```typescript
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
```

---

## Zone 3 : Sidebar

### `AppLayout.tsx` — 3 changements

**1. Label "Cultes" → "Planning Louange"**
```typescript
{ to: '/cultes', icon: Church, label: 'Planning Louange' },
```
Et dans `pageTitles` :
```typescript
'/cultes': 'Planning Louange',
```

**2. Fonction `formatRole`** (remplace le `.replace(/_/g, ' ')` brut)
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
  // Handle multi-role: show first role only in sidebar footer
  const firstRole = role.split(',')[0].trim();
  return ROLE_DISPLAY[firstRole] || firstRole.replace(/_/g, ' ');
}
```

Remplacer `{user?.role?.replace(/_/g, ' ') || 'Membre'}` par `{formatRole(user?.role)}`.

**3. Header desktop enrichi**
Actuellement le `<header>` est vide côté desktop. Ajouter :
- À gauche : titre de la page active (`subtitle` déjà calculé)
- À droite : avatar + nom de l'utilisateur connecté

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

---

## Zone 4 : UX Rapides

### Badge chants dynamique — `AppLayout.tsx`

Ajouter l'import : `import { getSongs } from '@/lib/api';`

Supprimer `badge: '192'` hardcodé. Ajouter un `useEffect` dans `AppLayout` qui charge le count depuis l'API :

```typescript
const [songCount, setSongCount] = useState<number | null>(null);
useEffect(() => {
  getSongs().then(songs => setSongCount(songs.length)).catch(() => {});
}, []);
```

Dans `navSections`, retirer le `badge` hardcodé de Bibliothèque. L'affichage du badge devient conditionnel sur `songCount`:

```tsx
{item.to === '/chants' && songCount !== null && (
  <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
    {songCount}
  </span>
)}
```

### Sous-liens sidebar supprimés

Retirer les `sub` arrays de `navSections` — ces éléments ne naviguent nulle part et créent une fausse affordance :
```typescript
// Supprimer 'sub' de tous les items navSections
{ to: '/membres', icon: Users, label: 'Membres' },  // sans sub
{ to: '/chants', icon: Music, label: 'Bibliothèque' },  // sans sub
```

---

## Fichiers modifiés

| Fichier | Zone |
|---|---|
| `sundays.php` (serveur) | Zone 1 |
| `src/lib/api.ts` | Zone 1 |
| `src/pages/PlanningPage.tsx` | Zone 1 + Zone 2 + Zone 3 |
| `src/lib/planningGenerator.ts` | Zone 2 |
| `src/pages/ComptesPage.tsx` | Zone 2 |
| `src/pages/MembresPage.tsx` | Zone 2 |
| `src/components/AppLayout.tsx` | Zone 3 + Zone 4 |

---

## Build & Déploiement

Après tous les changements frontend :
```bash
cd /Users/fbm/Desktop/Psalm && npm run build
scp dist/index.html bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/index.html
scp dist/assets/* bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/assets/
```
