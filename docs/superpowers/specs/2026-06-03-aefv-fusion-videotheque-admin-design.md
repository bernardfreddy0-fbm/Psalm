# AEFV — Fusion de l'ancienne « Archives » dans le module AEFV (admin)

**Date** : 2026-06-03
**Surface** : Admin uniquement (`Psalm` → admin-psalm.a-e-f.fr). Public (`PsalmMembre`) et `AEFVApp` = sessions séparées.
**Backend** : aucun changement (toutes les fonctions existent déjà côté client).

## Contexte

Trois représentations de la vidéo coexistaient :
- **AEFV** (module actuel, route `/archives`, fichier `ArchivesAdminPage.tsx`) : workflow de production via la table interne `video_meta` (statut brut→publié, assignations). Onglets : Vue d'ensemble · Planning · **Fiches** · Équipe · Programme.
- **Ancienne « Archives »** : une vidéothèque YouTube (vraies vidéos publiées de la chaîne, groupées par mois, vues/likes). Code encore présent côté public (`PsalmMembre/src/pages/ArchivesPage.tsx`), absent de l'admin.

Objectif : faire d'AEFV **l'écosystème vidéo unique**. L'ancienne vidéothèque est réintégrée dans AEFV. Plus aucun libellé « Archive » ni « Fiches ». L'onglet « Fiches » est remplacé par un onglet **« Vidéos »** unifié.

