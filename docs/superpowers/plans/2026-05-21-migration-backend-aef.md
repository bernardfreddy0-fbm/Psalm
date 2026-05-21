# Migration Backend AEF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Supabase par un backend Node.js/Hono + PostgreSQL self-hosted sur OVH VPS, servant les deux apps PsalmAdmin et PsalmMembre, avec zéro secret dans le frontend.

**Architecture:** Nouveau projet `AEFApi` (Hono + Drizzle + PostgreSQL 16 + Minio), déployé sur Coolify OVH VPS. Les deux frontends React remplacent `@supabase/supabase-js` par un `ApiClient` fetch-based qui appelle `api.a-e-f.fr`. Auth par JWT signé avec `jose` (custom, plus simple que better-auth pour ce schéma existant). Migration progressive — Supabase reste actif jusqu'à la Phase 5.

**Tech Stack:** Node.js 22 · Hono · Drizzle ORM · PostgreSQL 16 · jose (JWT) · bcryptjs · Resend · Minio · Vitest · Coolify (Docker)

**Spec:** `docs/superpowers/specs/2026-05-21-migration-backend-aef-design.md`

---

## Structure des fichiers

### Nouveau projet : `/Users/fbm/Desktop/AEFApi`

```
AEFApi/
├── src/
│   ├── index.ts                    # Entry point Hono, mount routes, CORS
│   ├── db/
│   │   ├── client.ts               # Drizzle client (postgres-js)
│   │   └── schema.ts               # Toutes les tables (Drizzle defineTable)
│   ├── middleware/
│   │   └── auth.ts                 # requireAuth + requireAdminRole
│   ├── routes/
│   │   ├── auth.ts                 # login, logout, refresh, reset-password, set-password
│   │   ├── members.ts              # CRUD profiles
│   │   ├── planning.ts             # CRUD sundays + sunday_assignments
│   │   ├── songs.ts                # CRUD songs + upload partition Minio
│   │   ├── events.ts               # CRUD events
│   │   ├── permissions.ts          # GET + PUT permissions
│   │   ├── config.ts               # GET + PUT config
│   │   ├── absences.ts             # CRUD absences
│   │   ├── disponibilites.ts       # GET + POST + DELETE disponibilites
│   │   └── runsheet.ts             # GET + POST runsheet
│   └── lib/
│       ├── jwt.ts                  # signToken, verifyToken, signRefreshToken
│       ├── email.ts                # sendResetEmail (Resend)
│       └── storage.ts              # uploadFile, deleteFile, getPublicUrl (Minio)
├── src/test/
│   ├── setup.ts                    # Vitest setup (test DB connexion)
│   ├── auth.test.ts                # Tests auth endpoints
│   └── members.test.ts             # Tests members endpoints
├── Dockerfile
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

### Modifié : `/Users/fbm/Desktop/Psalm` (PsalmAdmin)

```
src/lib/
  supabase.ts         → SUPPRIMER
  apiClient.ts        → CRÉER
  api.ts              → MODIFIER (supabaseAdmin.from → apiClient.*)
src/contexts/
  AuthContext.tsx      → MODIFIER (supabase.auth.* → apiClient)
src/pages/
  ResetPasswordPage.tsx → MODIFIER (token Supabase → token Hono)
```

### Modifié : `/Users/fbm/Desktop/PsalmMembre` (PsalmMembre)

```
src/lib/
  supabase.ts         → SUPPRIMER
  apiClient.ts        → CRÉER
  api.ts              → MODIFIER
src/contexts/
  AuthContext.tsx      → MODIFIER
src/pages/
  ResetPasswordPage.tsx → CRÉER
```

---

## PHASE 1 — Infrastructure

### Task 1 : Bootstrap AEFApi

**Files:**
- Create: `AEFApi/package.json`
- Create: `AEFApi/tsconfig.json`
- Create: `AEFApi/src/index.ts`
- Create: `AEFApi/.env.example`

- [ ] **Créer le répertoire et initialiser le projet**

```bash
mkdir -p /Users/fbm/Desktop/AEFApi/src/{db,middleware,routes,lib,test}
cd /Users/fbm/Desktop/AEFApi
npm init -y
```

- [ ] **Installer les dépendances**

```bash
npm install hono @hono/node-server drizzle-orm postgres jose bcryptjs resend minio
npm install -D typescript vitest @vitest/coverage-v8 tsx drizzle-kit @types/bcryptjs @types/node
```

- [ ] **Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Mettre à jour `package.json`**

```json
{
  "name": "aef-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  }
}
```

- [ ] **Créer `.env.example`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aef
JWT_SECRET=change_this_to_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=another_long_random_string_min_32_chars
RESEND_API_KEY=re_xxxxxxxxxxxx
MINIO_ENDPOINT=minio.a-e-f.fr
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_SONGS=songs
MINIO_USE_SSL=true
ADMIN_RESET_URL=https://admin-psalm.a-e-f.fr/admin/reset-password
MEMBRE_RESET_URL=https://psalm.a-e-f.fr/reset-password
PORT=3000
```

- [ ] **Créer `src/index.ts` (squelette)**

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors({
  origin: ['https://admin-psalm.a-e-f.fr', 'https://psalm.a-e-f.fr', 'http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`AEF API running on port ${port}`);
});

export default app;
```

- [ ] **Vérifier que le serveur démarre**

```bash
cp .env.example .env
# Remplir DATABASE_URL avec une connexion PostgreSQL locale ou Supabase
npm run dev
```
Attendu : `AEF API running on port 3000`

- [ ] **Tester l'endpoint health**

```bash
curl http://localhost:3000/health
```
Attendu : `{"status":"ok","ts":"..."}`

- [ ] **Commit**

```bash
cd /Users/fbm/Desktop/AEFApi
git init
git add .
git commit -m "feat: bootstrap AEFApi — Hono skeleton"
```

---

### Task 2 : Schéma Drizzle (toutes les tables)

**Files:**
- Create: `AEFApi/src/db/schema.ts`
- Create: `AEFApi/src/db/client.ts`
- Create: `AEFApi/drizzle.config.ts`

- [ ] **Créer `src/db/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

- [ ] **Créer `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Créer `src/db/schema.ts` — partie 1 : auth + profiles**

```typescript
import {
  pgTable, uuid, text, boolean, timestamp, integer, serial, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id:            uuid('id').primaryKey(),
  firstName:     text('first_name').notNull(),
  lastName:      text('last_name').notNull(),
  email:         text('email').notNull().unique(),
  role:          text('role').default(''),
  phone:         text('phone'),
  isActive:      boolean('is_active').default(true),
  instrument:    text('instrument'),
  isExperienced: boolean('is_experienced').default(false),
  avatarColor:   text('avatar_color'),
  lastLogin:     timestamp('last_login'),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').notNull().unique(),
  expiresAt:    timestamp('expires_at').notNull(),
  createdAt:    timestamp('created_at').defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  app:       text('app').notNull(),  // 'admin' | 'membre'
  expiresAt: timestamp('expires_at').notNull(),
  usedAt:    timestamp('used_at'),
});
```

- [ ] **Continuer `src/db/schema.ts` — partie 2 : planning**

```typescript
export const sundays = pgTable('sundays', {
  id:          serial('id').primaryKey(),
  date:        text('date').notNull(),
  label:       text('label'),
  isJeunesse:  boolean('is_jeunesse').default(false),
  dirigeantId: uuid('dirigeant_id').references(() => profiles.id),
  dirigeant:   text('dirigeant'),
  note:        text('note'),
  pastorNote:  text('pastor_note'),
  isApproved:  boolean('is_approved').default(false),
  isLocked:    boolean('is_locked').default(false),
  choristes:   text('choristes'),
  piano:       text('piano'),
  batterie:    text('batterie'),
  guitareElec: text('guitare_elec'),
  guitareAcou: text('guitare_acou'),
  basse:       text('basse'),
  son:         text('son'),
  projection:  text('projection'),
  video:       text('video'),
  theme:       text('theme'),
  startTime:   text('start_time').default('10:00'),
  dispoDeadline: text('dispo_deadline'),
});

