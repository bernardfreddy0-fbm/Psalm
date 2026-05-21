# Spec 1 — Migration Backend AEF : Supabase → Hono + PostgreSQL OVH VPS

**Date :** 2026-05-21  
**Scope :** PsalmAdmin + PsalmMembre  
**Statut :** Approuvé — prêt pour implémentation

---

## Contexte & objectifs

### Situation actuelle

L'écosystème AEF Louange comprend deux apps React/TypeScript déployées sur OVH VPS via Coolify :

- **PsalmAdmin** (`admin-psalm.a-e-f.fr`) — interface d'administration
- **PsalmMembre** (`psalm.a-e-f.fr`) — interface membres

Les deux apps appellent **Supabase directement depuis le navigateur** :

- PsalmAdmin utilise deux clients : `supabase` (anon key) et `supabaseAdmin` (service key) — la **service key est exposée dans le bundle JS**, ce qui constitue une vulnérabilité critique (accès lecture/écriture complet à la base sans RLS).
- PsalmMembre utilise uniquement `supabase` (anon key + RLS) — sécurisé, mais dépend de Supabase.

### Objectifs de cette migration

1. **Éliminer la service key exposée** — zéro secret dans le frontend
2. **Un seul backend TypeScript** pour les deux apps et le futur module IA
3. **Données sur OVH VPS EU** — autonomie totale, conformité RGPD
4. **Préparer Spec 2 (module IA)** — Hono devient la couche API sur laquelle l'IA s'appuiera

### Hors scope

- Module IA → Spec 2 (après cette migration)
- Nouveaux modules fonctionnels (PsalmAdmin ou PsalmMembre)
- Refonte UI des deux apps

---

## Architecture cible

```
[PsalmAdmin]  [PsalmMembre]
     │               │
     └───────┬────────┘
             │ HTTPS / REST JSON + JWT Bearer
             ▼
     ┌─────────────────────────────────────┐
     │   Node.js 22 / Hono API             │
     │   api.a-e-f.fr                      │
     │   Coolify · Docker · OVH VPS        │
     │                                     │
     │  Auth · Membres · Planning · Chants │
     │  Événements · Permissions · Config  │
     │  Absences · Disponibilités          │
     └────────┬──────────────┬────────────┘
              │              │
        ┌─────┘        ┌─────┘
        ▼              ▼
   PostgreSQL 16    Minio
   Coolify OVH      Coolify OVH
                    (partitions PDF)

   Externes : Resend (emails) · Anthropic API (Spec 2)
```

**Secrets — uniquement sur le serveur Hono :**

| Variable | Usage |
|----------|-------|
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_SECRET` | Signature tokens |
| `RESEND_API_KEY` | Emails transactionnels |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Stockage fichiers |

---

## Stack technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Runtime | Node.js 22 | LTS, compatible Hono, SDK Anthropic natif pour Spec 2 |
| Framework API | [Hono](https://hono.dev/) | Ultra léger (~14 KB), typesafe, idéal Edge/Node |
| ORM | [Drizzle](https://orm.drizzle.team/) | TypeScript-first, SQL explicite, migrations propres |
| Auth | [better-auth](https://www.better-auth.com/) | TypeScript natif, email/password + refresh token + reset |
| Base de données | PostgreSQL 16 | Même moteur que Supabase — migration schéma sans perte |
| Stockage fichiers | Minio (self-hosted) | S3-compatible, gratuit, sur OVH VPS via Coolify |
| Emails | Resend | API simple, délivrabilité élevée, 3 000 emails/mois gratuits |
| Déploiement | Coolify (Docker) | Déjà en place sur OVH VPS |

---

## Auth

### Flux login

1. `POST /auth/login` → vérification email/password (bcrypt)
2. Retourne : `{ access_token, refresh_token, user: { id, first_name, last_name, role } }`
3. Frontend stocke `access_token` dans `localStorage` sous la clé unifiée `aef_token` (remplace `aef_admin_token` dans PsalmAdmin et `aef_user_token` dans PsalmMembre)
4. Toutes les requêtes : header `Authorization: Bearer <access_token>`

### Tokens

- **Access token** : JWT HMAC-SHA256, expiration 7 jours
- **Refresh token** : opaque (UUID), expiration 30 jours, stocké en base (`sessions` table)
- Renouvellement silencieux : `POST /auth/refresh` avant expiration

### Reset mot de passe

1. `POST /auth/reset-password` → corps `{ email, app: 'admin' | 'membre' }` → génère token (UUID, valable 1h), envoie email via Resend
2. Lien selon `app` :
   - admin → `https://admin-psalm.a-e-f.fr/admin/reset-password?token=<uuid>`
   - membre → `https://psalm.a-e-f.fr/reset-password?token=<uuid>`
