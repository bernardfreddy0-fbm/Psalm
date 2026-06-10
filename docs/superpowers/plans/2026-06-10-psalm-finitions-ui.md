# Plan — Hygiène code Psalm admin (hooks deps + typage)

> **For agentic workers :** implémenter tâche par tâche, UN incrément cohérent par passage. Vérifs (lint + test + build + **e2e**) vertes avant tout commit. Commit + push sur la branche **`autopilot/finitions-ui`** + PR vers main (ouvrir/mettre à jour UNE PR pour la branche). ⚠️ JAMAIS de push `main` (merge = humain = déploiement Coolify). Cocher l'étape (`- [ ]`→`- [x]`) après réussite.

> ℹ️ **Note (audit 2026-06-10)** : les anciens bugs « MonthKanban composants internes » et « badges Dashboard classes Tailwind dynamiques » sont DÉJÀ corrigés (vérifié : composants au niveau module, couleurs littérales statiques). Ce plan remplace ces cibles par les vraies trouvailles de l'audit lint du 2026-06-10 : 161 erreurs (dont 157 `no-explicit-any`) + 3 `react-hooks/exhaustive-deps`.

## Objectif
Comportement fonctionnel constant. Corriger les 3 dépendances de hooks manquantes (risque de données périmées) puis réduire la dette `any` fichier par fichier.

## Garde-fous
- UN incrément (un Step) par passage du cron.
- Jamais de commit si lint/test/build/e2e échoue → `git restore`.
- Typage : remplacer `any` par le VRAI type (interface existante, `unknown` + narrowing) — JAMAIS de cast de complaisance ni de `// eslint-disable`.
- Pas de modif `.env*`, pas de backend.

---

## Task 1 : Dépendances de hooks manquantes (3 cas précis)

- [x] **Step 1 : `src/pages/AefvPage.tsx:518`**
`channelVideos` (expression logique) rend les deps du `useMemo` (l.528) instables. Envelopper l'initialisation de `channelVideos` dans son propre `useMemo` comme le suggère la règle. Vérifier que l'onglet Vidéos (Pipeline/Catalogue) rend à l'identique. Commit.
✅ Corrigé dans PR #9 / commit 61dd22a (2026-06-10).

- [x] **Step 2 : `src/pages/DashboardPage.tsx:137`**
`useMemo` avec dep manquante `today`. Soit inclure `today`, soit sortir `today` du scope réactif (constante module ou `useRef`) selon l'intention RÉELLE du code (lire avant de décider). Commit.
✅ Corrigé dans PR #9 / commit 61dd22a (2026-06-10).

- [x] **Step 3 : `src/pages/EvenementsPage.tsx:96`**
`useEffect` avec dep manquante `loadData`. Stabiliser `loadData` avec `useCallback` puis l'ajouter aux deps (pas de désactivation de règle). Vérifier qu'on ne crée PAS de boucle de re-fetch (loadData ne doit dépendre que de valeurs stables). Commit.
✅ Corrigé dans PR #9 / commit 61dd22a (2026-06-10).

## Task 2 : Réduction `no-explicit-any` (157 → 0, par lots)

- [x] **Step 1 : Inventaire trié**
`npm run lint -- --format json` → compter les `any` par fichier, traiter du plus gros au plus petit. Coller l'inventaire sous ce step. Commit du plan seul autorisé.

Inventaire au 2026-06-10 (157 `any` dans 18 fichiers, du plus gros au plus petit) :
```
 64  src/lib/api.ts
 18  src/components/config/ConfigMaintenance.tsx
 15  src/pages/ProgrammePage.tsx
 10  src/pages/EvenementsPage.tsx
  9  src/pages/AccesPage.tsx
  9  src/pages/DashboardPage.tsx
  6  src/pages/ComptesPage.tsx
  4  src/components/config/ConfigGeneral.tsx
  4  src/lib/equityEngine.ts
  4  src/pages/ConducteurAdminPage.tsx
  3  src/lib/exportPlanningPDF.ts
  2  src/components/config/ConfigIntegrations.tsx
  2  src/components/config/ConfigNotifications.tsx
  2  src/components/config/ConfigTeams.tsx
  2  src/lib/supabase.ts
  1  src/components/planning/MonthKanban.tsx
  1  src/pages/ChantsPage.tsx
  1  src/pages/LoginPage.tsx
```
Prochaine cible : `src/lib/api.ts` (64 erreurs).

- [ ] **Step 2..N : UN fichier (ou groupe ≤ 20 erreurs) par passage**
Typer correctement, vérifs vertes, commit `fix(types): <fichier> sans any (xx restants)`. Répéter à chaque passage du cron jusqu'à 0. Mettre à jour le compteur dans le titre du commit.

## Task 3 : Clôture

- [ ] **Step 1 : Vérif finale + PR prête**
`npm run lint` → **0 erreur** `no-explicit-any` et `exhaustive-deps`. Lint + test + build + e2e verts. PR résumée (avant/après par règle). L'humain merge depuis le téléphone.