Principe directeur (vision ingénieur vidéo d'église) : une vidéo de culte est **une seule entité qui traverse un cycle de vie** (captée → montée → validée → publiée → archivée), pas « une fiche » d'un côté et « une archive » de l'autre. L'onglet « Vidéos » est le cockpit de ce cycle de vie.

## Périmètre

- Module AEFV admin uniquement.
- Renommage route `/archives` → `/aefv` (+ redirection de compatibilité `/archives` → `/aefv`).
- Remplacement de l'onglet `Fiches` par `Vidéos` (cockpit cycle de vie).
- Aucun changement de schéma ni de route backend.

Hors-scope : PsalmMembre, AEFVApp, toute migration de données.

## Architecture

### Fichiers touchés (`Psalm/`)

| Fichier | Changement |
|---|---|
| `src/pages/ArchivesAdminPage.tsx` → renommer `src/pages/AefvPage.tsx` | `type Tab` : `'fiches'` → `'videos'`. TABS : libellé `Vidéos`. `FichesTab` remplacé par `VideosTab`. Le titre reste « AEFV — Vidéo ». |
| `src/pages/AefvPage/VideosTab.tsx` (nouveau, extrait) | Le composant de l'onglet Vidéos (cf. ci-dessous). Extrait dans son propre fichier car `AefvPage.tsx` dépasse déjà ~600 lignes. |
| `src/App.tsx` | Route `path="/aefv"` (garde `<Guard action="archives_view">`). Ajouter `path="/archives"` → `<Navigate to="/aefv" replace />`. Import renommé. |
| `src/components/AppLayout.tsx` | Entrée menu `{ to: '/archives', label: 'AEFV' }` → `to: '/aefv'`. |

### Données réutilisées (existantes)

- `src/lib/youtube.ts` : `fetchYoutubeVideos()` (flux chaîne via proxy nginx `/youtube-rss`), `groupVideosByMonth()`, `fetchVideoStats(ids)`, `findVideoForSunday()`. Type `YoutubeVideo { videoId, title, published, thumbnail, url, titleDate }`.
- `src/lib/api.ts` : `getVideoMetaList()` (`VideoMetaSummary` : `video_id`, `status`, `preacher`, `theme`, `assigned_to`, `sunday_id`, `updated_at`…), `getNextSundays()`, `getAEFVTeam()`, `STATUS_LABELS`, `STATUS_COLORS`, type `VideoStatus` (`brut|montage|validation|publie`).

## L'onglet « Vidéos »

### A. Bandeau KPI
Compteurs en tête : `En production` (brut+montage+validation), `À publier / en retard`, `Publiées ce mois`, `Vues totales chaîne`.
- **« en retard »** = vidéo dont le dimanche associé date de plus de **10 jours** et dont le statut n'est pas `publie`. (Latence de publication = métrique clé d'une équipe vidéo d'église.) Seuil constant `LATE_THRESHOLD_DAYS = 10`.

### B. Deux modes de vue (bascule ; même donnée fusionnée)
- **Pipeline** *(défaut)* : Kanban 4 colonnes **Brut · Montage · Validation · Publié**. Carte = vidéo d'un dimanche : date, thème/prédicateur, vidéaste assigné, miniature, vues (si publiée), pastille « en retard ». Clic → fiche (édition existante). Calqué sur le kanban de `AEFVApp/src/pages/ArchivesListPage.tsx`.
- **Catalogue** : vidéothèque publiée groupée **par mois** (`groupVideosByMonth`), cartes miniature + titre + date + vues/likes, lien YouTube + lien fiche. C'est l'ancienne « Archives », réintégrée comme une vue.

### C. Recherche / filtre
Barre de recherche (titre, prédicateur, thème) + filtre statut. En Catalogue : sélecteur d'année.

### D. Fusion des données (logique pure, testable)
Fonction `mergeVideos(channel: YoutubeVideo[], metas: VideoMetaSummary[], stats: Map<id,VideoStats>): MergedVideo[]` :
- Union par `video_id`.
- `MergedVideo` = `{ video_id, title, thumbnail, url, published?, status, fiche?: VideoMetaSummary, stats?: VideoStats, isLate: boolean }`.
- Vidéo publiée sans fiche → apparaît (statut déduit `publie`). Fiche sans vidéo publiée (brut/montage/validation) → apparaît (pas d'URL chaîne). Le matching peut s'appuyer sur `video_id` (clé `video_meta`) et, en repli, `findVideoForSunday()`.
- Cette fonction est isolée dans `src/lib/aefvVideos.ts` pour être testée unitairement sans React.

### E. Robustesse
- `fetchYoutubeVideos` peut échouer (proxy `/youtube-rss`) : le mode Pipeline fonctionne quand même à partir de `video_meta` ; le mode Catalogue affiche un avertissement discret (« vidéothèque indisponible »), pas de page vide ni de crash.
- États loading (skeleton) et vide soignés par mode.

## Responsabilités du module après fusion
- **Vue d'ensemble** : dashboard résumé.
- **Planning** : qui filme quel dimanche (assignations).
- **Vidéos** : cycle de vie des captations (du brut à l'archive publiée). ← fusion ici.
- **Équipe** : annuaire (contacts, rôles).
- **Programme** : déroulé du culte.

## Tests
- **Unitaire (Vitest)** : `mergeVideos` — union/matching par `video_id`, déduction de statut, calcul `isLate`, cas flux chaîne vide.
- **Rendu** : `VideosTab` monte en mode Pipeline et Catalogue, bascule OK, filtre statut OK, gère le flux chaîne en échec (affiche les fiches).
- **Manuel** : build vert (`npm run build`), puis vérif sur l'admin déployé (token dev) : onglet « Vidéos » présent, Pipeline + Catalogue alimentés, `/archives` redirige vers `/aefv`.

## Déploiement
`git push fork main` → rebuild Coolify (admin-psalm). Vérif post-déploiement.

## Notes
- Le fichier `ArchivesAdminPage.tsx` dépasse ~600 lignes ; l'extraction de `VideosTab` (et idéalement des autres onglets à terme) dans des fichiers dédiés améliore la lisibilité — on extrait au minimum `VideosTab` dans le cadre de ce travail.
- Pattern à répliquer ensuite sur PsalmMembre (`/video`) puis AEFVApp dans des sessions dédiées.
