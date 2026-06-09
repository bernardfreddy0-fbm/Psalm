# Plan — Finitions UI Psalm admin (MonthKanban + badges Dashboard)

> **For agentic workers :** implémenter tâche par tâche, UN incrément cohérent par passage. Vérifs (lint + test + build + **e2e**) vertes avant tout commit. Commit + push sur la branche **`autopilot/finitions-ui`** + PR vers main (ouvrir/mettre à jour UNE PR pour la branche). ⚠️ JAMAIS de push `main` (merge = humain = déploiement Coolify). Cocher l'étape (`- [ ]`→`- [x]`) après réussite.

## Objectif
Corriger les 2 défauts UI connus de longue date, à comportement fonctionnel constant :
1. `MonthKanban.tsx` : des composants sont définis À L'INTÉRIEUR du corps du composant parent → recréés à chaque render, mémoïsation cassée (perf + perte de focus potentielle).
2. `DashboardPage` : badges de pôles construits avec des classes Tailwind dynamiques (interpolées) → purgées au build → badges sans couleur en prod.

## Garde-fous
- UN incrément (un Step) par passage du cron.
- Refactor à comportement strictement constant (mêmes données, même UI rendue — couleurs des badges ENFIN visibles = le seul changement visible attendu).
- Jamais de commit si lint/test/build/e2e échoue → `git restore`.
- Pas de modif `.env*`, pas de backend.

---

## Task 1 : MonthKanban — sortir les composants internes

**Files :** `src/components/.../MonthKanban.tsx` (localiser via `grep -r "MonthKanban" src/`), éventuels nouveaux fichiers à côté.

- [ ] **Step 1 : Cartographier**
Lire `MonthKanban.tsx` en entier. Lister les composants/fonctions définis dans le corps du composant (closures sur props/state). Noter pour chacun : props nécessaires une fois extrait. Étape d'analyse — consigner la liste dans le plan (sous ce step), commit du plan seul autorisé.

- [ ] **Step 2 : Extraire les composants au niveau module**
Sortir chaque composant interne au niveau module (même fichier ou fichier voisin), props explicites typées, `memo()` si pertinent. Aucun changement de rendu. Vérifs vertes. Commit `refactor(kanban): composants internes extraits (mémoïsation)`.

- [ ] **Step 3 : Vérifier le comportement**
Lancer l'e2e + vérifier manuellement via `npm run build && npx vite preview` que la page planning/kanban rend comme avant (DOM stable). Vérifs vertes. Commit éventuel de finition.

---

## Task 2 : DashboardPage — badges pôles sans couleur en prod

**Files :** `src/pages/DashboardPage.tsx` (ou composant badge associé — localiser via `grep -rn "bg-\${" src/ ; grep -rn "text-\${" src/`).

- [ ] **Step 1 : Identifier toutes les classes dynamiques**
Repérer chaque endroit où une classe Tailwind est interpolée (`bg-${color}-100`, etc.) dans le Dashboard ET ailleurs (`grep -rn '\${' src/ | grep -E 'bg-|text-|border-'`). Lister les occurrences sous ce step.

- [ ] **Step 2 : Remplacer par un mapping statique**
Remplacer l'interpolation par un objet `Record<Pole, string>` contenant les classes COMPLÈTES littérales (ex. `{ choristes: "bg-purple-100 text-purple-800", ... }`), de sorte que le scanner Tailwind les voie. Pas de safelist globale. Vérifs vertes. Commit `fix(dashboard): classes badges statiques (purge Tailwind)`.

- [ ] **Step 3 : Preuve build**
Vérifier que les classes sont bien présentes dans le CSS du build : `npm run build && grep -o 'bg-purple-100' dist/assets/*.css | head -1` (adapter aux couleurs réelles). Vérifs vertes. Mettre la preuve dans le résumé du commit/PR.

---

## Task 3 : Clôture

- [ ] **Step 1 : Vérif finale + PR prête**
`npm run lint && npm run test && npm run build && npm run e2e` verts. PR `autopilot/finitions-ui` → main à jour avec un résumé : avant/après MonthKanban (nb composants extraits), liste des badges corrigés + preuve CSS. L'humain merge depuis le téléphone → déploiement auto.
