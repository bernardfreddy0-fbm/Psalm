# Plan — Code-splitting des routes (Psalm admin)

> **For agentic workers:** Implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi. UN incrément cohérent par passage, vérifié (lint + test + build + **e2e**), puis commit + push sur la branche **`autopilot/code-splitting-routes`**. ⚠️ NE JAMAIS pousser sur `main` (push main = déploiement Coolify auto). Le déploiement reste un merge manuel de l'utilisateur.

## Objectif
Réduire le bundle initial (~1,4 Mo / 419 Ko gzip aujourd'hui) en chargeant les pages authentifiées en **lazy** (`React.lazy` + `Suspense`), pour que chaque route ait son propre chunk et que la première peinture ne télécharge plus tout le code de l'admin. Aucun changement fonctionnel visible attendu.

## Contexte
- Fichier central : `src/App.tsx` — 17 pages importées en `import ... from "@/pages/..."` de façon **eager** (lignes 8–24), montées dans `<Routes>`.
- Garder **eager** (chemin critique d'auth, petits) : `LoginPage`, `ResetPasswordPage`, `AppLayout`, `NotFound`.
- Passer en **lazy** les pages authentifiées : Dashboard, Programme, Evenements, Planning, Membres, Rotations, Chants, Acces, Permissions, Journal, Configuration, Disponibilites, Conducteur, Aefv, Predications.
- Vérifs : `npm run lint`, `npm run test`, `npm run build`. Build attendu : plusieurs `dist/assets/*.js` au lieu d'un seul gros chunk.

---

## Task 1 : Passer les pages authentifiées en lazy + Suspense

**Files:** `src/App.tsx`

- [x] **Step 1 : Convertir les imports de pages en `React.lazy`**

Remplacer les imports eager des 15 pages authentifiées par des imports paresseux. Ajouter `lazy` et `Suspense` depuis `react`. Exemple de transformation :

```tsx
// avant
import DashboardPage from "@/pages/DashboardPage";
// après
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
```

Conserver en imports normaux : `LoginPage`, `ResetPasswordPage`, `AppLayout`, `NotFound`, et tous les non-pages (providers, Guard, contexts, UI). En tête de fichier : `import { lazy, Suspense } from "react";`.

- [x] **Step 2 : Envelopper les routes authentifiées dans un `<Suspense>`**

Entourer le bloc `<Route element={<AppLayout />}> ... </Route>` (ou le `<Routes>` authentifié) d'un `<Suspense fallback={...}>`. Le fallback doit être discret et cohérent avec le design existant (réutiliser un spinner/skeleton déjà présent dans `src/components` si disponible — chercher `Loader`, `Spinner`, `Skeleton` ; sinon un simple `<div className="flex h-screen items-center justify-center">…</div>`). Ne pas casser le `basename="/admin"` du Router.

- [x] **Step 3 : Vérifier lint + build**

```bash
cd /Users/fbm/Desktop/Psalm && npm run lint && npm run build
```
Attendu : build `✓ built`, zéro erreur TS, et **plusieurs** fichiers `dist/assets/*.js` (un chunk par page lazy) au lieu d'un unique gros `index-*.js`. Le chunk d'entrée doit être nettement plus petit qu'avant (~1,4 Mo).

- [x] **Step 4 : Vérifier les tests unitaires**

```bash
cd /Users/fbm/Desktop/Psalm && npm run test
```
Attendu : tous les tests passent (les 11 existants au minimum). Si un test rend `App` et casse à cause du lazy, l'envelopper dans `Suspense`/`act` ou attendre le chargement — adapter le test, pas la logique.

- [x] **Step 5 : Vérifier le test fonctionnel e2e**

```bash
cd /Users/fbm/Desktop/Psalm && npm run e2e
```
Attendu : smoke test vert — l'app boote dans un navigateur, page de login visible, **aucun chunk JS/CSS en échec** (c'est LA vérif qui prouve que le lazy-loading ne casse rien au runtime), pas d'erreur console fatale.

- [x] **Step 6 : Commit + push (branche, jamais main)**

⚠️ Ne jamais pousser sur `main` (déploiement). Pousser uniquement la branche autopilot.

```bash
cd /Users/fbm/Desktop/Psalm
git add src/App.tsx src/**/*.test.tsx 2>/dev/null
git commit -m "perf(admin): lazy-load des routes authentifiées (code-splitting)"
git push fork autopilot/code-splitting-routes
```

---

## Task 2 : Découper les grosses dépendances en chunk manuel (optionnel, si Task 1 insuffisant)

**Files:** `vite.config.ts`

Ne traiter que si après Task 1 le warning « chunks larger than 500 kB » persiste sur le chunk d'entrée.

- [ ] **Step 1 : Ajouter `manualChunks` pour isoler les libs lourdes**

Dans `vite.config.ts`, sous `build.rollupOptions.output`, ajouter un `manualChunks` qui regroupe les dépendances volumineuses repérées au build (`html2canvas`, `jspdf`/`purify`, `@tanstack/react-query`, `recharts` si présent) dans des vendors séparés. Vérifier les noms réels dans `package.json` avant d'écrire la liste.

- [ ] **Step 2 : Vérifier le build**

```bash
cd /Users/fbm/Desktop/Psalm && npm run build
```
Attendu : plus de chunk unique > 500 Ko, ou au moins une réduction nette du chunk d'entrée. Pas de régression de tests.

- [ ] **Step 3 : Commit + push**

```bash
cd /Users/fbm/Desktop/Psalm
git add vite.config.ts
git commit -m "perf(admin): manualChunks pour isoler les vendors lourds"
git push fork autopilot/code-splitting-routes
```

---

## Task 3 : Clôture

- [ ] **Step 1 : Récap final**

Vérifier `npm run lint && npm run test && npm run build && npm run e2e` tous verts. Noter la taille du nouveau chunk d'entrée vs l'ancien (~1,4 Mo / 419 Ko gzip) dans le message de commit ou le résumé. Le déploiement prod reste **manuel** : l'utilisateur merge `autopilot/code-splitting-routes` → `main` quand il valide.

---

## Garde-fous
- UN incrément (un Step cohérent) par passage du cron.
- Jamais de commit si lint/test/build échoue → `git restore` à la place.
- Aucun changement fonctionnel : mêmes routes, mêmes Guards, même comportement utilisateur.
- NE PAS déployer en production, ne pas toucher `.env*`, ni le backend `api/`.