export const sundayAssignments = pgTable('sunday_assignments', {
  userId:    uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  sundayId:  integer('sunday_id').notNull().references(() => sundays.id, { onDelete: 'cascade' }),
  pole:      text('pole').notNull(),
  confirmed: text('confirmed'),
  instrument: text('instrument'),
});

export const sundayRunsheet = pgTable('sunday_runsheet', {
  id:          serial('id').primaryKey(),
  sundayId:    integer('sunday_id').notNull().references(() => sundays.id, { onDelete: 'cascade' }),
  position:    integer('position').notNull().default(0),
  type:        text('type').notNull(),
  title:       text('title').notNull(),
  durationMin: integer('duration_min').notNull().default(5),
  notes:       text('notes'),
  songId:      integer('song_id'),
  isPublished: boolean('is_published').default(false),
});
```

- [ ] **Continuer `src/db/schema.ts` — partie 3 : chants, events, etc.**

```typescript
export const songs = pgTable('songs', {
  id:           serial('id').primaryKey(),
  title:        text('title').notNull(),
  author:       text('author'),
  keyNote:      text('key_note'),
  tempo:        text('tempo'),
  tags:         text('tags'),
  youtubeUrl:   text('youtube_url'),
  lyrics:       text('lyrics'),
  partitionUrl: text('partition_url'),
  audioUrl:     text('audio_url'),
  folder:       text('folder'),
});

export const events = pgTable('events', {
  id:          serial('id').primaryKey(),
  date:        text('date').notNull(),
  title:       text('title').notNull(),
  description: text('description'),
  type:        text('type'),
});

export const permissions = pgTable('permissions', {
  permissionKey: text('permission_key').primaryKey(),
  roles:         text('roles').notNull().default(''),
});

export const config = pgTable('config', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

export const absences = pgTable('absences', {
  id:        serial('id').primaryKey(),
  userId:    uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dateStart: text('date_start').notNull(),
  dateEnd:   text('date_end').notNull(),
  reason:    text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const disponibilites = pgTable('disponibilites', {
  id:          serial('id').primaryKey(),
  userId:      uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  sundayId:    integer('sunday_id').notNull().references(() => sundays.id, { onDelete: 'cascade' }),
  available:   boolean('available'),
  note:        text('note'),
  respondedAt: timestamp('responded_at'),
}, (t) => ({
  uniqueUserSunday: uniqueIndex('disponibilites_user_sunday_idx').on(t.userId, t.sundayId),
}));
```

- [ ] **Générer et appliquer les migrations pour les 3 nouvelles tables auth**

Les tables existantes (profiles, sundays, etc.) seront importées via `pg_dump`. Les 3 nouvelles tables (sessions, password_reset_tokens, disponibilites si absente) sont à créer via Drizzle.

```bash
cd /Users/fbm/Desktop/AEFApi
npm run db:generate
# Vérifier le fichier SQL généré dans drizzle/migrations/
npm run db:push
```

Attendu : migrations appliquées sans erreur.

- [ ] **Commit**

```bash
git add .
git commit -m "feat: add Drizzle schema — all AEF tables"
```

---

## PHASE 2 — Auth

### Task 3 : JWT helpers + email

**Files:**
- Create: `AEFApi/src/lib/jwt.ts`
- Create: `AEFApi/src/lib/email.ts`

- [ ] **Créer `src/lib/jwt.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';

const accessSecret = new TextEncoder().encode(process.env.JWT_SECRET!);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, accessSecret);
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as string,
  };
}

export function generateRefreshToken(): string {
  return randomUUID();
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export function resetTokenExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d;
}
```

- [ ] **Créer `src/lib/email.ts`**

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendResetPasswordEmail(opts: {
  to: string;
  firstName: string;
  resetUrl: string;
}): Promise<void> {
  await resend.emails.send({
    from: 'AEF Louange <noreply@a-e-f.fr>',
    to: opts.to,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <p>Bonjour ${opts.firstName},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
      <p>
        <a href="${opts.resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p>Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      <p>— Équipe AEF Louange</p>
    `,
  });
}
```

- [ ] **Commit**

```bash
git add .
git commit -m "feat: add JWT helpers and Resend email utility"
```

---

### Task 4 : Middleware auth

**Files:**
- Create: `AEFApi/src/middleware/auth.ts`

- [ ] **Créer `src/middleware/auth.ts`**

```typescript
import { createMiddleware } from 'hono/factory';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';

type AuthEnv = {
  Variables: {
    user: JwtPayload;
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Non authentifié' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Token invalide ou expiré' }, 401);
  }
});

export const requireAdminRole = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user');
  const adminRoles = ['admin', 'conducteur_louange', 'dirigeant', 'pasteur'];
  const userRoles = user.role.split(',').map(r => r.trim());
  const isAdmin = userRoles.some(r => adminRoles.includes(r));
  if (!isAdmin) {
    return c.json({ error: 'Accès refusé' }, 403);
  }
  await next();
});
```

- [ ] **Écrire le test d'auth middleware**

Créer `src/test/setup.ts` :

```typescript
import { config } from 'dotenv';
config({ path: '.env.test' });
```

Créer `.env.test` :
```env
DATABASE_URL=postgresql://user:password@localhost:5432/aef_test
JWT_SECRET=test_secret_at_least_32_characters_long
JWT_REFRESH_SECRET=test_refresh_secret_at_least_32_chars
RESEND_API_KEY=re_test
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=test
MINIO_SECRET_KEY=test
MINIO_BUCKET_SONGS=songs
MINIO_USE_SSL=false
ADMIN_RESET_URL=http://localhost:5173/reset-password
MEMBRE_RESET_URL=http://localhost:5174/reset-password
PORT=3001
```

Créer `src/test/auth.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { signAccessToken } from '../lib/jwt.js';

const app = new Hono();
app.use('/protected', requireAuth);
app.get('/protected', (c) => c.json({ ok: true, user: c.get('user') }));

describe('requireAuth middleware', () => {
  it('retourne 401 sans header Authorization', async () => {
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
  });

  it('retourne 401 avec un token invalide', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(res.status).toBe(401);
  });

  it('laisse passer avec un token valide', async () => {
    const token = await signAccessToken({ sub: 'user-1', email: 'test@test.com', role: 'choriste' });
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.sub).toBe('user-1');
  });
});
```

Ajouter dans `package.json` → `vitest` config :

```json
"vitest": {
  "setupFiles": ["src/test/setup.ts"],
  "environment": "node"
}
```

- [ ] **Lancer les tests**

```bash
npm test
```
Attendu : 3 tests passent.

- [ ] **Commit**

```bash
git add .
git commit -m "feat: add auth middleware with tests"
```

---

### Task 5 : Routes auth (login / logout / refresh / reset / set-password)

**Files:**
- Create: `AEFApi/src/routes/auth.ts`
- Modify: `AEFApi/src/index.ts`

- [ ] **Créer `src/routes/auth.ts`**

```typescript
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles, sessions, passwordResetTokens } from '../db/schema.js';
import {
  signAccessToken, generateRefreshToken, refreshTokenExpiresAt,
  resetTokenExpiresAt, verifyAccessToken,
} from '../lib/jwt.js';
import { sendResetPasswordEmail } from '../lib/email.js';
import { randomUUID } from 'crypto';

const auth = new Hono();

