# Comptes — Correctif sauvegarde des rôles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la sauvegarde des rôles dans la modale de ComptesPage — clic "Sauvegarder" persiste le changement et affiche un toast vert de confirmation.

**Architecture:** Deux correctifs dans deux fichiers. (1) `updateMember` dans `api.ts` passe de GET querystring à POST JSON body. (2) `handleUpdateRole` dans `ComptesPage.tsx` est simplifié — suppression de la vérification cassée, toast direct après succès, refresh de la liste.

**Tech Stack:** React 18, TypeScript, Vite, Sonner (toasts), fetch API, PHP 8 backend (o2switch)

---

### Task 1 : Corriger updateMember dans api.ts

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1 : Localiser la fonction updateMember**

Chercher dans `src/lib/api.ts` la fonction actuelle (lignes ~110-112) :
```typescript
export const updateMember = (id: string, data: Record<string, string>) => {
  const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api(`members.php?action=update&id=${id}&${params}`);
};
```

- [ ] **Step 2 : Remplacer par la version POST JSON**

```typescript
export const updateMember = async (id: string, data: Record<string, string>) => {
  const res = await fetch(`${API_BASE}/members.php?action=update`, {
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

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur liée à `updateMember`.

- [ ] **Step 4 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/lib/api.ts
git commit -m "fix: updateMember uses POST JSON body instead of GET querystring"
```

---

### Task 2 : Simplifier handleUpdateRole dans ComptesPage.tsx

**Files:**
- Modify: `src/pages/ComptesPage.tsx`

- [ ] **Step 1 : Localiser handleUpdateRole (lignes ~72-106)**

Repérer la fonction avec son bloc try/catch et la logique de vérification
`sentSet` / `savedSet` / `match`.

- [ ] **Step 2 : Remplacer entièrement handleUpdateRole**

```typescript
const handleUpdateRole = async () => {
  if (!editing) return;

  const nextRoles = Array.from(
    new Set(editing.roles.map(r => toApiRole(normalizeRole(r))).filter(Boolean))
  );
  const nextRoleValue = nextRoles.join(',');

  try {
    await updateMember(editing.id, { role: nextRoleValue });
    toast.success('Rôles mis à jour');
    setEditing(null);
    load();
  } catch (err: any) {
    toast.error(`Erreur : ${err?.message || 'inconnue'}`);
  }
};
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd /Users/fbm/Desktop/Psalm && npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add src/pages/ComptesPage.tsx
git commit -m "fix: handleUpdateRole removes broken verification, shows direct success toast"
```

---

### Task 3 : Build et déploiement production

**Files:**
- Generate: `dist/`

- [ ] **Step 1 : Builder l'application**

```bash
cd /Users/fbm/Desktop/Psalm && npm run build 2>&1 | tail -8
```

Expected : `✓ built in ~5s` avec `dist/index.html` et `dist/assets/index-[hash].js`

- [ ] **Step 2 : Déployer sur o2switch via SCP**

```bash
cd /Users/fbm/Desktop/Psalm

scp -o StrictHostKeyChecking=no dist/index.html \
  bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/index.html

scp -o StrictHostKeyChecking=no dist/assets/* \
  bqzk4896@yellow.o2switch.net:/home/bqzk4896/admin-psalm.a-e-f.fr/admin/assets/
```

Expected : transfert sans erreur.

- [ ] **Step 3 : Vérifier en production**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://admin-psalm.a-e-f.fr/admin/
```

Expected : `HTTP 200`

- [ ] **Step 4 : Test fonctionnel manuel**

1. Ouvrir https://admin-psalm.a-e-f.fr/admin/
2. Se connecter avec un compte pasteur ou responsable_louange
3. Aller dans "Gestion des comptes"
4. Cliquer "Rôles" sur un utilisateur
5. Changer le rôle et cliquer "Sauvegarder"
6. ✅ Toast vert "Rôles mis à jour" s'affiche
7. ✅ La liste se rafraîchit avec le nouveau rôle
8. ✅ Recharger la page — le rôle persiste bien

- [ ] **Step 5 : Commit final**

```bash
cd /Users/fbm/Desktop/Psalm
git add -A
git commit -m "chore: deploy role save fix to production"
```
