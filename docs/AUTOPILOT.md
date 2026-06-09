# Autopilot & pilotage mobile — passage de relais

> Document de contexte pour toute session Claude Code (cloud depuis l'app, ou locale).
> Dernière mise à jour : 2026-06-09.

## Où en est le projet
- App React d'admin (Psalm) en production sur https://admin-psalm.a-e-f.fr (Hono/Node API, basename `/`, base Vite `/`).
- Hébergement VPS OVH via **Coolify**. **Déploiement = merge d'une PR vers `main`** (workflow `.github/workflows/deploy-on-merge.yml` → webhook Coolify). Un simple push ne déploie pas.
- Dépôt local de référence : `/Users/fbm/dev/Psalm` (déplacé hors de `~/Desktop`/iCloud le 2026-06-09 car iCloud cassait git).

## Règles d'or (NE PAS enfreindre)
1. **Ne jamais pousser/commiter sur `main`** ni le merger automatiquement. Toujours : branche dédiée + Pull Request. C'est l'humain qui merge (= qui déploie).
2. Avant tout commit : `npm run lint` + `npm run test` + `npm run build` + `npm run e2e` doivent passer. Sinon, revenir en arrière (`git restore`) — jamais de commit cassé.
3. Un incrément cohérent par tâche. Pas de grosse fonctionnalité sans plan dans `docs/superpowers/plans/`.
4. Ne pas toucher `.env*`, secrets, ni appeler de webhook de déploiement.

## Tests
- Unitaires : `npm run test` (Vitest).
- Fonctionnels : `npm run e2e` (Playwright, `e2e/smoke.spec.ts`) — boote le build via `vite preview`, vérifie que l'app démarre, que la page de login s'affiche, qu'aucun chunk JS/CSS n'échoue (détecte un lazy-import cassé), pas d'erreur console fatale. Config Playwright autonome (le paquet `lovable-agent-playwright-config` n'est pas installé).

## Systèmes en place
- **Cron autopilot** (sur le Mac, toutes les 3 h) : exécute le plan le plus récent de `docs/superpowers/plans/`, une étape par passage, ouvre une PR, envoie un résumé Telegram. Ne touche jamais `main` (hook pre-push + discipline PR).
- **Pilotage mobile** : app Claude → onglet **Code** (repo Psalm connecté, env cloud) pour donner des ordres ; merge de la PR = déploiement. `@claude` sur issues/PR fonctionne aussi (auth via abonnement Pro, secret `CLAUDE_CODE_OAUTH_TOKEN`).

## Feuille de route (prochaines pistes)
- **Piste A — Vidéothèque côté membre** (PROCHAINE) : répliquer le pattern AEFV (onglet « Vidéos » : mode Pipeline Brut/Montage/Validation/Publié + mode Catalogue groupé par mois) sur la page **`/video` côté membre** (plateforme PsalmMembre). S'appuyer sur la logique pure déjà testée côté admin (`src/lib/aefvVideos.ts`, `src/pages/aefv/`). Écrire les tests, vérifier build + e2e, ouvrir une PR.
- **Piste B — Sessions vidéo dédiées dans AEFVApp** (repo séparé).
- **Piste D — Filet de tests sur AEFApi** (backend, repo séparé).

## Comment continuer (depuis l'app Claude, onglet Code)
1. Nouvelle session sur le repo `bernardfreddy0-fbm/Psalm`, base `main`.
2. Lis ce fichier + `CLAUDE.md` + le plan le plus récent de `docs/superpowers/plans/`.
3. Travaille sur une branche, ouvre une PR (jamais `main`). Merge = déploiement.
