# AEF Psalm Admin — CLAUDE.md

## Projet
Interface d'administration de la plateforme de gestion de l'église AEF (cultes, membres, chants, planning).
- **Frontend** : https://admin-psalm.a-e-f.fr (racine — basename `/`)
- **API principale** : https://api-psalm.a-e-f.fr (Hono + Node.js — **pas PHP**)
- Deploy : `git push fork main` → Coolify rebuild automatique (Dockerfile + Nginx sur VPS OVH)

## Stack technique
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- React Query v5 (`@tanstack/react-query`) pour tous les appels API
- React Router v6 avec `basename="/"`
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
| `/acces` | Accès & Identités (fusion Comptes + Permissions) |
| `/configuration` | Paramètres |

## API — Conventions
- `API_BASE = 'https://api-psalm.a-e-f.fr'` (Hono/Node.js — JWT Bearer)
- Auth : token Bearer dans header, stocké dans `localStorage.getItem('aef_admin_token')`
- Endpoints REST : `/auth`, `/members`, `/planning`, `/songs`, `/events`, `/permissions`, `/config`, `/absences`, `/disponibilites`, `/runsheet`, `/activity`

## Règles métier clés
- `conducteur_louange` (N3 opérationnel) ≠ `responsable_louange` (N2 responsable) — rôles distincts, pas d'alias
- Membre supprimé : `first_name === '[Supprimé]'` ou `is_active === '0'`
- Chants : chaque chant a une tonalité (ex: Si, Do#, Sib, La, Ré)
- Planning auto-généré : 1 Dirigeant/dimanche, 6 Choristes (2 expérimentés min), 4 Musiciens, 2 Sonorisateurs, 1 Projectionniste, 2 Vidéastes
- Culte Jeunesse : 2ème dimanche du mois, uniquement les directeurs jeunesse désignés
- Repos obligatoire : 1 dimanche/mois pour tous (dirigeants : 1/8 semaines)

## Déploiement
```bash
git push fork main   # Coolify rebuild automatique sur le VPS OVH
```
- Hébergement : VPS OVH 141.94.95.7, via Coolify (Dockerfile + Nginx + Traefik HTTPS auto)
- Remote git : `fork` (pas `origin`) → `git push fork main`
- ⚠️ Ne plus utiliser `bash deploy-admin.sh` (SCP o2switch obsolète)

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