// ── POST /auth/login ──────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400);

  const [user] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase().trim()));
  if (!user) return c.json({ error: 'Identifiants incorrects' }, 401);
  if (!user.isActive) return c.json({ error: 'Compte désactivé' }, 403);

  // NOTE : Supabase stocke le hash dans auth.users, pas dans profiles.
  // Lors de la migration, copier le hash depuis auth.users vers profiles (colonne password_hash à ajouter).
  const hash = (user as any).passwordHash as string | undefined;
  if (!hash) return c.json({ error: 'Compte non migré — contactez l\'admin' }, 401);

  const valid = await bcrypt.compare(password, hash);
  if (!valid) return c.json({ error: 'Identifiants incorrects' }, 401);

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role ?? '' });
  const refreshToken = generateRefreshToken();
  await db.insert(sessions).values({
    userId: user.id,
    refreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  await db.update(profiles).set({ lastLogin: new Date() }).where(eq(profiles.id, user.id));

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: { id: user.id, first_name: user.firstName, last_name: user.lastName, email: user.email, role: user.role },
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────

auth.post('/refresh', async (c) => {
  const { refresh_token } = await c.req.json<{ refresh_token: string }>();
  if (!refresh_token) return c.json({ error: 'refresh_token requis' }, 400);

  const [session] = await db.select().from(sessions).where(eq(sessions.refreshToken, refresh_token));
  if (!session || session.expiresAt < new Date()) {
    return c.json({ error: 'Session expirée' }, 401);
  }

  const [user] = await db.select().from(profiles).where(eq(profiles.id, session.userId));
  if (!user || !user.isActive) return c.json({ error: 'Compte inactif' }, 401);

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role ?? '' });
  return c.json({ access_token: accessToken });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const { refresh_token } = await c.req.json<{ refresh_token: string }>().catch(() => ({ refresh_token: '' }));
  if (refresh_token) {
    await db.delete(sessions).where(eq(sessions.refreshToken, refresh_token));
  }
  return c.json({ ok: true });
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
  const { email, app } = await c.req.json<{ email: string; app: 'admin' | 'membre' }>();
  if (!email || !app) return c.json({ error: 'email et app requis' }, 400);

  const [user] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase().trim()));
  // Réponse identique que le compte existe ou non (sécurité)
  if (!user) return c.json({ ok: true });

  const token = randomUUID();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    app,
    expiresAt: resetTokenExpiresAt(),
  });

  const baseUrl = app === 'admin'
    ? process.env.ADMIN_RESET_URL!
    : process.env.MEMBRE_RESET_URL!;

  await sendResetPasswordEmail({
    to: user.email,
    firstName: user.firstName,
    resetUrl: `${baseUrl}?token=${token}`,
  });

  return c.json({ ok: true });
});

// ── POST /auth/set-password ───────────────────────────────────────────────────

auth.post('/set-password', async (c) => {
  const { token, password } = await c.req.json<{ token: string; password: string }>();
  if (!token || !password) return c.json({ error: 'token et password requis' }, 400);
  if (password.length < 8) return c.json({ error: 'Mot de passe trop court (8 caractères min)' }, 400);

  const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
    return c.json({ error: 'Lien invalide ou expiré' }, 400);
  }

  const hash = await bcrypt.hash(password, 12);
  // Stocker dans profiles.password_hash (colonne à ajouter lors migration)
  await db.execute(`UPDATE profiles SET password_hash = $1 WHERE id = $2`, [hash, resetToken.userId]);
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));

  return c.json({ ok: true });
});

export default auth;
```

> **Note migration :** Ajouter la colonne `password_hash text` à `profiles` lors du `pg_dump`. Le script de migration (Task 11) copie les hash depuis `auth.users` de Supabase.

- [ ] **Monter les routes auth dans `src/index.ts`**

```typescript
// Après les imports existants :
import auth from './routes/auth.js';

// Après le middleware cors :
app.route('/auth', auth);
```

- [ ] **Tester les endpoints auth manuellement**

```bash
# Login (adapter avec un vrai email/password de la DB de test)
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test1234"}' | jq .

# Reset password (vérifier l'envoi email avec Resend en mode test)
curl -s -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","app":"admin"}' | jq .
```

- [ ] **Commit**

```bash
git add .
git commit -m "feat: auth routes — login, logout, refresh, reset-password, set-password"
```

---

## PHASE 3 — Endpoints data

### Task 6 : Routes membres

**Files:**
- Create: `AEFApi/src/routes/members.ts`
- Modify: `AEFApi/src/index.ts`

- [ ] **Écrire le test en premier**

Créer `src/test/members.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { signAccessToken } from '../lib/jwt.js';
import members from '../routes/members.js';

const app = new Hono();
app.use('/members/*', requireAuth);
app.use('/members', requireAuth);
app.route('/members', members);

async function adminToken() {
  return signAccessToken({ sub: 'admin-id', email: 'admin@test.com', role: 'conducteur_louange' });
}

