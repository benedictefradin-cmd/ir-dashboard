# AUDIT — Refonte profils, relations & UX du dashboard Institut Rousseau

> Date : 2026-05-02 — auteur : revue automatisée
> Périmètre : `ir-dashboard` (back-office) + `institut-rousseau` (site public).
> L'audit précédent (sécurité/OAuth, clôturé le 2026-05-01) est archivé dans [AUDIT-2026-05-01.md](AUDIT-2026-05-01.md). Les sujets traités là-bas (PAT, OAuth, CSP, sanitize) ne sont pas repris ici.
>
> **Aucune ligne de code n'a été modifiée.** Ce document liste l'état réel et propose un plan, à valider avant tout chantier.

---

## 1. Cartographie des deux repos

| Élément | Dashboard `ir-dashboard` | Site public `institut-rousseau` |
|---|---|---|
| Repo GitHub | `benedictefradin-cmd/ir-dashboard` (privé) | `benedictefradin-cmd/institut-rousseau` (privé) |
| Hébergement | GitHub Pages (`https://benedictefradin-cmd.github.io/ir-dashboard/`) | Vercel (CNAME → `institut-rousseau.fr`, aujourd'hui sur l'URL Vercel temporaire en attendant le DNS — cf. mémoire `project_site_url_temp`) |
| Stack | React 18 + Vite, ~19 pages lazy-loaded, état React local + KV (Cloudflare Worker) | HTML statique vanilla, aucun build step, traduction maison FR/EN/ES/DE/IT |
| Backend | Cloudflare Worker `ir-dashboard-worker` (~1410 lignes, KV + secrets BREVO/TELEGRAM/GITHUB/TRANSLATE) | 2 fonctions Vercel : `api/contact.js`, `api/newsletter.js` |
| Données | RAS — sert de cliente uniquement | **Source de vérité** : `data/{auteurs,publications,events,presse,contenu,i18n}.json` + 261 fichiers HTML dans `publications/` |
| Communication | Le dashboard édite les fichiers du repo site via API GitHub authentifiée (token côté Worker depuis OAuth, cf. audit précédent §7.2) | Le push `main` du repo site déclenche un build Vercel (Git integration native) |

**CI/CD côté dashboard** : 2 workflows ([.github/workflows/](/.github/workflows/)) — `deploy.yml` (build + push GH Pages) et `smoke.yml` (Playwright sur PR).

**CI/CD côté site** : aucun workflow GitHub. Le déploiement est piloté par Vercel via webhook Git (push main → build), plus un Deploy Hook configurable manuellement (URL stockée dans le `localStorage` de l'utilisatrice, pas dans une config partagée — c'est un problème, voir §6).

---

## 2. Modèles de données — état réel

### 2.1 `data/auteurs.json` — 211 profils

Schéma observé :

```json
{
  "id": "nicolas-dufrene",          // slug stable
  "firstName": "Nicolas",
  "lastName": "Dufrêne",
  "role": "Président-directeur, économiste, haut fonctionnaire",
  "bio": "Directeur général de l'Institut Rousseau, …",
  "photo": "assets/images/equipe/nicolas-dufrene.png",
  "publications": 15                 // ⚠ COMPTEUR, pas une liste d'IDs
}
```

