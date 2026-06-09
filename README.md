# AEF Psalm Admin

Interface d'administration de la plateforme de gestion de l'église AEF
(cultes, membres, chants, planning).

- **Frontend** : https://admin-psalm.a-e-f.fr
- **API** : https://api-psalm.a-e-f.fr (Hono + Node.js)

## Stack technique

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix UI)
- **React Query v5** (`@tanstack/react-query`) pour tous les appels API
- **React Router v6**
- **Zod** + **React Hook Form** pour la validation des formulaires
- **Vitest** pour les tests unitaires
- **Playwright** pour les tests end-to-end

## Démarrage rapide

```bash
npm install      # installe les dépendances
npm run dev      # lance le serveur de développement
npm run build    # build de production
npm run preview  # prévisualise le build de production
npm run lint     # vérifie le code avec ESLint
npm run test     # lance les tests unitaires (Vitest)
npm run e2e      # lance les tests end-to-end (Playwright)
```
