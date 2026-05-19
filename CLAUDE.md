# AEF Psalm Admin — CLAUDE.md

## Projet
Interface d'administration de la plateforme de gestion de l'église AEF (cultes, membres, chants, planning).
- **Frontend** : https://admin-psalm.a-e-f.fr/admin
- **API principale** : https://api-psalm.a-e-f.fr (PHP)
- **API settings** : https://admin-psalm.a-e-f.fr/api

## Stack technique
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- React Query v5 (`@tanstack/react-query`) pour tous les appels API
- React Router v6 avec `basename="/admin"`
- Zod + React Hook Form pour la validation
- Vitest pour les tests unitaires
- Playwright pour les tests e2e

## Architecture frontend
```
src/
  pages/         # Une page par route
  components/    # AppLayout, NavLink, ui/ (shadcn)
  contexts/      # AuthContext (token dans localStorage 'aef_admin_token')
  hooks/         # use-mobile, use-toast
  lib/           # api.ts (appels HTTP), planningGenerator.ts, utils.ts
```

## Routes principales
| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/programme` | Programme du culte |
| `/evenements` | Événements |
| `/cultes` | Planning des cultes |
| `/membres` | Gestion des membres |
| `/rotations` | Rotations de l'équipe |
| `/chants` | Bibliothèque de chants |
| `/comptes` | Comptes utilisateurs |
| `/permissions` | Gestion des rôles |
| `/configuration` | Paramètres |

## API — Conventions
- `API_BASE = 'https://api-psalm.a-e-f.fr'`
- `SETTINGS_BASE = 'https://admin-psalm.a-e-f.fr/api'`
- Auth : token Bearer dans header, stocké dans `localStorage.getItem('aef_admin_token')`
- Endpoints connus : `/planning.php`, `/data.php?type=songs`, `/data.php?type=versets`
- Nonce anti-cache : `withRequestNonce(url)` ajoute `?_=timestamp`

## Règles métier clés
- Rôle `responsable_louange` → alias de `conducteur_louange` (voir `LEGACY_ROLE_ALIASES`)
- Membre supprimé : `first_name === '[Supprimé]'` ou `is_active === '0'`
- Chants : chaque chant a une tonalité (ex: Si, Do#, Sib, La, Ré)
- Planning auto-généré : 1 Dirigeant/dimanche, 6 Choristes (2 expérimentés min), 4 Musiciens, 2 Sonorisateurs, 1 Projectionniste, 2 Vidéastes
- Culte Jeunesse : 2ème dimanche du mois, uniquement les directeurs jeunesse désignés
- Repos obligatoire : 1 dimanche/mois pour tous (dirigeants : 1/8 semaines)

## Déploiement
```bash
npm run build
./deploy-admin.sh MOT_DE_PASSE_FTP
```
- Hébergement : o2switch (cPanel), user `bqzk4896`, host `yellow.o2switch.net`
- SSH key : `/Users/fbm/.ssh/id_ed25519`
- Déploiement par FTP vers `/home/bqzk4896/public_html/admin-psalm.a-e-f.fr/admin/`
- MCP SSH disponible : serveur `o2switch-ssh` configuré dans Claude Code

## Commandes dev
```bash
npm run dev      # dev local
npm run build    # build prod
npm run test     # vitest
npm run lint     # eslint
```

## Conventions de code
- Composants shadcn/ui pour toute l'UI (ne pas réinventer les composants de base)
- Toujours passer par React Query pour les appels API (pas de fetch direct dans les composants)
- Types TypeScript stricts — pas de `any` sauf dans les données API existantes
- Tailwind uniquement pour le style (pas de CSS inline)