État qualité :
- **0 collision d'`id`** ✅
- **0 doublon par nom+prénom normalisés** (lowercase + sans accents + espaces simplifiés) ✅
- **62 / 211 profils sans photo** (29 %)
- **18 / 211 profils sans bio** (9 %)
- **163 / 211 profils sans `role`** (77 %) — ⚠ champ massivement vide
- Aucun champ pour réseaux sociaux (LinkedIn / X / site / email), date d'arrivée, statut actif/inactif
- `email` apparaît dans le formulaire dashboard ([src/pages/Profils.jsx:15](src/pages/Profils.jsx#L15)) mais n'est jamais persisté dans `data/auteurs.json`

**Bonne nouvelle** : la tâche "déduplication" du brief est déjà faite côté nommage. Le travail à venir est sur le **schéma** (champs manquants) et la **relation** (pas sur la fusion de profils en double).

### 2.2 `data/publications.json` — 260 entrées

Schéma observé :

```json
{
  "id": "trump-iran-strategie-petroliere-dernier-survivant",
  "title": "…",
  "author": "Nicolas Dufrêne",        // ⚠ STRING libre, pas d'ID, pas de tableau
  "date": "2026-04",
  "type": "Note",
  "categories": ["economie","international"],
  "color": "#2563EB",
  "description": "…",
  "slug": "…",
  "image": "assets/img/publications/…",
  "excerpt": "…",
  "url": "publications/….html",
  "featured": false,
  "readingTime": 17,
  "themes": ["economie","international"]
}
```

État qualité :
- **22 valeurs distinctes du champ `author`** sur 260 publications
- **1 seule valeur ne matche aucun profil** : `"un collectif d'économistes"` (1 publi)
- **8 publications avec 2+ co-auteurs** (séparateurs `,`, `&`, `et`) :
  - `Pierre Micheletti, Sophie Beau, Soazic Dupuis`
  - `Augustin Rogy, Émilie Fabre`
  - `Guillaume Kerlero de Rosbo, Nicolas Desquinado, Nicolas Dufrêne, Philippe Ramos`
  - `Marine Yzquierdo, Frantz Gault, Paul Montjotin`
  - `Valentin Chevallier, Guillaume Heim`
  - `Nicolas Dufrêne, Gaël Giraud, Benjamin Morel, René Dosière, Matthieu Caron`
  - `Gaël Giraud, Christian Nicol`
  - `Nicolas Dufrêne et un collectif d'économistes`
- **261 fichiers `.html` dans `publications/`** vs **260 entrées dans `publications.json`** — 1 page existe sans entrée JSON (drift à investiguer)
- **3 paires de traductions FR/EN détectées** (même image + même date) avec **slugs différents et `id` différents** :
  - `trump-iran-oil-strategy-last-survivor` (EN) ↔ `trump-iran-strategie-petroliere-dernier-survivant` (FR)
  - `big-oil-renewables` (EN) ↔ `majors-petrolieres-renouvelables-venezuela` (FR)
  - `critique-liberale-liberalisme` (FR) ↔ `crise-liberalisme-critique` (FR — variante)

⚠ Ces "doublons" multilingues sont un **modèle à clarifier** (cf. §6 question ouverte 1) : on les garde séparés ou on les regroupe sous une publication-mère avec versions linguistiques ?

### 2.3 Cohérence des compteurs `publications` dans les profils

Le champ `publications: <number>` du profil est **massivement obsolète** :
- **34 / 211 profils** ont un compteur différent du nombre réel de publis qui les citent
- **Total compteurs déclarés** : 75 — **total signatures réelles** : 274
- Top des écarts :

| Profil | Compteur déclaré | Réel |
|---|---:|---:|
| `louis-hervier-blondel` | 0 | **64** |
| `valentin-chevallier` | 0 | **60** |
| `institut-rousseau` (signature institutionnelle) | 0 | **52** |
| `antoine-cargoet` | 0 | **31** |
| `ophelie-coelho` | 3 | **27** |
| `nicolas-dufrene` | 15 | 6 |
| `guillaume-kerlero-de-rosbo` | 8 | 1 |
| `beverley-toudic` | 5 | 0 |
| `ano-kuhanathan` | 3 | 0 |
| `anais-voy-gillis` | 2 | 0 |

Le compteur n'est ni source de vérité, ni utilisable. La page Profils du dashboard recompte à la volée via `findPublicationsForAuthor` ([src/utils/constants.js](src/utils/constants.js)), mais le site public — s'il l'affiche — utilise potentiellement une valeur fausse.

### 2.4 Doublon `src/data/authors.json` côté dashboard

Le repo dashboard contient `src/data/authors.json` (522 lignes) — vestige du split-brain identifié dans l'audit précédent (§3.3). Marqué comme corrigé dans `4db682a`, mais le fichier est toujours présent. À supprimer.

---

## 3. Relation Publication ↔ Auteur — état réel

### Côté dashboard

- **`AuthorPicker` existe déjà** ([src/components/shared/AuthorPicker.jsx](src/components/shared/AuthorPicker.jsx)) : recherche debounced 150ms, multi-select, normalisation accents/casse, valeurs sortantes = **IDs de profil**. Bien fait.
- **Le picker est utilisé dans le flow "Publier"** ([src/pages/Articles.jsx:1127-1133](src/pages/Articles.jsx#L1127)).
- **MAIS** le formulaire d'édition d'article stocke `form.author` comme **string libre** ([src/pages/Articles.jsx:38, 782](src/pages/Articles.jsx#L38)) — pas un tableau d'IDs.
- Au moment de publier ([src/pages/Articles.jsx:204, 956, 975, 1032](src/pages/Articles.jsx#L204)), on reconvertit les IDs sélectionnés en chaîne de noms (`authorNames`) qui est écrite dans `publications.json` ET dans le HTML généré.
- Conséquence : **la relation par ID est perdue à la sauvegarde**. Le `AuthorPicker` est cosmétique pour l'instant, l'historique reste en string.

### Côté HTML généré

- Chaque publication HTML embarque le **nom + initiales + lien** auteur en dur ([src/pages/Articles.jsx:1390-1393](src/pages/Articles.jsx#L1390)).
- Si on renomme un profil, **les ~260 pages publiées ne suivent pas**.
- Avatar généré avec `authorInitials(authors)` ([src/pages/Articles.jsx:1287-1293](src/pages/Articles.jsx#L1287)) — pas la photo du profil.

### Côté site public

- L'AuthorPicker existe côté dashboard mais le site lui-même affiche `publi.author` en dur. Pas de lookup par ID.
- La fiche `/auteur/{slug}` existait sur l'ancien WP (cf. mémoire `reference_scraping_wp`) mais **aucune page `auteur/*.html` n'existe dans le repo site actuel** — la fiche profil n'est pas exposée publiquement aujourd'hui (à confirmer avec toi).

---

## 4. Pipeline GitHub → Vercel — état réel

### Mécanique en place

- **Push sur `main` du repo site → Vercel détecte → build → déploie** : c'est le mécanisme natif de l'intégration Git Vercel, supposé fonctionner.
- **Deploy Hook manuel** : [src/services/deploy.js](src/services/deploy.js) implémente un POST sur une URL stockée en localStorage (`vercelDeployHook`).

### Trous identifiés

1. **L'URL du Deploy Hook est en `localStorage`** : par utilisateur, par navigateur. Si Bénédicte change de poste, elle perd la config. Devrait être un secret côté Worker.
2. **Aucun statut visible dans le dashboard** : pas d'indicateur 🟢/🟡/🔴, pas de "Publié il y a X minutes", pas de polling Vercel API.
3. **Aucun viewer de logs** : impossible de voir les 5 derniers builds, leur statut, leurs erreurs.
4. **Aucun bouton "Forcer un nouveau déploiement"** facilement accessible (le code existe via `triggerRebuild`, mais pas de bouton dédié dans une page principale).
5. **`deploy.yml` du dashboard n'est pas relié à Vercel** : il sert au build GitHub Pages du dashboard lui-même, pas au déploiement du site.
6. **Le commit message du dashboard est générique** (`Publication ajoutée : xx`, `Publish: xx`, cf. `git log`) — pas de traçabilité fine de qui a publié quoi.

---

## 5. UX — synthèse rapide

- **Sidebar = 19 pages** (`Accueil, Articles, Calendrier, Contenu, Dashboard, EditeurVisuel, Equipe, Evenements, Medias, Messagerie, Navigation, Newsletter, PagesSite, Presse, Profils, SEO, Settings, Sollicitations, Technique`). Le brief demande de simplifier à **6 entrées principales** (Profils / Publications / Articles / Événements / Médias / Paramètres). Tout le reste devra être regroupé sous Paramètres ou supprimé.
- **Recherche globale `Cmd+K`** : absente.
- **Breadcrumbs** : absents.
- **Tableau de bord d'accueil** : la page `Accueil.jsx` existe mais n'agrège pas (à vérifier en détail) "derniers contenus modifiés + statut Vercel + mini-stats" tel que demandé.
- **Auto-save brouillon 30 s** : actuellement 3 s debounce ([src/hooks/useDraftAutosave.js](src/hooks/useDraftAutosave.js), ajouté `b04c2ce`) — déjà mieux que 30 s, à conserver tel quel.
- **Aperçu en direct split-screen** : absent (il y a un onglet "Aperçu" dans l'éditeur, mais pas un mode split).
- **Mode clair/sombre** : pas vu.
- **Raccourcis clavier `Cmd+S`/`Cmd+P`** : pas vus.
- **Confirmations de suppression** : `ConfirmDialog` existe ([src/components/shared/ConfirmDialog.jsx](src/components/shared/ConfirmDialog.jsx)), à généraliser.
- **Vignettes / photos en liste** : `RepoPhoto` est utilisé sur la page Profils, à généraliser à Publications & Événements.

---

## 6. Bugs & incohérences identifiés

| # | Sévérité | Sujet | Détail |
|---|---|---|---|
| 1 | 🔴 | Compteurs `publications` faux | Voir §2.3. À calculer dynamiquement, pas à stocker. |
| 2 | 🔴 | Relation auteur en string | Voir §3. Migration vers `authorIds: []` requise. |
| 3 | 🔴 | HTML publication = noms en dur | Voir §3. Renommer un profil ne propage pas. |
| 4 | 🟠 | 1 page HTML orpheline | `publications/` a 261 fichiers, `publications.json` 260 entrées. À identifier (probablement une page de test). |
| 5 | 🟠 | 3 paires FR/EN sans modèle de traduction | Voir §2.2. Risque de divergence éditoriale. |
| 6 | 🟠 | Deploy Hook en localStorage | Voir §4.1. Pas portable, pas partagé. |
| 7 | 🟠 | Aucun statut Vercel visible | Voir §4.2. Bénédicte ne sait pas si son push a marché. |
| 8 | 🟡 | `src/data/authors.json` orphelin | Voir §2.4. À supprimer. |
| 9 | 🟡 | 163 profils sans `role` | Voir §2.1. Pas un bug, mais qualité faible. |
| 10 | 🟡 | 62 profils sans photo | Voir §2.1. À combler progressivement. |
| 11 | 🟡 | Schéma profil sans `reseaux`, `actif`, `date_arrivee`, `email` persisté | Voir §2.1. Champs du brief absents. |
| 12 | 🟡 | Sidebar trop touffue (19 pages) | Voir §5. À regrouper. |
| 13 | 🟡 | Pas de `Cmd+K` global | Voir §5. À ajouter. |
| 14 | 🟢 | Commit messages publication peu descriptifs | Voir §4.6. À enrichir (titre, slug, auteur). |

---

## 7. Plan de chantier proposé — par PR

> Chaque chantier = 1 PR. Tu valides l'AUDIT, puis on attaque dans l'ordre.

### Chantier A — Schéma profil enrichi + suppression compteur (½ jour)

- Ajouter au schéma `data/auteurs.json` : `bioCourte`, `bioLongue` (split de l'actuel `bio`), `reseaux: { linkedin, x, site, email }`, `dateArrivee`, `actif: true|false`. Migration douce : ancien `bio` reste, nouveaux champs vides par défaut.
- **Supprimer** le champ `publications` du schéma (le calcul à la volée via `findPublicationsForAuthor` est déjà en place).
- Adapter le formulaire dashboard ([src/pages/Profils.jsx](src/pages/Profils.jsx)) pour exposer les nouveaux champs (sections Identité / Bio / Réseaux / Statut).
- Dump de sauvegarde dans `backups/profiles-2026-05-02.json` avant migration.
- `MIGRATION.md` : documenter le changement.

**Pas de fusion de doublons à faire** (audit §2.1 : 0 doublon détecté). Le brief Chantier 1 anticipait un travail qui s'avère déjà fait. On gagne du temps.

### Chantier B — Relation Publication ↔ Auteur par ID (1-2 jours)

1. **Schéma cible** dans `data/publications.json` : remplacer `"author": "Nicolas Dufrêne"` par `"authorIds": ["nicolas-dufrene"]` (toujours un tableau, même pour un seul auteur). Garder `author` en lecture seule pendant la transition (rétrocompat).
2. **Script de migration** `scripts/migrate-author-ids.mjs` :
   - Pour chaque publication, split le champ `author` (séparateurs `,`, `&`, `et`, `and`)
   - Lookup tolérant (normalisation accents/casse) dans `auteurs.json`
   - **Auto** si match unique sur chaque part : écrit `authorIds`
   - **Manuel** sinon : entrée dans `AUTHORS_MIGRATION.md` (à valider à la main par Bénédicte). Sur la base de l'audit, on attend ~1 cas (`"un collectif d'économistes"`) + les 8 multi-auteurs si doute.
   - Aucune création automatique de profil "fantôme" — toujours signaler.
   - Backup dans `backups/publications-2026-05-02.json`.
3. **Formulaire d'édition** ([src/pages/Articles.jsx](src/pages/Articles.jsx)) : passer `form.authorIds = []` au lieu de `form.author = ''`. L'AuthorPicker est déjà branché, il suffit de stocker sa sortie.
4. **Génération HTML** : le bloc `article-author-block` ([src/pages/Articles.jsx:1390](src/pages/Articles.jsx#L1390)) lit les profils par ID au moment de la publication et génère noms + initiales + lien fiche profil.

### Chantier C — Source unique côté site (1 jour)

- **Côté site** ([repo institut-rousseau](../institut-rousseau/)) : le rendu publications, équipe, presse doit lire `auteurs.json` et faire le lookup par ID au runtime (JS vanilla déjà en place). Pas de duplication de noms en dur dans les fichiers JSON satellites.
- **Pages auteur** : décider avec Bénédicte si on (re)crée des fiches `/auteur/{id}.html` — l'ancien WP en avait. Si oui, génération automatique au build (script `scripts/generate-author-pages.mjs` côté site).
- Vérifier qu'aucun composant front ne stocke des copies (équipe, presse, événements peuvent avoir le même problème — à inspecter).

### Chantier D — Pipeline visible dans le dashboard (1 jour)

- **Indicateur de statut Vercel sur la page d'accueil** :
  - 🟢 "Publié il y a X minutes" si dernier build = SUCCESS
  - 🟡 "Déploiement en cours…" avec spinner si BUILDING / QUEUED
  - 🔴 "Erreur — voir les logs" avec lien vers Vercel
- Implémentation : nouvelle route Worker `GET /api/vercel/deployments` qui appelle `https://api.vercel.com/v6/deployments?projectId=…&limit=5` avec un token Vercel stocké en secret Worker (à générer par Bénédicte sur https://vercel.com/account/tokens).
- **Bouton "Forcer un nouveau déploiement"** sur la page d'accueil + dans Paramètres.
- **Migrer le Deploy Hook URL** de localStorage → secret Worker pour que la config soit partagée et survive aux changements de navigateur.
- Affichage des **5 derniers builds** (statut, timestamp, commit message, durée, lien Vercel) dans Paramètres → Déploiements.

### Chantier E — Simplification UX (2-3 jours)

À découper en sous-PR si nécessaire :

1. **Sidebar regroupée à 6 entrées** : Profils / Publications / Articles / Événements / Médias / Paramètres. Le reste (Calendrier, Sollicitations, Newsletter, Messagerie, Navigation, Contenu, SEO, Equipe, Presse, PagesSite, Technique) passe sous Paramètres ou est masqué temporairement.
2. **Page d'accueil = vrai dashboard** : derniers contenus modifiés + statut Vercel (Chantier D) + mini-stats (nombre de profils, publis, événements à venir).
3. **`Cmd+K` recherche globale** sur profils + publications + articles + événements.
4. **Breadcrumbs** sur les pages d'édition.
5. **Listes** : recherche live + filtres par auteur/date/catégorie/statut + tri + actions en masse (publier/dépublier/supprimer). Vignettes (photo profil, image couverture).
6. **Formulaires** : champs groupés par section + validation FR + indication champs obligatoires.
7. **Raccourcis clavier** `Cmd+S` (sauver) / `Cmd+P` (publier) / `Esc` (annuler modal).
8. **Confirmations** systématiques avant suppression (utiliser `ConfirmDialog` partout).
9. **Mode clair/sombre** : préférence persistée en localStorage.

### Chantier F — Bonus (au coup par coup)

- **Suppression** du fichier orphelin `src/data/authors.json` du repo dashboard.
- **Identification** de la 261ᵉ page HTML sans entrée JSON (probablement un test).
- **Modèle de traduction** : décider FR/EN comme entrées séparées (statu quo) OU comme `versions: { fr, en }` sur une publication-mère. Voir question ouverte 1.
- **SEO du site** : revue des `<title>`, `<meta description>`, `og:image`, sitemap (déjà 60 Ko, à vérifier), `robots.txt` (déjà éditable via la page Technique).
- **Accessibilité** : audit des contrastes + alt-text obligatoire (déjà imposé dans l'éditeur depuis `b04c2ce`) + navigation clavier sur la sidebar regroupée.
- **Performance** : lazy-loading systématique des images de publications (déjà en place ?), virtualisation `react-window` sur les listes > 200 entrées (utile pour Profils 211 et Publications 260).
- **Commit messages enrichis** : `publish(publications): {slug} — {auteur(s)} — {date}` au lieu de `Publish: xx`.

---

## 8. Ordre recommandé & estimations

| Ordre | Chantier | Estimation | Pré-requis | Bénéfice |
|---|---|---|---|---|
| 1 | A — Schéma profil | ½ j | — | Foundations propres pour la suite |
| 2 | B — Relations par ID | 1-2 j | A | Cœur du brief, débloque C |
| 3 | C — Source unique côté site | 1 j | B | "Je renomme → ça suit partout" |
| 4 | D — Pipeline visible | 1 j | — (parallélisable) | Confiance utilisatrice + DX |
| 5 | E — UX | 2-3 j | A, B (pour les listes) | Brief explicite + adoption |
| 6 | F — Bonus | au fil de l'eau | — | Qualité long-terme |

**Total : 6-9 jours de travail sur le dashboard + 1 jour côté site (Chantier C). Tests + smoke compris.**

---

## 9. Questions ouvertes — à valider avant Chantier B

1. **Modèle des traductions FR/EN** (3 paires détectées, §2.2) : on garde **deux entrées séparées** avec leur propre slug et leur propre URL (statu quo) ou on regroupe sous une publication-mère avec `versions: { fr, en, ... }` ? Le statu quo est plus simple, le regroupement permet de partager les co-auteurs et les catégories.
2. **Fiches publiques `/auteur/{id}`** côté site : à recréer (l'ancien WP en avait) ou pas pertinent aujourd'hui ?
3. **Profil "Institut Rousseau"** : 52 publications signées comme l'entité elle-même. On garde ce profil "institutionnel" ou on signe avec les vrais auteurs au cas par cas ?
4. **Champ `actif`** : ça sert à filtrer les anciens contributeurs ? Si oui, comment l'historique des publis qu'ils ont signées doit s'afficher (lien vers fiche désactivée OK, ou pas de lien) ?
5. **Token API Vercel** (Chantier D) : tu peux en générer un sur https://vercel.com/account/tokens et me le passer pour que je le mette dans les secrets du Worker ? Sans token, on n'a pas accès aux statuts/logs.
6. **Page `EditeurVisuel.jsx`** : à conserver ou fusionner avec l'éditeur d'Articles ? Deux éditeurs séparés = source de divergence.

---

## 10. Ce que je ne fais pas tant que tu n'as pas validé

- Aucun changement de schéma `auteurs.json` ou `publications.json`.
- Aucune migration des publications existantes vers `authorIds`.
- Aucune suppression de `src/data/authors.json` (pour ne rien casser tant que tu n'as pas confirmé).
- Aucune touche à la sidebar / pages.
- Aucune révocation de token, aucune création de PAT/secret.

Une fois validé, je commence par le Chantier A (½ jour, foundation) puis enchaîne par PR atomiques en Conventional Commits sur `main`.