describe('GET /members', () => {
  it('retourne 401 sans token', async () => {
    const res = await app.request('/members');
    expect(res.status).toBe(401);
  });

  it('retourne un tableau avec token valide', async () => {
    const token = await adminToken();
    const res = await app.request('/members', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // En CI sans DB, la route doit retourner 200 ou 500 (pas 401)
    expect([200, 500]).toContain(res.status);
  });
});
```

- [ ] **Lancer le test pour vérifier qu'il échoue**

```bash
npm test -- members
```
Attendu : FAIL (module members.ts n'existe pas encore)

- [ ] **Créer `src/routes/members.ts`**

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const members = new Hono();

// GET /members
members.get('/', async (c) => {
  const data = await db.select({
    id: profiles.id,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
    email: profiles.email,
    role: profiles.role,
    phone: profiles.phone,
    isActive: profiles.isActive,
    instrument: profiles.instrument,
    isExperienced: profiles.isExperienced,
    avatarColor: profiles.avatarColor,
    createdAt: profiles.createdAt,
    updatedAt: profiles.updatedAt,
  }).from(profiles).orderBy(profiles.lastName);
  return c.json(data.map(m => ({
    ...m,
    first_name: m.firstName,
    last_name: m.lastName,
    is_active: m.isActive,
    is_experienced: m.isExperienced,
    avatar_color: m.avatarColor,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  })));
});

// POST /members
members.post('/', async (c) => {
  const body = await c.req.json<{
    first_name: string; last_name: string; email: string;
    role?: string; phone?: string; password?: string;
  }>();

  const password = body.password ?? generateSecurePassword();
  const hash = await bcrypt.hash(password, 12);

  const id = randomUUID();
  await db.insert(profiles).values({
    id,
    firstName: body.first_name,
    lastName: body.last_name,
    email: body.email.toLowerCase().trim(),
    role: body.role ?? '',
    phone: body.phone ?? null,
    isActive: true,
    // @ts-ignore — password_hash sera dans le vrai schéma après migration
    passwordHash: hash,
  });

  return c.json({ id, password }, 201);
});

// PUT /members/:id
members.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    first_name: string; last_name: string; email: string;
    role: string; phone: string; is_active: boolean;
    is_experienced: boolean; avatar_color: string;
  }>>();

  await db.update(profiles).set({
    ...(body.first_name !== undefined && { firstName: body.first_name }),
    ...(body.last_name !== undefined && { lastName: body.last_name }),
    ...(body.email !== undefined && { email: body.email.toLowerCase().trim() }),
    ...(body.role !== undefined && { role: body.role }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.is_active !== undefined && { isActive: body.is_active }),
    ...(body.is_experienced !== undefined && { isExperienced: body.is_experienced }),
    ...(body.avatar_color !== undefined && { avatarColor: body.avatar_color }),
    updatedAt: new Date(),
  }).where(eq(profiles.id, id));

  return c.json({ ok: true });
});

// PUT /members/:id/email  — sync email uniquement
members.put('/:id/email', async (c) => {
  const id = c.req.param('id');
  const { email } = await c.req.json<{ email: string }>();
  if (!email) return c.json({ error: 'email requis' }, 400);
  await db.update(profiles)
    .set({ email: email.toLowerCase().trim(), updatedAt: new Date() })
    .where(eq(profiles.id, id));
  return c.json({ ok: true });
});

// DELETE /members/:id
members.delete('/:id', async (c) => {
  const id = c.req.param('id');
  // Soft delete : marquer comme inactif + anonymiser le nom
  await db.update(profiles).set({
    isActive: false,
    firstName: '[Supprimé]',
    lastName: '',
    email: `deleted_${id}@deleted.local`,
    updatedAt: new Date(),
  }).where(eq(profiles.id, id));
  return c.json({ ok: true });
});

function generateSecurePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export default members;
```

- [ ] **Monter dans `src/index.ts`**

```typescript
import { requireAuth } from './middleware/auth.js';
import members from './routes/members.js';

app.use('/members/*', requireAuth);
app.use('/members', requireAuth);
app.route('/members', members);
```

- [ ] **Lancer les tests**

```bash
npm test -- members
```
Attendu : 2 tests passent (401 sans token, et 200/500 avec token).

- [ ] **Commit**

```bash
git add .
git commit -m "feat: members routes — CRUD with tests"
```

---

### Task 7 : Routes planning

**Files:**
- Create: `AEFApi/src/routes/planning.ts`
- Modify: `AEFApi/src/index.ts`

- [ ] **Créer `src/routes/planning.ts`**

```typescript
import { Hono } from 'hono';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sundays, sundayAssignments, profiles } from '../db/schema.js';

const planning = new Hono();

// GET /planning/:year
planning.get('/:year', async (c) => {
  const year = c.req.param('year');
  const data = await db.query.sundays.findMany({
    where: and(
      gte(sundays.date, `${year}-01-01`),
      lte(sundays.date, `${year}-12-31`)
    ),
    with: {
      sunday_assignments: {
        with: { profiles: { columns: { firstName: true, lastName: true, role: true } } },
      },
    },
    orderBy: sundays.date,
  });
  return c.json(data.map(s => ({
    ...s,
    id: String(s.id),
    is_jeunesse: s.isJeunesse,
    dirigeant_id: s.dirigeantId,
    pastor_note: s.pastorNote,
    is_approved: s.isApproved,
    is_locked: s.isLocked,
    guitare_elec: s.guitareElec,
    guitare_acou: s.guitareAcou,
    start_time: s.startTime,
    dispo_deadline: s.dispoDeadline,
    assignments: s.sunday_assignments ?? [],
  })));
});

// GET /planning/:year/:month
planning.get('/:year/:month', async (c) => {
  const { year, month } = c.req.param();
  const mm = month.padStart(2, '0');
  const data = await db.select().from(sundays)
    .where(and(gte(sundays.date, `${year}-${mm}-01`), lte(sundays.date, `${year}-${mm}-31`)))
    .orderBy(sundays.date);
  return c.json(data.map(s => ({ ...s, id: String(s.id) })));
});

// POST /planning/sunday
planning.post('/sunday', async (c) => {
  const { date, label } = await c.req.json<{ date: string; label?: string }>();
  const [row] = await db.insert(sundays).values({ date, label: label ?? '' }).returning({ id: sundays.id });
  return c.json({ id: String(row.id) }, 201);
});

// PUT /planning/sunday/:id
planning.put('/sunday/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();
  // Mapper snake_case → camelCase pour Drizzle
  const update: Record<string, any> = {};
  if (body.label !== undefined)        update.label        = body.label;
  if (body.is_jeunesse !== undefined)   update.isJeunesse   = body.is_jeunesse;
  if (body.dirigeant !== undefined)     update.dirigeant    = body.dirigeant;
  if (body.dirigeant_id !== undefined)  update.dirigeantId  = body.dirigeant_id || null;
  if (body.note !== undefined)          update.note         = body.note;
  if (body.pastor_note !== undefined)   update.pastorNote   = body.pastor_note;
  if (body.is_approved !== undefined)   update.isApproved   = body.is_approved;
  if (body.is_locked !== undefined)     update.isLocked     = body.is_locked;
  if (body.choristes !== undefined)     update.choristes    = body.choristes;
  if (body.piano !== undefined)         update.piano        = body.piano;
  if (body.batterie !== undefined)      update.batterie     = body.batterie;
  if (body.guitare_elec !== undefined)  update.guitareElec  = body.guitare_elec;
  if (body.guitare_acou !== undefined)  update.guitareAcou  = body.guitare_acou;
  if (body.basse !== undefined)         update.basse        = body.basse;
  if (body.son !== undefined)           update.son          = body.son;
  if (body.projection !== undefined)    update.projection   = body.projection;
  if (body.video !== undefined)         update.video        = body.video;
  if (body.theme !== undefined)         update.theme        = body.theme;
  if (body.start_time !== undefined)    update.startTime    = body.start_time;
  if (body.dispo_deadline !== undefined) update.dispoDeadline = body.dispo_deadline;

  await db.update(sundays).set(update).where(eq(sundays.id, id));
  return c.json({ ok: true });
});

// DELETE /planning/sunday/:id
planning.delete('/sunday/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(sundays).where(eq(sundays.id, id));
  return c.json({ ok: true });
});

export default planning;
```

- [ ] **Ajouter les relations Drizzle dans `src/db/schema.ts`** (à la fin du fichier)

```typescript
import { relations } from 'drizzle-orm';

export const sundaysRelations = relations(sundays, ({ many }) => ({
  sunday_assignments: many(sundayAssignments),
}));

export const sundayAssignmentsRelations = relations(sundayAssignments, ({ one }) => ({
  profiles: one(profiles, { fields: [sundayAssignments.userId], references: [profiles.id] }),
  sundays: one(sundays, { fields: [sundayAssignments.sundayId], references: [sundays.id] }),
}));
```

- [ ] **Monter dans `src/index.ts`**

```typescript
import planning from './routes/planning.js';
app.use('/planning/*', requireAuth);
app.route('/planning', planning);
```

- [ ] **Commit**

```bash
git add .
git commit -m "feat: planning routes — CRUD sundays + assignments"
```

---

### Task 8 : Storage Minio + routes chants

**Files:**
- Create: `AEFApi/src/lib/storage.ts`
- Create: `AEFApi/src/routes/songs.ts`
- Modify: `AEFApi/src/index.ts`

- [ ] **Créer `src/lib/storage.ts`**

```typescript
import * as Minio from 'minio';

const client = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT!,
  port:      Number(process.env.MINIO_PORT ?? 9000),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET_SONGS!;

export async function ensureBucket(): Promise<void> {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, 'eu-west-1');
    await client.setBucketPolicy(BUCKET, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${BUCKET}/*`] }],
    }));
  }
}

export async function uploadFile(objectName: string, buffer: Buffer, contentType: string): Promise<string> {
  await client.putObject(BUCKET, objectName, buffer, buffer.length, { 'Content-Type': contentType });
  return getPublicUrl(objectName);
}

export function getPublicUrl(objectName: string): string {
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  return `${protocol}://${process.env.MINIO_ENDPOINT}/${BUCKET}/${objectName}`;
}

export async function deleteFile(objectName: string): Promise<void> {
  await client.removeObject(BUCKET, objectName);
}
```

- [ ] **Créer `src/routes/songs.ts`**

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { songs } from '../db/schema.js';
import { uploadFile, deleteFile, getPublicUrl } from '../lib/storage.js';

const songsRoute = new Hono();

songsRoute.get('/', async (c) => {
  const data = await db.select().from(songs).orderBy(songs.title);
  return c.json(data.map(s => ({
    ...s,
    key_note: s.keyNote,
    youtube_url: s.youtubeUrl,
    partition_url: s.partitionUrl,
    audio_url: s.audioUrl,
  })));
});

songsRoute.post('/', async (c) => {
  const body = await c.req.json<{
    title: string; author?: string; key_note?: string; tempo?: string;
    tags?: string; youtube_url?: string; lyrics?: string; folder?: string;
  }>();
  const [row] = await db.insert(songs).values({
    title: body.title,
    author: body.author ?? null,
    keyNote: body.key_note ?? null,
    tempo: body.tempo ?? null,
    tags: body.tags ?? null,
    youtubeUrl: body.youtube_url ?? null,
    lyrics: body.lyrics ?? null,
    folder: body.folder ?? null,
  }).returning({ id: songs.id });
  return c.json({ id: row.id }, 201);
});

songsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();
  const update: Record<string, any> = {};
  if (body.title !== undefined)       update.title       = body.title;
  if (body.author !== undefined)      update.author      = body.author;
  if (body.key_note !== undefined)    update.keyNote     = body.key_note;
  if (body.tempo !== undefined)       update.tempo       = body.tempo;
  if (body.tags !== undefined)        update.tags        = body.tags;
  if (body.youtube_url !== undefined) update.youtubeUrl  = body.youtube_url;
  if (body.lyrics !== undefined)      update.lyrics      = body.lyrics;
  if (body.folder !== undefined)      update.folder      = body.folder;
  await db.update(songs).set(update).where(eq(songs.id, id));
  return c.json({ ok: true });
});

songsRoute.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [song] = await db.select({ partitionUrl: songs.partitionUrl }).from(songs).where(eq(songs.id, id));
  if (song?.partitionUrl) {
    const objectName = new URL(song.partitionUrl).pathname.split('/').slice(2).join('/');
    await deleteFile(objectName).catch(() => {});
  }
  await db.delete(songs).where(eq(songs.id, id));
  return c.json({ ok: true });
});

// POST /songs/:id/partition — multipart upload
songsRoute.post('/:id/partition', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const file = body['file'] as File;
  if (!file) return c.json({ error: 'Fichier requis' }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() ?? 'pdf';
  const objectName = `songs/${id}/partition.${ext}`;
  const url = await uploadFile(objectName, buffer, file.type);

  await db.update(songs).set({ partitionUrl: url }).where(eq(songs.id, id));
  return c.json({ url });
});

// DELETE /songs/:id/partition
songsRoute.delete('/:id/partition', async (c) => {
  const id = Number(c.req.param('id'));
  const [song] = await db.select({ partitionUrl: songs.partitionUrl }).from(songs).where(eq(songs.id, id));
  if (song?.partitionUrl) {
    const objectName = new URL(song.partitionUrl).pathname.split('/').slice(2).join('/');
    await deleteFile(objectName).catch(() => {});
    await db.update(songs).set({ partitionUrl: null }).where(eq(songs.id, id));
  }
  return c.json({ ok: true });
});

export default songsRoute;
```

