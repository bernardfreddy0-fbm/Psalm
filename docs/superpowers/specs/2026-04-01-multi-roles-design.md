# Multi-rôles utilisateur — Design

**Date :** 2026-04-01

## Problème

La colonne `role` de la table `aef_users` est de type **ENUM MySQL** limité à une seule valeur parmi une liste fixe. MySQL rejette silencieusement toute valeur non répertoriée (ex. `'choriste,musicien'` ou `'conducteur_louange'`) et écrit une chaîne vide. Le frontend (ComptesPage) affiche un toast de succès mais la donnée n'est jamais persistée.

**Diagnostic confirmé par tests :**
- GET `members.php?action=update&role=videaste%2Cmusicien` → retourne `{"success":true}` (réponse Varnish cachée), rôle reste inchangé en base
- POST `members.php?action=update` avec body `{"role":"videaste,musicien"}` → retourne `{"success":true}`, rôle écrit vide (`""`) car valeur invalide pour l'ENUM

**Colonne actuelle :**
```sql
role enum('responsable_louange','responsable_technique','pasteur','choriste',
           'musicien','sonorisateur','projectionniste','videaste') NOT NULL DEFAULT 'choriste'
```

**Colonne cible :**
```sql
role VARCHAR(255) NOT NULL DEFAULT 'choriste'
```

---

## Solution retenue — Option A : ALTER TABLE ENUM → VARCHAR

Une seule migration SQL. Aucun changement PHP, aucun changement frontend.

### Pourquoi Option A

- **Zéro impact applicatif** : `members.php` lit `$input['role']` comme une chaîne — ça fonctionnait déjà, seule la contrainte ENUM bloquait l'écriture
- **Frontend déjà prêt** : `api.ts`, `ComptesPage`, `MembresPage` et `PlanningPage` parsent tous les rôles avec `.split(',')` — le multi-rôle est natif dans tout le code
- **Compatibilité données existantes** : MySQL conserve les valeurs existantes lors du changement de type
- **Débloque aussi** `conducteur_louange` et `dev` qui n'étaient pas dans l'ENUM

---

## Migration SQL

```sql
ALTER TABLE aef_users
  MODIFY COLUMN role VARCHAR(255) NOT NULL DEFAULT 'choriste';
```

Exécuté via SSH sur le serveur o2switch (`yellow.o2switch.net`, user `bqzk4896`, base `bqzk4896_aef_psalm`).

---

## Comportement après migration

### Sauvegarde multi-rôles (ComptesPage)

1. L'utilisateur sélectionne plusieurs rôles dans la modale (ex. `choriste` + `conducteur_louange`)
2. `handleUpdateRole` construit `nextRoleValue = 'responsable_louange,choriste'` (via `toApiRole`)
3. POST JSON vers `members.php?action=update` avec `{"id": "5", "role": "responsable_louange,choriste"}`
4. PHP exécute `UPDATE aef_users SET role = 'responsable_louange,choriste' WHERE id = 5` — ✅ persiste
5. Toast vert "Rôles mis à jour" + `load()` rafraîchit la liste

### Affichage dans MembresPage

- `parseRoles(m.role)` → `role.split(',')` → `['responsable_louange', 'choriste']`
- `normalizeRole` → `['conducteur_louange', 'choriste']`
- Badges affichés pour chaque rôle
- Filtres par pôle : `roles.some(r => POLE_ROLES[pole].includes(r))` — un membre multi-rôle apparaît dans tous ses pôles

### Affichage dans PlanningPage

- `parsedRoles.includes('conducteur_louange')` → apparaît dans liste Dirigeants
- `parsedRoles.includes('choriste')` → apparaît dans liste Choristes
- Un membre `choriste,conducteur_louange` est sélectionnable dans les deux dropdowns

---

## Ce qui ne change pas

| Composant | Statut |
|---|---|
| `members.php` (PHP) | Aucun changement |
| `src/lib/api.ts` | Aucun changement |
| `src/pages/ComptesPage.tsx` | Aucun changement |
| `src/pages/MembresPage.tsx` | Aucun changement |
| `src/pages/PlanningPage.tsx` | Aucun changement |
| Alias `responsable_louange` ↔ `conducteur_louange` | Conservé |
| Colonne `secondary_roles` (inutilisée) | Non touchée |

---

## Schéma final de la table (colonnes concernées)

```
role          VARCHAR(255) NOT NULL DEFAULT 'choriste'
secondary_roles  text          YES   (inutilisée, conservée)
```

---

## Vérification post-migration

```bash
# Vérifier le type de colonne
mysql> SHOW COLUMNS FROM aef_users LIKE 'role';

# Tester la persistance multi-rôle
curl -X POST https://api-psalm.a-e-f.fr/members.php?action=update \
  -H "Content-Type: application/json" \
  -d '{"id": "44", "role": "videaste,musicien"}'

curl https://api-psalm.a-e-f.fr/members.php?action=get&id=44&_=$(date +%s)
# Expected: role = "videaste,musicien"
```