3. `POST /auth/set-password` → valide token, met à jour le hash bcrypt

### Migration mots de passe Supabase

Supabase stocke les mots de passe en bcrypt — format compatible avec better-auth. Migration directe via `pg_dump` sans re-hashage.

---

## Endpoints Hono

Tous les endpoints sont protégés par middleware `requireAuth` (vérifie JWT). Les routes admin-only ont en plus `requireAdminRole`.

### Auth
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/reset-password
POST   /auth/set-password
```

### Membres
```
GET    /members                    ← getMembers()
POST   /members                    ← createMember()
PUT    /members/:id                ← updateMember()
DELETE /members/:id                ← deleteMember()
PUT    /members/:id/email          ← updateMemberEmail() (sync Auth)
```

### Planning
```
GET    /planning/:year             ← getPlanning(year)
GET    /planning/:year/:month      ← filtre mensuel
POST   /planning/sunday            ← createSunday()
PUT    /planning/sunday/:id        ← updateSunday()
DELETE /planning/sunday/:id        ← deleteSunday()
```

### Chants
```
GET    /songs                      ← getSongs()
POST   /songs                      ← createSong()
PUT    /songs/:id                  ← updateSong()
DELETE /songs/:id                  ← deleteSong()
POST   /songs/:id/partition        ← uploadPartition() → Minio
DELETE /songs/:id/partition        ← deletePartition()
```

### Divers
```
GET    /events                     ← getSpecialEvents()
POST   /events
PUT    /events/:id
DELETE /events/:id

GET    /permissions                ← getPermissions()
PUT    /permissions/:id

GET    /config                     ← getConfig()
PUT    /config/:key

GET    /absences                   ← getAbsences()
POST   /absences
DELETE /absences/:id

GET    /availabilities             ← getAvailabilities()
POST   /availabilities
PUT    /availabilities/:id
```

---

## Frontends — changements

### Principe

Supprimer `@supabase/supabase-js` des deux apps. Toute la communication passe par `fetch()` vers `api.a-e-f.fr`.

### PsalmAdmin — fichiers à modifier

| Fichier | Changement |
|---------|------------|
| `src/lib/supabase.ts` | **Supprimer** — remplacer par `src/lib/apiClient.ts` |
| `src/lib/api.ts` | Remplacer tous les appels `supabaseAdmin.from(...)` par `apiClient.get/post/put/delete(...)` |
| `src/contexts/AuthContext.tsx` | Remplacer `supabase.auth.*` par `POST /auth/login` et `/auth/refresh` |
| `src/pages/ResetPasswordPage.tsx` | Adapter pour token Hono (au lieu de Supabase Auth token) |
| `.env` Coolify | Supprimer `VITE_SUPABASE_*`, ajouter `VITE_API_URL=https://api.a-e-f.fr` |

### PsalmMembre — fichiers à modifier

| Fichier | Changement |
|---------|------------|
| `src/lib/supabase.ts` | **Supprimer** — remplacer par `src/lib/apiClient.ts` |
| `src/lib/api.ts` | Même refactor que PsalmAdmin |
| Auth context | Adapter pour JWT Hono |
| `src/pages/ResetPasswordPage.tsx` | **Créer** — page publique `/reset-password?token=<uuid>` (formulaire nouveau MDP) |
| `.env` Coolify | Supprimer `VITE_SUPABASE_*`, ajouter `VITE_API_URL` |

### `ApiClient` (partagé, à dupliquer dans les deux apps)