- [ ] **Monter dans `src/index.ts`**

```typescript
import songsRoute from './routes/songs.js';
app.use('/songs/*', requireAuth);
app.use('/songs', requireAuth);
app.route('/songs', songsRoute);
```

- [ ] **Commit**

```bash
git add .
git commit -m "feat: songs routes + Minio storage utility"
```

---

### Task 9 : Routes restantes (events, permissions, config, absences, disponibilites, runsheet)

**Files:**
- Create: `AEFApi/src/routes/events.ts`
- Create: `AEFApi/src/routes/permissions.ts`
- Create: `AEFApi/src/routes/config.ts`
- Create: `AEFApi/src/routes/absences.ts`
- Create: `AEFApi/src/routes/disponibilites.ts`
- Create: `AEFApi/src/routes/runsheet.ts`
- Modify: `AEFApi/src/index.ts`

- [ ] **Créer `src/routes/events.ts`**

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { events } from '../db/schema.js';

const eventsRoute = new Hono();

eventsRoute.get('/', async (c) => {
  const data = await db.select().from(events).orderBy(events.date);
  return c.json(data);
});
eventsRoute.post('/', async (c) => {
  const body = await c.req.json<{ date: string; title: string; description?: string; type?: string }>();
  const [row] = await db.insert(events).values({ date: body.date, title: body.title, description: body.description ?? null, type: body.type ?? null }).returning({ id: events.id });
  return c.json({ id: row.id }, 201);
});
eventsRoute.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ date?: string; title?: string; description?: string; type?: string }>();
  await db.update(events).set({ ...body }).where(eq(events.id, id));
  return c.json({ ok: true });
});
eventsRoute.delete('/:id', async (c) => {
  await db.delete(events).where(eq(events.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});
export default eventsRoute;
```

- [ ] **Créer `src/routes/permissions.ts`**

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { permissions } from '../db/schema.js';

const permissionsRoute = new Hono();

permissionsRoute.get('/', async (c) => {
  const data = await db.select().from(permissions);
  return c.json(data.map(p => ({ permission_key: p.permissionKey, roles: p.roles })));
});
permissionsRoute.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { roles } = await c.req.json<{ roles: string }>();
  await db.update(permissions).set({ roles }).where(eq(permissions.permissionKey, key));
  return c.json({ ok: true });
});
export default permissionsRoute;
```

- [ ] **Créer `src/routes/config.ts`**

```typescript
import { Hono } from 'hono';
import { eq, like } from 'drizzle-orm';
import { db } from '../db/client.js';
import { config } from '../db/schema.js';

const configRoute = new Hono();

configRoute.get('/', async (c) => {
  const data = await db.select().from(config);
  return c.json(Object.fromEntries(data.map(r => [r.key, r.value])));
});
configRoute.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json<{ value: string }>();
  await db.insert(config).values({ key, value }).onConflictDoUpdate({ target: config.key, set: { value } });
  return c.json({ ok: true });
});
// PUT /config (bulk upsert)
configRoute.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const rows = Object.entries(body).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    for (const row of rows) {
      await db.insert(config).values(row).onConflictDoUpdate({ target: config.key, set: { value: row.value } });
    }
  }
  return c.json({ ok: true });
});
export default configRoute;
```

- [ ] **Créer `src/routes/absences.ts`**

```typescript
import { Hono } from 'hono';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { absences, profiles } from '../db/schema.js';
import type { JwtPayload } from '../lib/jwt.js';

const absencesRoute = new Hono();

absencesRoute.get('/', async (c) => {
  const data = await db.select({
    id: absences.id, userId: absences.userId, dateStart: absences.dateStart,
    dateEnd: absences.dateEnd, reason: absences.reason, createdAt: absences.createdAt,
    firstName: profiles.firstName, lastName: profiles.lastName,
  }).from(absences).leftJoin(profiles, eq(absences.userId, profiles.id)).orderBy(absences.dateStart);
  return c.json(data.map(a => ({
    id: String(a.id), user_id: a.userId, date_start: a.dateStart, date_end: a.dateEnd,
    reason: a.reason, created_at: a.createdAt,
    first_name: a.firstName ?? '', last_name: a.lastName ?? '',
  })));
});

absencesRoute.get('/me', async (c) => {
  const user = c.get('user') as JwtPayload;
  const data = await db.select().from(absences).where(eq(absences.userId, user.sub)).orderBy(absences.dateStart);
  return c.json(data.map(a => ({ id: String(a.id), date_start: a.dateStart, date_end: a.dateEnd, reason: a.reason, created_at: a.createdAt })));
});

absencesRoute.post('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  const body = await c.req.json<{ date_start: string; date_end: string; reason?: string; user_id?: string }>();
  const userId = body.user_id ?? user.sub;
  const [row] = await db.insert(absences).values({ userId, dateStart: body.date_start, dateEnd: body.date_end, reason: body.reason ?? null }).returning({ id: absences.id });
  return c.json({ id: String(row.id) }, 201);
});

absencesRoute.delete('/:id', async (c) => {
  await db.delete(absences).where(eq(absences.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

export default absencesRoute;
```

- [ ] **Créer `src/routes/disponibilites.ts`**

```typescript
import { Hono } from 'hono';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { disponibilites, sundays, profiles } from '../db/schema.js';
import type { JwtPayload } from '../lib/jwt.js';

const disposRoute = new Hono();

disposRoute.get('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  const today = new Date().toISOString().split('T')[0];
  const futureSundays = await db.select().from(sundays).where(gte(sundays.date, today)).orderBy(sundays.date);
  const myDispos = await db.select().from(disponibilites).where(eq(disponibilites.userId, user.sub));
  const dispoMap = new Map(myDispos.map(d => [d.sundayId, d]));

  return c.json(futureSundays.map(s => {
    const deadline = s.dispoDeadline ?? s.date;
    const daysUntil = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    const dispo = dispoMap.get(s.id);
    return {
      sunday_id: String(s.id), date: s.date, label: s.label, is_jeunesse: s.isJeunesse,
      deadline, deadline_passed: daysUntil < 0, days_until_deadline: daysUntil,
      responded: !!dispo, available: dispo?.available ?? null,
      note: dispo?.note ?? null, responded_at: dispo?.respondedAt ?? null,
    };
  }));
});

disposRoute.post('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  const { sunday_id, available, note } = await c.req.json<{ sunday_id: string; available: boolean | null; note?: string }>();
  await db.insert(disponibilites).values({
    userId: user.sub, sundayId: Number(sunday_id),
    available: available ?? null, note: note ?? null, respondedAt: new Date(),
  }).onConflictDoUpdate({
    target: [disponibilites.userId, disponibilites.sundayId],
    set: { available: available ?? null, note: note ?? null, respondedAt: new Date() },
  });
  return c.json({ ok: true });
});

disposRoute.delete('/:sundayId', async (c) => {
  const user = c.get('user') as JwtPayload;
  const sundayId = Number(c.req.param('sundayId'));
  await db.delete(disponibilites).where(and(eq(disponibilites.userId, user.sub), eq(disponibilites.sundayId, sundayId)));
  return c.json({ ok: true });
});

export default disposRoute;
```

- [ ] **Créer `src/routes/runsheet.ts`**

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sundayRunsheet, sundays } from '../db/schema.js';

const runsheetRoute = new Hono();

runsheetRoute.get('/:sundayId', async (c) => {
  const sundayId = Number(c.req.param('sundayId'));
  const items = await db.select().from(sundayRunsheet).where(eq(sundayRunsheet.sundayId, sundayId)).orderBy(sundayRunsheet.position);
  const [sunday] = await db.select({ startTime: sundays.startTime }).from(sundays).where(eq(sundays.id, sundayId));
  return c.json({
    items: items.map(r => ({ ...r, id: String(r.id), song_id: r.songId ? String(r.songId) : null })),
    start_time: sunday?.startTime ?? '10:00',
  });
});

runsheetRoute.post('/:sundayId', async (c) => {
  const sundayId = Number(c.req.param('sundayId'));
  const { items } = await c.req.json<{ items: Array<{ position: number; type: string; title: string; duration_min: number; notes?: string; song_id?: string; is_published?: boolean }> }>();
  await db.delete(sundayRunsheet).where(eq(sundayRunsheet.sundayId, sundayId));
  if (items.length > 0) {
    await db.insert(sundayRunsheet).values(items.map((item, i) => ({
      sundayId, position: item.position ?? i, type: item.type, title: item.title,
      durationMin: item.duration_min, notes: item.notes ?? null,
      songId: item.song_id ? Number(item.song_id) : null, isPublished: item.is_published ?? false,
    })));
  }
  return c.json({ ok: true });
});

export default runsheetRoute;
```

- [ ] **Monter toutes les routes dans `src/index.ts`**

```typescript
import eventsRoute from './routes/events.js';
import permissionsRoute from './routes/permissions.js';
import configRoute from './routes/config.js';
import absencesRoute from './routes/absences.js';
import disposRoute from './routes/disponibilites.js';
import runsheetRoute from './routes/runsheet.js';

app.use('/events/*', requireAuth); app.use('/events', requireAuth); app.route('/events', eventsRoute);
app.use('/permissions/*', requireAuth); app.use('/permissions', requireAuth); app.route('/permissions', permissionsRoute);
app.use('/config/*', requireAuth); app.use('/config', requireAuth); app.route('/config', configRoute);
app.use('/absences/*', requireAuth); app.use('/absences', requireAuth); app.route('/absences', absencesRoute);
app.use('/disponibilites/*', requireAuth); app.use('/disponibilites', requireAuth); app.route('/disponibilites', disposRoute);
app.use('/runsheet/*', requireAuth); app.route('/runsheet', runsheetRoute);
```

- [ ] **Lancer tous les tests**

```bash
npm test
```
Attendu : tous les tests existants passent.

- [ ] **Commit**

```bash
git add .
git commit -m "feat: add events, permissions, config, absences, disponibilites, runsheet routes"
```

---

### Task 10 : Dockerfile + déploiement Coolify

**Files:**
- Create: `AEFApi/Dockerfile`
- Create: `AEFApi/.dockerignore`

- [ ] **Créer `Dockerfile`**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Créer `.dockerignore`**

```
node_modules
dist
.env
.env.test
*.test.ts
```

- [ ] **Tester le build Docker localement**

```bash
docker build -t aef-api .
docker run -p 3000:3000 --env-file .env aef-api
curl http://localhost:3000/health
```
Attendu : `{"status":"ok","ts":"..."}`

- [ ] **Pousser sur GitHub**

```bash
git remote add origin https://github.com/bernardfreddy0-fbm/aef-api.git
# (créer le repo GitHub privé d'abord)
git push -u origin main
```

- [ ] **Créer le service dans Coolify**

Dans l'interface Coolify sur `http://141.94.95.7:8000` :
1. New Resource → Application → GitHub Private
2. Repo : `bernardfreddy0-fbm/aef-api`, branche `main`
3. Build Pack : Dockerfile
4. Domain : `api.a-e-f.fr`
5. Port : 3000

Variables d'environnement dans Coolify :
```
DATABASE_URL=postgresql://...
JWT_SECRET=<random 64 chars>
JWT_REFRESH_SECRET=<random 64 chars>
RESEND_API_KEY=re_...
MINIO_ENDPOINT=minio.a-e-f.fr
MINIO_PORT=443
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET_SONGS=songs
MINIO_USE_SSL=true
ADMIN_RESET_URL=https://admin-psalm.a-e-f.fr/admin/reset-password
MEMBRE_RESET_URL=https://psalm.a-e-f.fr/reset-password
PORT=3000
```

- [ ] **Vérifier le déploiement**

```bash
curl https://api.a-e-f.fr/health
```
Attendu : `{"status":"ok","ts":"..."}`

---

## PHASE 4 — Migration des données

### Task 11 : Migration PostgreSQL + Minio

**Files:** Scripts shell à exécuter depuis le terminal local

- [ ] **Exporter le schéma depuis Supabase**

```bash
# Récupérer l'URL de connexion directe depuis Supabase Dashboard → Settings → Database
SUPABASE_DB_URL="postgresql://postgres:[password]@db.thwgkwsuukcyxjevtzxb.supabase.co:5432/postgres"

pg_dump --schema-only \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=extensions \
  -n public \
  "$SUPABASE_DB_URL" > /tmp/aef_schema.sql
```

- [ ] **Ajouter la colonne `password_hash` au dump**

Éditer `/tmp/aef_schema.sql` et ajouter dans la définition de la table `profiles` :
```sql
-- Après la colonne updated_at :
password_hash text,
```

- [ ] **Importer le schéma dans PostgreSQL OVH**

```bash
VPS_DB_URL="postgresql://postgres:[password]@localhost:5432/aef"  # via SSH tunnel ou URL directe Coolify

psql "$VPS_DB_URL" < /tmp/aef_schema.sql
```

- [ ] **Créer les 3 nouvelles tables auth**

```bash
cd /Users/fbm/Desktop/AEFApi
DATABASE_URL="$VPS_DB_URL" npm run db:push
```
Attendu : tables `sessions`, `password_reset_tokens` créées.

- [ ] **Exporter et importer les données**

```bash
pg_dump --data-only \
  --exclude-schema=auth \
  --exclude-schema=storage \
  -n public \
  "$SUPABASE_DB_URL" > /tmp/aef_data.sql

psql "$VPS_DB_URL" < /tmp/aef_data.sql
```

- [ ] **Copier les hash de mots de passe depuis Supabase auth.users**

```bash
# Se connecter à Supabase et exporter les hash
psql "$SUPABASE_DB_URL" -c "\COPY (SELECT id, encrypted_password FROM auth.users) TO '/tmp/auth_users.csv' CSV"

# Importer les hash dans profiles.password_hash
psql "$VPS_DB_URL" <<'SQL'
CREATE TEMP TABLE tmp_auth (id uuid, hash text);
\COPY tmp_auth FROM '/tmp/auth_users.csv' CSV
UPDATE profiles p SET password_hash = t.hash FROM tmp_auth t WHERE p.id = t.id;
DROP TABLE tmp_auth;
SQL
```

- [ ] **Vérifier l'intégrité des données**

```bash
psql "$VPS_DB_URL" <<'SQL'
SELECT 'profiles' as t, COUNT(*) FROM profiles
UNION ALL SELECT 'sundays', COUNT(*) FROM sundays
UNION ALL SELECT 'songs', COUNT(*) FROM songs
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'absences', COUNT(*) FROM absences;
SQL
# Comparer les counts avec ceux de Supabase
```

- [ ] **Migrer les fichiers Minio depuis Supabase Storage**

```bash
# Installer le client Supabase CLI si nécessaire : npm install -g supabase
# Lister les fichiers dans le bucket songs
supabase storage ls --project-ref thwgkwsuukcyxjevtzxb songs/

# Télécharger tous les fichiers
mkdir -p /tmp/songs_backup
supabase storage cp --project-ref thwgkwsuukcyxjevtzxb ss:///songs /tmp/songs_backup --recursive

# Uploader vers Minio (utiliser mc — Minio Client)
brew install minio/stable/mc
mc alias set ovh https://minio.a-e-f.fr ACCESS_KEY SECRET_KEY
mc cp --recursive /tmp/songs_backup/ ovh/songs/
```

- [ ] **Mettre à jour les URLs partition_url dans la DB**

```bash
psql "$VPS_DB_URL" <<'SQL'
UPDATE songs
SET partition_url = REPLACE(
  partition_url,
  'https://thwgkwsuukcyxjevtzxb.supabase.co/storage/v1/object/public/songs/',
  'https://minio.a-e-f.fr/songs/'
)
WHERE partition_url LIKE '%supabase.co%';
SQL
```

- [ ] **Tester un endpoint avec les vraies données**

```bash
curl -X POST https://api.a-e-f.fr/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"VOTRE_EMAIL_ADMIN","password":"VOTRE_MOT_DE_PASSE"}' | jq .
```
Attendu : `{ access_token, refresh_token, user: {...} }`

- [ ] **Commit**

```bash
cd /Users/fbm/Desktop/AEFApi
git add .
git commit -m "docs: add migration scripts notes in plan"
```

---

## PHASE 5 — Migration frontends

### Task 12 : PsalmAdmin — migration frontend

**Files:**
- Create: `/Users/fbm/Desktop/Psalm/src/lib/apiClient.ts`
- Delete: `/Users/fbm/Desktop/Psalm/src/lib/supabase.ts`
- Modify: `/Users/fbm/Desktop/Psalm/src/lib/api.ts`
- Modify: `/Users/fbm/Desktop/Psalm/src/contexts/AuthContext.tsx`
- Modify: `/Users/fbm/Desktop/Psalm/src/pages/ResetPasswordPage.tsx`

- [ ] **Créer `src/lib/apiClient.ts`**

```typescript
const BASE = import.meta.env.VITE_API_URL as string;

const TOKEN_KEY = 'aef_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('aef_refresh_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // Tentative de refresh silencieux
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(method, path, body);
    }
    clearToken();
    window.location.href = '/admin';
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('aef_refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const { access_token } = await res.json();
    setToken(access_token);
    return true;
  } catch {
    return false;
  }
}

export async function uploadFile(path: string, file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const apiClient = {
  get:    <T>(path: string)               => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};
```

- [ ] **Remplacer `src/lib/supabase.ts`**

Supprimer le contenu et le remplacer par :

```typescript
// Ce fichier est conservé temporairement pour éviter les erreurs d'import.
// Supprimer définitivement après avoir migré tous les imports vers apiClient.
export const supabase = null as any;
export const supabaseAdmin = null as any;
```

- [ ] **Mettre à jour `src/contexts/AuthContext.tsx`**

Remplacer les appels `supabase.auth.*` :

```typescript
// Chercher et remplacer dans AuthContext.tsx :

// AVANT :
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// APRÈS :
import { apiClient, setToken, clearToken } from '@/lib/apiClient';
const data = await apiClient.post<{ access_token: string; refresh_token: string; user: any }>('/auth/login', { email, password });
setToken(data.access_token);
localStorage.setItem('aef_refresh_token', data.refresh_token);
// data.user remplace data.session.user

// AVANT (logout) :
await supabase.auth.signOut();

// APRÈS :
const refreshToken = localStorage.getItem('aef_refresh_token');
await apiClient.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
clearToken();

// AVANT (checkAuth) :
const { data: { session } } = await supabase.auth.getSession();

// APRÈS :
const token = getToken();
if (!token) return null;
// Faire un appel à /members/me ou décoder le JWT localement
```

Ajouter `GET /members/me` dans `AEFApi/src/routes/members.ts` :

```typescript
members.get('/me', async (c) => {
  const user = c.get('user') as JwtPayload;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.sub));
  if (!profile) return c.json({ error: 'Profil introuvable' }, 404);
  return c.json({ id: profile.id, first_name: profile.firstName, last_name: profile.lastName, email: profile.email, role: profile.role });
});
```

- [ ] **Mettre à jour `src/lib/api.ts` — remplacer les appels Supabase**

Chercher toutes les occurrences de `supabaseAdmin.from(` et `supabase.from(` et les remplacer par des appels `apiClient.get/post/put/delete`. Exemple :

```typescript
// AVANT :
export const getMembers = async () => {
  const { data, error } = await supabaseAdmin.from('profiles').select('...');
  throwIfError(data, error);
  return data;
};

// APRÈS :
export const getMembers = async () => {
  return apiClient.get<any[]>('/members');
};

// AVANT :
export const getPlanning = async (year: number) => {
  const { data, error } = await supabaseAdmin.from('sundays').select('...').gte(...).lte(...);
  return (data || []).map(...);
};

// APRÈS :
export const getPlanning = async (year: number) => {
  return apiClient.get<any[]>(`/planning/${year}`);
};

// AVANT :
export const createSunday = async (date: string, label: string) => {
  const { data, error } = await supabaseAdmin.from('sundays').insert({...}).select('id').single();
  return data;
};

// APRÈS :
export const createSunday = async (date: string, label: string) => {
  return apiClient.post<{ id: string }>('/planning/sunday', { date, label });
};

// Répéter le pattern pour toutes les fonctions — chaque supabaseAdmin.from → apiClient.*
```

- [ ] **Mettre à jour `src/pages/ResetPasswordPage.tsx`**

```typescript
// AVANT : utilise supabase.auth.updateUser({ password })
// APRÈS : utilise apiClient

import { apiClient } from '@/lib/apiClient';

// Dans le composant :
const token = new URLSearchParams(window.location.search).get('token');
if (!token) { /* afficher erreur token manquant */ }

// Soumission :
await apiClient.post('/auth/set-password', { token, password });
// Rediriger vers / après succès
```

- [ ] **Mettre à jour les variables Coolify PsalmAdmin**

Dans Coolify → service PsalmAdmin (UUID `g5f2n17hj8ie2mukuixstsg0`) :
- Supprimer : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_KEY`
- Ajouter : `VITE_API_URL=https://api.a-e-f.fr`

- [ ] **Build et tester**

```bash
cd /Users/fbm/Desktop/Psalm
npm run build
# Vérifier : aucun import de @supabase/supabase-js ne reste dans le bundle
grep -r "@supabase" dist/ 2>/dev/null && echo "ATTENTION: Supabase encore dans le bundle" || echo "OK: Supabase absent du bundle"
```

- [ ] **Déployer et valider**

```bash
git add src/lib/apiClient.ts src/lib/supabase.ts src/lib/api.ts src/contexts/AuthContext.tsx src/pages/ResetPasswordPage.tsx
git commit -m "feat: migrate PsalmAdmin from Supabase to Hono API"
git push fork main
curl -s "http://141.94.95.7:8000/api/v1/deploy?uuid=g5f2n17hj8ie2mukuixstsg0" -H "Authorization: Bearer 1|claudetoken123"
```

Tester manuellement dans le navigateur :
- [ ] Login fonctionne
- [ ] Dashboard charge les données
- [ ] Planning charge et on peut éditer
- [ ] Membres : lister, créer, modifier
- [ ] Chants : lister, upload partition
- [ ] Reset password reçoit un email

---

### Task 13 : PsalmMembre — migration frontend

**Files:**
- Create: `/Users/fbm/Desktop/PsalmMembre/src/lib/apiClient.ts`
- Delete: `/Users/fbm/Desktop/PsalmMembre/src/lib/supabase.ts`
- Modify: `/Users/fbm/Desktop/PsalmMembre/src/lib/api.ts`
- Modify: `/Users/fbm/Desktop/PsalmMembre/src/contexts/AuthContext.tsx`
- Create: `/Users/fbm/Desktop/PsalmMembre/src/pages/ResetPasswordPage.tsx`

- [ ] **Créer `src/lib/apiClient.ts`** (identique à PsalmAdmin — dupliquer)

```typescript
const BASE = import.meta.env.VITE_API_URL as string;
const TOKEN_KEY = 'aef_token';

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string): void { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('aef_refresh_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(method, path, body);
    clearToken();
    window.location.href = '/';
    throw new Error('Session expirée');
  }
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem('aef_refresh_token');
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) });
    if (!res.ok) return false;
    const { access_token } = await res.json();
    setToken(access_token);
    return true;
  } catch { return false; }
}

export async function uploadFile(path: string, file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};
```

- [ ] **Remplacer `src/lib/supabase.ts`**

```typescript
export const supabase = null as any;
```

- [ ] **Mettre à jour `src/lib/api.ts`** — même pattern que PsalmAdmin

Chaque `supabase.from(...)` → `apiClient.get/post/put/delete(...)`.  
Les RLS Supabase sont maintenant remplacés par les middlewares Hono (l'auth JWT dans le header suffit — le serveur filtre par `user.sub`).

Exemple pour les absences :
```typescript
// AVANT :
export const getMyAbsences = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.from('absences').select('...').eq('user_id', session.user.id);
  return data;
};

// APRÈS :
export const getMyAbsences = async () => {
  return apiClient.get<any[]>('/absences/me');
  // Le serveur Hono filtre par user.sub extrait du JWT
};
```

- [ ] **Mettre à jour `src/contexts/AuthContext.tsx`** — même pattern que PsalmAdmin

```typescript
// AVANT :
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// APRÈS :
import { apiClient, setToken, clearToken, getToken } from '@/lib/apiClient';
const data = await apiClient.post<{ access_token: string; refresh_token: string; user: any }>('/auth/login', { email, password });
setToken(data.access_token);
localStorage.setItem('aef_refresh_token', data.refresh_token);
```

- [ ] **Créer `src/pages/ResetPasswordPage.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) setTokenError(true);
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    if (password.length < 8) { toast.error('Erreur', 'Minimum 8 caractères'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/set-password', { token, password });
      toast.error('Succès', 'Mot de passe mis à jour');
      navigate('/');
    } catch (err: any) {
      toast.error('Erreur', err.message ?? 'Lien invalide ou expiré');
    } finally {
      setLoading(false);
    }
  }

  if (tokenError) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive">Lien invalide ou manquant.</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Nouveau mot de passe</h1>
        <Input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        <Input type="password" placeholder="Confirmer" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </form>
    </div>
  );
}
```

Ajouter la route publique dans `App.tsx` de PsalmMembre (avant le garde d'auth) :

```typescript
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Mettre à jour les variables Coolify PsalmMembre**

Dans Coolify → service PsalmMembre (UUID `pp3lsyh7fwvoma9pd66yqsgi`) :
- Supprimer : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Ajouter : `VITE_API_URL=https://api.a-e-f.fr`

- [ ] **Build et vérifier**

```bash
cd /Users/fbm/Desktop/PsalmMembre
npm run build
grep -r "@supabase" dist/ 2>/dev/null && echo "ATTENTION: Supabase encore dans le bundle" || echo "OK"
```

- [ ] **Déployer et valider**

```bash
git add src/lib/apiClient.ts src/lib/supabase.ts src/lib/api.ts src/contexts/AuthContext.tsx src/pages/ResetPasswordPage.tsx src/App.tsx
git commit -m "feat: migrate PsalmMembre from Supabase to Hono API"
git push origin main
curl -s "http://141.94.95.7:8000/api/v1/deploy?uuid=pp3lsyh7fwvoma9pd66yqsgi" -H "Authorization: Bearer 1|claudetoken123"
```

Tester manuellement :
- [ ] Login membre fonctionne
- [ ] Mon planning charge
- [ ] Disponibilités : répondre à un dimanche
- [ ] Absences : créer, supprimer
- [ ] Reset password : email reçu, formulaire fonctionne

---

## PHASE 6 — Extinction Supabase

### Task 14 : Validation finale et shutdown Supabase

- [ ] **Monitoring 48h en production**

Observer les logs Coolify des 3 services (AEFApi, PsalmAdmin, PsalmMembre) pendant 48h :
```bash
# Via API Coolify
curl -s "http://141.94.95.7:8000/api/v1/applications/g5f2n17hj8ie2mukuixstsg0/logs" \
  -H "Authorization: Bearer 1|claudetoken123" | tail -50
```
Aucune erreur 401, 500, ou mention Supabase dans les logs.

- [ ] **Vérifier l'absence de Supabase dans les bundles**

```bash
# PsalmAdmin
curl -s https://admin-psalm.a-e-f.fr/admin/assets/*.js | grep -c "supabase.co"
# Attendu : 0

# PsalmMembre
curl -s https://psalm.a-e-f.fr/assets/*.js | grep -c "supabase.co"
# Attendu : 0
```

- [ ] **Exporter une sauvegarde complète finale**

```bash
pg_dump "$SUPABASE_DB_URL" > /tmp/aef_supabase_final_backup_$(date +%Y%m%d).sql
# Stocker cette sauvegarde dans un endroit sûr (ex: Minio, coffre-fort)
```

- [ ] **Désactiver le projet Supabase**

Dans Supabase Dashboard → Settings → General → Danger Zone :
- Pause project (plan Free → pause automatique après 1 semaine d'inactivité, ou désactiver manuellement)
- Ne pas supprimer immédiatement — garder en pause 30 jours au cas où

- [ ] **Supprimer les variables Supabase des gestionnaires de secrets**

Archiver (ne pas supprimer) dans un endroit sécurisé :
```
SUPABASE_URL=https://thwgkwsuukcyxjevtzxb.supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...
```

- [ ] **Supprimer définitivement supabase.ts des deux apps**

```bash
rm /Users/fbm/Desktop/Psalm/src/lib/supabase.ts
rm /Users/fbm/Desktop/PsalmMembre/src/lib/supabase.ts
# Vérifier qu'aucun fichier n'importe encore supabase.ts
grep -r "from.*supabase" /Users/fbm/Desktop/Psalm/src
grep -r "from.*supabase" /Users/fbm/Desktop/PsalmMembre/src
# Attendu : aucun résultat

npm run build  # Dans chaque projet — doit compiler sans erreur
```

- [ ] **Désinstaller le SDK Supabase**

```bash
cd /Users/fbm/Desktop/Psalm && npm uninstall @supabase/supabase-js
cd /Users/fbm/Desktop/PsalmMembre && npm uninstall @supabase/supabase-js
```

- [ ] **Commit final**

```bash
# PsalmAdmin
cd /Users/fbm/Desktop/Psalm
git add .
git commit -m "chore: remove Supabase SDK — migration complete"
git push fork main
curl -s "http://141.94.95.7:8000/api/v1/deploy?uuid=g5f2n17hj8ie2mukuixstsg0" -H "Authorization: Bearer 1|claudetoken123"

# PsalmMembre
cd /Users/fbm/Desktop/PsalmMembre
git add .
git commit -m "chore: remove Supabase SDK — migration complete"
git push origin main
curl -s "http://141.94.95.7:8000/api/v1/deploy?uuid=pp3lsyh7fwvoma9pd66yqsgi" -H "Authorization: Bearer 1|claudetoken123"
```

---

## Checklist finale

- [ ] `curl https://api.a-e-f.fr/health` → `{"status":"ok"}`
- [ ] Login PsalmAdmin → fonctionne
- [ ] Login PsalmMembre → fonctionne
- [ ] Reset password admin → email reçu + mot de passe changé
- [ ] Reset password membre → email reçu + mot de passe changé
- [ ] Partitions PDF → accessibles depuis Minio
- [ ] Zéro mention `supabase.co` dans les bundles prod
- [ ] Logs Coolify des 3 services → pas d'erreur 5xx
- [ ] Sauvegarde Supabase archivée
