# Multi-rôles — Migration ENUM → VARCHAR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Changer la colonne `role` de `aef_users` de type ENUM à VARCHAR(255) pour permettre le stockage de plusieurs rôles séparés par des virgules.

**Architecture:** Une seule migration SQL exécutée via SSH sur le serveur o2switch. Aucun changement applicatif — le frontend et le backend gèrent déjà les rôles multiples en virgule-séparés, seul le type de colonne MySQL bloquait l'écriture.

**Tech Stack:** MySQL (o2switch), SSH, curl

---

### Task 1 : Migration de la colonne `role`

**Files:**
- Aucun fichier applicatif modifié — opération SQL directe sur le serveur

- [ ] **Step 1 : Vérifier le type actuel de la colonne**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "SHOW COLUMNS FROM aef_users LIKE '"'"'role'"'"';" 2>/dev/null'
```

Expected :
```
Field  Type                                                          Null  Key  Default   Extra
role   enum('responsable_louange','responsable_technique',...)       NO    MUL  choriste
```

- [ ] **Step 2 : Exécuter la migration ALTER TABLE**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "ALTER TABLE aef_users MODIFY COLUMN role VARCHAR(255) NOT NULL DEFAULT '"'"'choriste'"'"';" 2>/dev/null'
```

Expected : aucune sortie (MySQL n'affiche rien en cas de succès).

- [ ] **Step 3 : Vérifier que la migration a bien été appliquée**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "SHOW COLUMNS FROM aef_users LIKE '"'"'role'"'"';" 2>/dev/null'
```

Expected :
```
Field  Type          Null  Key  Default   Extra
role   varchar(255)  NO    MUL  choriste
```

- [ ] **Step 4 : Vérifier que les données existantes sont intactes**

```bash
ssh -o StrictHostKeyChecking=no bqzk4896@yellow.o2switch.net \
  'mysql -u bqzk4896_psalm -pPsalmAEF2026! bqzk4896_aef_psalm -e "SELECT id, first_name, role FROM aef_users WHERE is_active=1 LIMIT 8;" 2>/dev/null'
```

Expected : les mêmes valeurs qu'avant la migration (`choriste`, `videaste`, `responsable_louange`, etc.) — aucune ligne avec une valeur vide inattendue.

- [ ] **Step 5 : Tester la persistance d'un rôle multiple via POST**

```bash
# Sauvegarder le rôle actuel de James (id=44) avant le test
BEFORE=$(curl -s "https://api-psalm.a-e-f.fr/members.php?action=get&id=44&_=$(date +%s)" \
  -H "X-Session-Token: test" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('role',''))")
echo "Rôle avant : $BEFORE"

# Écrire un rôle multiple
curl -s -X POST "https://api-psalm.a-e-f.fr/members.php?action=update" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test" \
  -d '{"id": "44", "role": "videaste,musicien"}'
echo ""
sleep 1

# Vérifier la persistance
AFTER=$(curl -s "https://api-psalm.a-e-f.fr/members.php?action=get&id=44&_=$(date +%s)" \
  -H "X-Session-Token: test" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('role',''))")
echo "Rôle après : $AFTER"
```

Expected :
```
Rôle avant : videaste
Rôle après : videaste,musicien
```

- [ ] **Step 6 : Restaurer le rôle de James**

```bash
curl -s -X POST "https://api-psalm.a-e-f.fr/members.php?action=update" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test" \
  -d '{"id": "44", "role": "videaste"}'
echo ""
```

Expected : `{"success":true}`

- [ ] **Step 7 : Commit**

```bash
cd /Users/fbm/Desktop/Psalm
git add docs/superpowers/plans/2026-04-01-multi-roles-migration.md
git commit -m "feat: migrate role column ENUM → VARCHAR(255) for multi-role support"
```

---

### Task 2 : Test fonctionnel end-to-end en production

- [ ] **Step 1 : Ouvrir l'application et tester le flux complet**

1. Ouvrir https://admin-psalm.a-e-f.fr/admin/
2. Se connecter
3. Aller dans **Gestion des comptes**
4. Cliquer **Rôles** sur un membre
5. Sélectionner 2 rôles (ex. `Choriste` + `Conducteur Louange`)
6. Cliquer **Sauvegarder**
7. ✅ Toast vert "Rôles mis à jour"
8. Recharger la page (F5)
9. ✅ Les 2 rôles sont toujours affichés sur ce membre

- [ ] **Step 2 : Vérifier dans le module Membres**

1. Aller dans **Membres**
2. ✅ Le membre apparaît avec ses 2 badges de rôle
3. Filtrer par pôle "Choriste & Dirigeant"
4. ✅ Le membre apparaît dans ce filtre

- [ ] **Step 3 : Vérifier dans le module Planning**

1. Aller dans **Planning**
2. Ouvrir l'édition d'un dimanche (icône crayon)
3. ✅ Le membre apparaît dans la liste déroulante **Dirigeant** (si rôle conducteur_louange)
4. ✅ Le membre apparaît dans la liste **Choristes** (si rôle choriste)
