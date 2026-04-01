# Design : Correctif sauvegarde des rôles — Gestion des comptes

**Date :** 2026-03-31
**Statut :** Approuvé
**Approche choisie :** Option A — POST + JSON body + simplification vérification

---

## Problème

Le bouton "Sauvegarder" dans la modale de modification des rôles (ComptesPage)
affiche un toast d'avertissement systématique et ne confirme jamais la mise à jour,
même quand le serveur a bien traité la requête.

**Deux bugs combinés :**

### Bug 1 — updateMember envoie un GET au lieu d'un POST

`updateMember` dans `api.ts` construit l'URL avec les paramètres en query string
et appelle `api()` qui utilise GET par défaut. Les mutations via GET sont fragiles
sur o2switch (cache Varnish) et mauvaise pratique REST.

### Bug 2 — Vérification post-sauvegarde compare des formats incompatibles

`handleUpdateRole` compare :
- `sentSet` : rôles au format API (`responsable_louange`)
- `savedSet` : rôles retournés par `getMembers()` qui normalise automatiquement
  `responsable_louange` → `conducteur_louange`

Le match est toujours `false`, d'où le toast "le serveur n'a pas confirmé".

---

## Solution

### Fichier 1 : `src/lib/api.ts`

Remplacer `updateMember` par une version POST avec JSON body :

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

Le PHP `members.php` lit déjà `json_decode(php://input)` en priorité — compatible.

### Fichier 2 : `src/pages/ComptesPage.tsx`

Simplifier `handleUpdateRole` — supprimer la vérification cassée, reload + toast direct :

```typescript
const handleUpdateRole = async () => {
  if (!editing) return;
  const nextRoles = Array.from(
    new Set(editing.roles.map(r => toApiRole(normalizeRole(r))).filter(Boolean))
  );
  try {
    await updateMember(editing.id, { role: nextRoles.join(',') });
    toast.success('Rôles mis à jour');
    setEditing(null);
    load();
  } catch (err: any) {
    toast.error(`Erreur : ${err?.message || 'inconnue'}`);
  }
};
```

---

## Périmètre

- 2 fichiers modifiés : `api.ts`, `ComptesPage.tsx`
- Aucun impact sur les autres pages
- Aucune modification du backend PHP
- `updateMember` est uniquement utilisé dans `ComptesPage.tsx`

---

## Critères de succès

- Clic "Sauvegarder" → toast vert "Rôles mis à jour"
- La liste se rafraîchit et affiche le nouveau rôle
- En cas d'erreur réseau → toast rouge avec message explicite