```typescript
// src/lib/apiClient.ts
const BASE = import.meta.env.VITE_API_URL;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('aef_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const apiClient = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
```

---

## Migration des données

### Stratégie progressive

Supabase reste **actif en lecture** pendant toute la migration. On bascule les apps sur Hono endpoint par endpoint, en validant chaque groupe avant de passer au suivant.

### Étapes

```bash
# 1. Export schéma depuis Supabase
pg_dump --schema-only "postgresql://..." > schema.sql

# 2. Nettoyage (supprimer extensions Supabase spécifiques, ajuster séquences)
# 3. Import sur PostgreSQL OVH
psql $DATABASE_URL < schema.sql

# 4. Export données (après validation complète des endpoints)
pg_dump --data-only "postgresql://..." > data.sql
psql $DATABASE_URL < data.sql

# 5. Vérification intégrité : counts par table, sample de profils
```

### Tables à migrer

`profiles` · `sundays` · `songs` · `events` · `permissions` · `config` · `absences` · `availabilities`

### Fichiers Minio

```bash
# Bucket Supabase : songs (partitions PDF, URLs publiques)
# Télécharger tous les fichiers via Supabase Storage API
# Ré-uploader dans bucket Minio : songs
# Mettre à jour les URLs dans la colonne songs.partition_url
# Ancien format : https://thwgkwsuukcyxjevtzxb.supabase.co/storage/v1/object/public/songs/...
# Nouveau format : https://minio.a-e-f.fr/songs/...
```

---

## Phases d'implémentation

| Phase | Contenu | Durée estimée |
|-------|---------|---------------|
| **1 — Infrastructure** | PostgreSQL + Hono skeleton + Minio sur Coolify, domaine `api.a-e-f.fr` | ~2 j |
| **2 — Auth** | better-auth, endpoints login/logout/refresh/reset, Resend emails | ~3 j |
| **3 — Endpoints data** | ~25 endpoints Hono + Drizzle, migration données | ~5 j |
| **4 — Frontends** | Supprimer Supabase SDK, connecter sur Hono dans les deux apps | ~4 j |
| **5 — Extinction** | Validation prod 48h, couper Supabase | ~1 j |
| **Total** | | **~15 jours** |

### Règle de progression

Chaque phase se termine par un déploiement Coolify et une validation fonctionnelle avant de passer à la suivante. Supabase reste en lecture jusqu'à la Phase 5.

---

## Gestion des erreurs & rollback

- **Rollback phases 1-3** : les frontends pointent toujours sur Supabase — aucun impact utilisateur
- **Rollback phase 4** : réactiver les variables `VITE_SUPABASE_*` dans Coolify + redéployer
- **Phase 5 irréversible** : uniquement après 48h de validation sans incident en prod

---

## Tests

- **Phase 2** : test des 5 endpoints auth (Postman/curl) avant de toucher les frontends
- **Phase 3** : test de chaque groupe d'endpoints avec des données réelles
- **Phase 4** : tests manuels sur toutes les pages critiques des deux apps (login, planning, membres, chants, reset password)
- **Phase 5** : monitoring des logs Coolify pendant 48h

---

## Dépendances

- **Spec 2 (Module IA)** doit attendre la fin de Phase 3 minimum — les endpoints Hono sont la fondation des outils Claude
- **PHP API** (`api-psalm.a-e-f.fr`) : investigation du code source de PsalmMembre confirme qu'elle utilise Supabase directement (plus de `fetch` vers l'API PHP). La PHP API est inactive. Elle peut être éteinte dès la Phase 5 sans impact.

---

## Décisions architecturales

| Décision | Choix | Alternative écartée | Raison |
|----------|-------|---------------------|--------|
| ORM | Drizzle | Prisma | Plus léger, SQL explicite, migrations sans magie |
| Auth | better-auth | Lucia, custom JWT | Mieux maintenu, reset password natif, TypeScript-first |
| Storage | Minio self-hosted | Cloudflare R2 | Déjà sur VPS, zéro coût, même infra Coolify |
| Emails | Resend | SMTP OVH | Meilleure délivrabilité, API simple, plan gratuit suffisant |
| Migration | Progressive | Big bang | Zéro risque de coupure utilisateur |
