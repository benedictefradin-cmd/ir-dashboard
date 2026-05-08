# AUDIT — Refonte « profil-centrée » du dashboard Institut Rousseau

> Date : 2026-05-08 — auteur : audit automatisé pour Bénédicte
> Périmètre : `ir-dashboard` (back-office) + `institut-rousseau` (site public).
> Audits antérieurs (sécurité OAuth + relations par ID) : voir [AUDIT-2026-05-01.md](AUDIT-2026-05-01.md) (clos) et [AUDIT-2026-05-02.md](AUDIT-2026-05-02.md) (Chantiers A→F bouclés).
>
> **Aucune ligne de code n'a été modifiée.** Ce document décrit l'état réel au regard du nouveau brief, identifie les écarts, propose un modèle cible, un plan, et liste les questions à valider avant tout chantier.

---

## 0. TL;DR

Le brief vise un dashboard « simple, fiable, centré sur le profil » couvrant 6 expériences (Profils, Publications, Messages, Newsletter, HelloAsso, Événements). Les **fondations sont déjà solides** grâce aux Chantiers A→F (mai 2026) :

- Auth OAuth GitHub + sessions KV ✅
- Schéma profil enrichi (bioCourte/bioLongue/reseaux/actif/dateArrivee) ✅
- Relations Publication ↔ Auteur par ID (`authorIds: []`) ✅
- Pipeline Vercel visible (statut + force deploy + 5 derniers builds) ✅
- Sidebar regroupée + recherche `Cmd+K` ✅
- Smoke test 18 pages en CI ✅

**Mais** plusieurs blocs du brief restent à faire ou ne sont qu'à moitié couverts. Les points critiques :

1. **Doublons profils** : 1 doublon confirmé (`nicolas-desquinado` ↔ `12407`), pas zéro comme l'audit du 2 mai l'affirmait — l'heuristique n'avait pas tenu compte des IDs numériques d'import WP.
2. **Schéma profil vs brief** : le brief demande un champ minimal (Prénom/Nom/Photo/LinkedIn/Description/Rôle/Email + checkbox « Afficher sur le site »). Aujourd'hui le formulaire a plus de champs (X, site perso, dateArrivee, actif, bioCourte/bioLongue) — il faut soit **réduire**, soit **garder mais avec une priorité visuelle claire**.
3. **Presse et Événements** : encore en `auteur: string libre` / `intervenants: [{name, titre}]`. Pas relié aux IDs profil. Migration de la même nature que Chantier B.
4. **Messages** : pas de routing CC par type d'objet (presse, publication, adhésion…). Reply existe mais pas la « copie aux profils internes » demandée.
5. **Newsletter** : compose+send+test fonctionnent, mais **aucun lien de désinscription** dans les envois — non-conformité RGPD bloquante.
6. **HelloAsso tracking** : 0 % fait. Aujourd'hui ce sont 4 liens HTML statiques sur `adhesion.html` et `don.html`, sans aucun tracking côté dashboard.
7. **Site = 5 langues, pas 3** : le brief évoque « les 3 langues du site » — la réalité est `fr, en, es, de, it` (cf. `assets/js/translation.js:18`). Décision à prendre : **on réduit à 3 langues** (et lesquelles), **on traduit dans les 5**, ou **on traite seulement FR+EN à la publication** ?

**Total estimé pour clore le brief** : 7-10 jours répartis sur 7 chantiers, fait par PR atomiques. Détaillé en §7.

---

## 1. Cartographie — état au 2026-05-08

### 1.1 Repos et hébergement

| Élément | `ir-dashboard` | `institut-rousseau` |
|---|---|---|
| Repo | privé, GitHub | privé, GitHub |
| Hébergement | GitHub Pages + Vercel (le front est sur les deux) | Vercel (CNAME `institut-rousseau.fr` — DNS encore WP au 2026-05-01, bascule prévue 2026-05-15) |
| Stack | React 18 + Vite (SPA, 19 pages, lazy-load) | HTML statique vanilla, traduction JS maison FR/EN/ES/DE/IT |
| Backend | Cloudflare Worker (`worker/index.js`, **2059 lignes**) | 2 fonctions Vercel (`api/contact.js`, `api/newsletter.js`) |
| Données | Aucune — éditeur de l'autre repo via API GitHub | **Source de vérité** : `data/{auteurs,events,presse,contenu,i18n}.json` + `assets/js/publications-data.js` (260+ pubs) + 261 fichiers `publications/*.html` |

### 1.2 Pages du dashboard

19 routes existent dans `App.jsx`. La sidebar les regroupe en 3 sections (Chantier E) — le code des pages individuelles n'a pas été supprimé, seul l'affichage a été simplifié.

| Page | Lignes | État vs brief | Action |
|---|---:|---|---|
| `Dashboard.jsx` | 439 | Existe + statut Vercel ✅ | À enrichir : HelloAsso clics |
| `Accueil.jsx` | 342 | Doublon de Dashboard ? | À clarifier |
| `Articles.jsx` | 1521 | Multi-auteurs par ID ✅ — pas de traduction auto à la publication | Auto-translate Anthropic à brancher |
| `Profils.jsx` | 768 | Recherche ✅ — pas de checkbox "Afficher email sur le site" | Ajouter checkbox + simplifier formulaire |
| `Evenements.jsx` | 523 | `intervenants: [{name, titre}]` (string libre) | Migrer vers IDs profil |
| `Presse.jsx` | 360 | `auteur: string` libre | Migrer vers IDs profil |
| `Sollicitations.jsx` | 769 | Reply email ✅ — pas de CC par type | Ajouter routing CC |
| `Messagerie.jsx` | 485 | Compositeur bulk Brevo+Telegram, séparé de Sollicitations | À fusionner ou clarifier |
| `Newsletter.jsx` | 273 | Compose+test+send ✅ — **pas de lien désinscription** | Ajouter footer désinscription |
| `Equipe.jsx` | 871 | Affiche les profils (équipe perma + CA + CS) | À aligner sur le rôle profil unifié |
| `Calendrier.jsx` | 979 | Calendrier éditorial KV | Hors brief — à conserver tel quel |
| `Medias.jsx` | 332 | Upload images repo site | Hors brief — OK |
| `Settings.jsx` | 774 | Users CRUD admin + Vercel + intégrations | À étendre : config routing CC |
| `EditeurVisuel.jsx` | 502 | Édition libre HTML page | Doublon partiel d'Articles — à reconsidérer |
| `Contenu.jsx`, `SEO.jsx`, `Navigation.jsx`, `PagesSite.jsx`, `Technique.jsx` | 46+322+448+44+239 | Édition de `contenu.json`, `i18n.json`, fichiers techniques | Hors brief — à conserver |

### 1.3 Worker — endpoints existants (extrait)

```
/api/auth/*                    OAuth GitHub + login/mdp legacy + users CRUD
/api/github/*                  proxy contents/list/publish/check
/api/brevo/*                   contacts, listes, send (single + bulk), campaigns
/api/contact                   POST public + back-office (sollicitations KV)
/api/contact/:id/reply         POST reply email via Brevo (From=contact@institut-rousseau.fr)
/api/contact/:id               PATCH status/notes/tags
/api/calendar/*                KV socialPosts/rapports/extEvents
/api/translate                 DeepL ou Anthropic Claude Haiku 4.5
/api/vercel/*                  status + force deploy (Chantier D)
```

**Manquants par rapport au brief** :
- `GET /api/helloasso/clicks/{adhesion|don}?period={day|week|month}` (compteurs HelloAsso)
- `POST /api/track/click` (incrémentation au clic, ou redirect tracking)
- `GET /api/messages/routing` + `PUT /api/messages/routing` (config CC par type d'objet)
- Hook newsletter : injection lien désinscription au moment du send + endpoint public `/api/newsletter/unsubscribe?token=…`

### 1.4 Stack tests

- **Vitest** (unitaires)
- **Playwright + axe-core** (smoke E2E sur 18 pages, en CI via `.github/workflows/smoke.yml`)
- Pas de tests d'intégration backend — chaque chantier devra étendre `tests/smoke.mjs`.

---

## 2. État des données — source de vérité

### 2.1 `data/auteurs.json` — 211 profils

**Schéma observé** (Chantier A appliqué) :

```json
{
  "id": "nicolas-dufrene",
  "firstName": "Nicolas",
  "lastName": "Dufrêne",
  "role": "Président-directeur, économiste, haut fonctionnaire",
  "bio": "Directeur général de l'Institut Rousseau, …",
  "bioCourte": "Directeur général de l'Institut Rousseau, …",
  "bioLongue": "",
  "photo": "assets/images/equipe/nicolas-dufrene.png",
  "reseaux": {
    "linkedin": "https://www.linkedin.com/in/…",
    "x": "",
    "site": "",
    "email": "nicolas.dufrene@institut-rousseau.fr"
  },
  "dateArrivee": "",
  "actif": true
}
```

**Qualité** :

| Métrique | Valeur |
|---|---|
| Total profils | **211** |
| Avec photo | 149 (62 sans, **29 %**) |
| Avec `bio` | 193 |
| Avec `bioCourte` | 193 (égal à `bio` dans la majorité — pas de split réel) |
| Avec `bioLongue` | **0** (champ vide partout) |
| Avec `role` | 48 (**163 sans**, soit 77 %) |
| Avec `dateArrivee` | **0** |
| Avec `reseaux.linkedin` | **2** (sur 211 !) |
| Avec `reseaux.email` | **2** |
| Actifs / inactifs | 211 / 0 |

**Observations** :
- L'enrichissement schéma de Chantier A a posé les champs mais **personne n'a saisi de données réelles** dedans. Le champ `bioCourte` est juste une copie de `bio`. `bioLongue` est vide partout. 209/211 profils sans LinkedIn alors que c'est une demande explicite du brief. Donc côté outil, le schéma est prêt ; côté contenu, **il y a une saisie de masse à faire par Bénédicte** avant que les nouvelles features (Profil = entité centrale) brillent.

### 2.2 Doublons de profils — résultats réels

L'audit du 2 mai déclarait « 0 doublon ». **C'est faux.** Re-test sur deux heuristiques (nom normalisé + Levenshtein ≤ 2 par bloc nom/prénom) :

| Pair | ID 1 | ID 2 | Verdict |
|---|---|---|---|
| Nicolas Desquinado / Nicolas Desquinabo | `nicolas-desquinado` | `12407` | **Doublon** — `12407` est un ancien import WP (ID numérique), `nicolas-desquinado` est la fiche canonique avec rôle saisi (« Membre du Conseil scientifique — Économi… »). Le brief mentionne explicitement « Nicolas Dezquinabo / Nicolas Desquinabo » — il s'agit du même cas, avec une 3ᵉ orthographe « Dezquinabo » qui n'existe plus dans le fichier mais qui a probablement transité par WP. |

**Heuristique élargie à investiguer manuellement** (à ce stade je n'ai pas de seconde paire détectée automatiquement) :
- IDs purement numériques restants dans `auteurs.json` : **1 seul** (`12407`). Les autres imports WP ont déjà été normalisés en slugs.
- Profils sans rôle (163) — risque de doublons cachés par champ `role` vide. À confirmer manuellement avec Bénédicte sur la liste complète.

**Ce que je propose** : avant Chantier-Profils, je génère un rapport CSV des 211 profils trié par `lastName` puis `firstName` normalisés, avec colonnes (id, firstName, lastName, role, photo?, hasLinkedIn?, sigsRecues), et tu valides à la main les fusions à faire. Le brief impose explicitement la **validation manuelle de chaque fusion**, pas d'auto-fusion.

### 2.3 `assets/js/publications-data.js` — 260 entrées (Chantier B appliqué)

Schéma post-migration :

```js
{
  id: "trump-iran-strategie-petroliere-dernier-survivant",
  title: "…",
  authorIds: ["nicolas-dufrene"],   // ✅ tableau d'IDs
  author: "Nicolas Dufrêne",          // miroir lecture seule, conservé pour rétrocompat
  date: "2026-04",
  type: "Note",
  ...
}
```

**État** : 258/260 publications migrées automatiquement. 2 cas non résolus à la migration ([AUTHORS_MIGRATION.md](AUTHORS_MIGRATION.md)) :
- `transformons-la-monnaie-transition-ecologique` : « Nicolas Dufrêne et un collectif d'économistes » → ajouter Dufrêne + créer un profil "Collectif" ou retirer
- `entraide` : « Ilian Moundib » → profil à créer

À traiter pendant le Chantier 1 (Profils), avec validation Bénédicte.

### 2.4 `data/events.json` — 9 entrées

**Schéma observé** :

```json
{
  "id": "...",
  "title": "...",
  "sousTitre": "...",
  "date": "...",
  "lieu": "...",
  "type": "...",
  "intervenants": [
    { "name": "Nicolas", "titre": "Directeur" }
  ],
  "lienInscription": "...",
  "partenaire": "...",
  "externe": false,
  "status": "..."
}
```

**Problème** : `intervenants[].name` est une **chaîne libre**. Aucun lien aux profils. Renommer Nicolas Dufrêne → Nicolas D. dans `auteurs.json` ne propage pas. Migration **identique** à Chantier B mais sur 9 entrées seulement (rapide).

### 2.5 `data/presse.json` — 65 entrées

**Schéma observé** :

```json
{
  "id": "...",
  "title": "...",
  "media": "Le Monde",
  "auteur": "Nicolas Dufrêne",      // ⚠ STRING libre, pas d'IDs
  "type": "Tribune",
  "date": "...",
  "url": "..."                        // (mémoire récente : `url` était `urlExterne`, fix `6c45d71`)
}
```

**Problème** : même que §2.4. Migration nécessaire vers `authorIds: []`. 65 entrées à traiter, dont une partie pointe sans doute vers des personnes externes à l'institut (pas dans `auteurs.json`) — il faudra **créer ces profils** ou marquer `auteur` comme externe (champ `auteurExterne: "Jean Dupont"` quand pas dans la base).

### 2.6 `data/contenu.json`

Édité par les pages Contenu/SEO/Navigation/Equipe. Contient chiffres clés, membres CA + Conseil scientifique, footer. **Lien indirect avec les profils** via membres CA/CS — à vérifier qu'on ne stocke pas une 2ᵉ copie nominative ici (mémoire `project_content_architecture.md` mentionne que c'est cohérent, mais à vérifier au moment du chantier Profils).

### 2.7 Sollicitations (KV `contact:*`)

Chaque message stocké en KV avec :
- `id`, `email`, `name`, `subject`, `message`
- `objet` (parmi `general, press, partnership, expert, publication, membership, bug, other` — cf. `i18n.json` clés `contact.opt_*`)
- `status` (`new`, `read`, `replied`, `resolved`, `archived`)
- `tags`, `notes`, `replies[]`

**Reply** : `POST /api/contact/:id/reply` envoie via Brevo avec `From=contact@institut-rousseau.fr` et `To=email_de_la_personne`.

**Manquant** : pas de CC. Pas de routing « si objet=presse → CC linda@.. + benedicte@.. ». Cf. §5.

---

## 3. Modèle de données cible

### 3.1 Profil — entité centrale

Schéma cible (avec mapping vers le brief) :

```jsonc
{
  "id": "nicolas-dufrene",                  // SLUG STABLE — clé de référence partout
  "firstName": "Nicolas",                    // brief: Prénom
  "lastName": "Dufrêne",                     // brief: Nom
  "photo": "assets/images/equipe/...",       // brief: Photo
  "description": "Directeur général …",      // brief: Description (= ancien `bio` / `bioCourte`)
  "role": "membre",                          // brief: Rôle — sélecteur fermé, voir §3.1.1
  "roleLibelle": "Président-directeur",      // libellé libre (l'actuel `role` qui contient la fonction)
  "email": "nicolas.dufrene@…",              // brief: e-mail
  "emailPublic": false,                      // brief: case "Afficher sur le site" (default false)
  "linkedin": "https://www.linkedin.com/…",  // brief: Lien LinkedIn
  "actif": true,                             // garder du Chantier A
  "_legacy": {                               // champs Chantier A à supprimer progressivement
    "bio": "...", "bioCourte": "...", "bioLongue": "...",
    "reseaux": { "x": "", "site": "", "email": "..." },
    "dateArrivee": ""
  }
}
```

**Champs supprimés** par rapport à Chantier A (le brief les juge superflus) :
- `bioLongue` — vide partout, jamais utilisé
- `reseaux.x`, `reseaux.site` — pas demandés par le brief
- `dateArrivee` — vide partout, le brief n'en parle pas
- `bioCourte` — fusionné avec `description`

Migration douce : on **renomme** `bioCourte` (ou `bio`) → `description`, on **fusionne** `reseaux.linkedin` → `linkedin` + `reseaux.email` → `email`, on **supprime** le reste, et on garde un objet `_legacy` pendant 1 mois pour rollback.

#### 3.1.1 Champ `role` — sélecteur fermé

Le brief dit : « équipe / conseil scientifique / autre — à compléter selon ce qui existe ». Aujourd'hui `data/contenu.json` a 4 sections (équipe permanente / CA / conseil scientifique / direction) et la page Equipe les affiche distinctement. Proposition de valeurs **fermées** :

```
"role": "equipe" | "ca" | "conseil_scientifique" | "auteur_externe" | "autre"
```

- `equipe` : équipe permanente salariée
- `ca` : conseil d'administration
- `conseil_scientifique` : conseil scientifique
- `auteur_externe` : signataire de publications/presse, pas dans l'institut
- `autre` : tout le reste

`roleLibelle` reste un champ texte libre pour le titre/fonction affiché publiquement (ex: « Présidente », « Économiste, spécialiste du climat »).

### 3.2 Publication

Déjà migrée Chantier B. Pas de changement, mais **suppression progressive** du champ miroir `author: string` dès que tous les renderers (site + dashboard) lisent par ID.

### 3.3 Presse

```jsonc
{
  "id": "...",
  "title": "...",
  "media": "Le Monde",
  "type": "Tribune | Entretien | Podcast",
  "date": "2026-05-...",
  "url": "...",
  "authorIds": ["nicolas-dufrene"],         // 🆕 IDs profil
  "auteurExterne": "Jean-Marc Jancovici"    // 🆕 fallback si pas un profil de l'institut
}
```

### 3.4 Événements

```jsonc
{
  "id": "...",
  "title": "...",
  "date": "...",
  "lieu": "...",
  "type": "...",
  "lienInscription": "...",
  "intervenants": [
    {
      "profileId": "nicolas-dufrene",       // 🆕 référence
      "titreEvent": "Modérateur"            // titre dans le contexte de cet event
    },
    {
      "nameExterne": "Jean Dupont",         // intervenant non-profil
      "titreEvent": "Conférencier"
    }
  ]
}
```

### 3.5 Messages (Sollicitations) — config routing

Nouvelle entrée dans `contenu.json` ou en KV partagé :

```jsonc
{
  "messageRouting": {
    "press":      { "ccProfileIds": ["benedicte-fradin", "linda-..."] },
    "publication":{ "ccProfileIds": ["nicolas-dufrene"] },
    "expert":     { "ccProfileIds": ["nicolas-dufrene", "..."] },
    "partnership":{ "ccProfileIds": ["benedicte-fradin"] },
    "membership": { "ccProfileIds": ["benedicte-fradin"] },
    "bug":        { "ccProfileIds": [] },
    "general":    { "ccProfileIds": [] },
    "other":      { "ccProfileIds": [] }
  }
}
```

**Important** : la résolution se fait **au moment du send**, en lisant `email` du profil (pas `emailPublic`). Si `email` est vide → on signale l'erreur, pas de fallback silencieux.

### 3.6 Newsletter

`data/newsletter-subscribers.json` ou liste Brevo dédiée — déjà géré par Brevo aujourd'hui. Schéma Brevo enrichi avec :

- `unsubscribeToken` : généré à l'inscription, stocké côté Brevo (attribute custom)
- `inscribedAt`, `status` (`active` / `unsubscribed`)

Endpoint public : `GET /api/newsletter/unsubscribe?token=…&list=…` côté Worker.

### 3.7 HelloAsso clicks (KV)

```
KV key: helloasso:click:{type}:{YYYY-MM-DD}
KV value: { count: N }
```

avec `type ∈ {adhesion, don}`. Agrégation jour/semaine/mois côté Worker au moment du `GET /api/helloasso/stats`.

Capture du clic : le site appelle `POST /api/helloasso/click` (ou `GET` redirect 302) avant de rediriger vers helloasso.com. Pas d'identification nominative (RGPD OK).

---

## 4. Pipeline de propagation — vérification

### 4.1 Profil → Publications, Presse, Événements

| Source | État aujourd'hui | Cible |
|---|---|---|
| Publications | ✅ ID via Chantier B | OK — il faut juste retirer le miroir `author: string` |
| HTML publication (`publications/{slug}.html`) | ⚠ Affiche nom auteur calculé via `assets/js/article-author.js` au runtime | OK — déjà fait Chantier C, lookup par ID |
| Page `/auteur/{id}` du site | ❌ N'existe pas encore (mémoire `reference_scraping_wp` indique que l'ancien WP en avait) | À recréer (template `auteurs/_template.html` + génération côté site) |
| `/equipe.html` | ⚠ Lit `data/contenu.json` (membres CA/CS) **et** `data/auteurs.json` | À unifier : tout via `auteurs.json`, filtré par `role` |
| `/auteurs.html` | ✅ Lit `data/auteurs.json` directement | OK |
| Presse (`presse.html`) | ❌ Lit `auteur: string` libre | Migrer vers ID + lookup runtime |
| Événements (`evenements.html`) | ❌ Lit `intervenants[].name` libre | Migrer vers ID + lookup runtime |

### 4.2 Suppression d'un profil

Aujourd'hui, supprimer un profil dans le dashboard ne vérifie aucune référence. Risque : page `/auteur/{id}` 404 + cards publi avec lien cassé. **Action** : avant suppression, vérifier qu'aucune publication/presse/événement ne référence l'ID. Si oui, proposer la **fusion** (cf. tombstone §5.4) ou refuser la suppression.

### 4.3 Renommage / fusion d'un profil

Modifier le `firstName`/`lastName` propage automatiquement sur le site (lookup runtime par ID). Modifier l'`id` est **interdit** (l'ID est immutable) — si besoin de changer le slug, c'est une fusion vers un nouvel ID.

---

## 5. Audit par section du brief

### 5.1 Profils

| Demande brief | État | Gap |
|---|---|---|
| Liste avec recherche + filtres par rôle | ✅ recherche live debouncée, mais **pas de filtre rôle** | Ajouter dropdown filtre rôle |
| Détection / fusion doublons validée par moi | ❌ Pas d'outil | Construire un écran « Doublons potentiels » avec validation manuelle |
| Champs minimaux du brief | ⚠ Schéma plus large | Réduire (cf. §3.1) |
| Checkbox « Afficher email sur le site » | ❌ Absent | Ajouter `emailPublic: bool` |
| Publications associées calculées auto | ✅ `findPublicationsForAuthor` | OK |
| Propagation auto des modifs | ✅ pour publi (Chantier C) | À étendre presse + événements |

### 5.2 Publications

| Demande brief | État | Gap |
|---|---|---|
| Un seul formulaire compact | ✅ Articles.jsx unique | OK |
| Choix langue saisie | ⚠ `translations: {}` existe en placeholder | UI pour saisir une 2ᵉ langue manquante |
| Type compact (pas de description longue) | ✅ Sélecteur avec labels uniquement | OK |
| Auteurs autocomplete + multi-select | ✅ AuthorPicker, Chantier B | OK |
| Lien "créer profil si manquant" depuis le formulaire | ❌ | Ajouter raccourci "Nouveau profil" → modale |
| Multilingue + traduction auto Anthropic | ❌ Endpoint `/api/translate` existe **mais pas branché à la publication** | Brancher : si publi sans `translations.{lang}` → call Anthropic + marquer `autoTranslated: true` éditable |
| Filtres listing (type, langue, auteur, date) | ⚠ partiel | Ajouter filtre langue + auteur |

### 5.3 Messages

| Demande brief | État | Gap |
|---|---|---|
| Messages reçus dans onglet Messages | ✅ Sollicitations | Renommer "Messages" si tu veux |
| Copie e-mail à `contact@institut-rousseau.fr` | ⚠ envoyé par Brevo From=contact@... mais pas auto-bcc à l'inbox contact@ | À vérifier : Brevo envoie-t-il une copie à l'inbox du domaine ? Sinon, ajouter `bcc: contact@…` |
| Routing CC par type d'objet | ❌ | Cf. §3.5 |
| Réponse depuis dashboard (From/To/CC + historique) | ⚠ From/To OK, **CC absent**, historique conservé en KV | Ajouter CC + UI saisie CC additionnels |

**Sub-question (§5.3)** : la boîte `contact@institut-rousseau.fr` est hébergée chez quel fournisseur (Gmail Workspace / OVH / Brevo SMTP / autre) ? Le brief demande explicitement de me poser la question — **réponse attendue** (cf. §8 Q3).

### 5.4 Suppression / fusion / tombstones

Le brief impose un mécanisme de **tombstone** : ne jamais supprimer brutalement, marquer comme `mergedInto: <id>` pour traçabilité. Aujourd'hui rien.

Schéma de fusion proposé :

```jsonc
// Profil source de la fusion (le doublon)
{
  "id": "12407",
  "actif": false,
  "mergedInto": "nicolas-desquinado",
  "mergedAt": "2026-05-08T14:23:00Z",
  "mergedBy": "benedictefradin-cmd"
}
```

Le site filtre `actif !== false` → invisible. Le dashboard affiche un onglet "Profils archivés" en lecture seule. Toute référence (publi/presse/event) à `12407` est réécrite vers `nicolas-desquinado` au moment de la fusion (script atomique, voir §6.2).

### 5.5 Newsletter

| Demande brief | État | Gap |
|---|---|---|
| Inscription site → notif dashboard + mail confirmation auto | ✅ partiel — Brevo gère le double opt-in si configuré | À vérifier que c'est activé sur la liste Brevo |
| Base inscrits avec recherche / export CSV / désinscrip manuelle | ✅ via Settings | OK |
| Composer + envoyer depuis dashboard | ✅ | OK |
| Test send avant blast | ✅ | OK |
| **Lien désinscription obligatoire dans chaque envoi** | ❌ **GAP RGPD bloquant** | Injecter footer auto avec `<a href="https://api.../newsletter/unsubscribe?token=…">Se désabonner</a>` côté Worker au send |

### 5.6 Suivi HelloAsso (entièrement à construire)

Aujourd'hui : 4 liens HTML statiques sur `adhesion.html` et `don.html` du site. Pas de tracking.

À faire :
1. Ajouter une route Worker `GET /h/{type}` (où type ∈ adhesion/don) qui :
   - Incrémente `helloasso:click:{type}:{YYYY-MM-DD}` en KV
   - Renvoie un 302 vers le bon lien HelloAsso
2. Côté site : remplacer les `<a href="https://www.helloasso.com/...">` par `<a href="https://ir-dashboard-api.../h/adhesion">`. 6 occurrences au total.
3. Worker `GET /api/helloasso/stats?period={day|week|month}` agrège les compteurs.
4. Page Dashboard accueil : 2 cartes (Adhésions / Dons) avec compteurs jour/semaine/mois + courbe Recharts (la dépendance est déjà installée).
5. **RGPD** : aucun cookie, aucune IP loggée — juste un compteur agrégé. À mentionner dans `confidentialite.html` du site.

### 5.7 Événements

| Demande brief | État | Gap |
|---|---|---|
| Liste à venir/passés + recherche + filtres | ⚠ partiel | À renforcer |
| Création/édition champs essentiels | ✅ titre, date, lieu, description, image, lienInscription, intervenants | OK |
| **Intervenants liés aux profils par ID** | ❌ string libre | Migration cf. §3.4 |
| Vue calendrier optionnelle | ⚠ `Calendrier.jsx` existe pour le calendrier éditorial, pas pour les events publics | À évaluer — pas prioritaire |

### 5.8 Au-delà du brief — remarques

- **Auth** : OAuth GitHub + sessions KV avec PBKDF2 — déjà solide. Pas de magic link. **Suffisant** pour cette phase.
- **Sauvegardes** : aujourd'hui aucune sauvegarde automatique côté KV (Brevo et GitHub ont leurs propres backups). À ajouter : dump quotidien des sollicitations KV → R2 ou GitHub (cf. §7).
- **Historique des modifications** : `git log` du repo site est l'historique de fait pour les contenus. Pour KV (sollicitations, calendrier) : pas d'historique. À évaluer.
- **Permissions** : aujourd'hui `admin` / `editor` (rôle KV) — peu utilisé en pratique (Bénédicte est admin). Suffisant pour l'instant.
- **Performance** : 211 profils + 260 publications, pas de virtualisation, mais OK aux tailles actuelles. Ajouter `react-window` au-delà de 500.

---

## 6. Risques et migration

### 6.1 Risques par chantier

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Fusion de doublon mal validée → pubis ré-attribuées au mauvais profil | Moyenne | Haut (image publique) | **Validation manuelle par toi de chaque fusion**, dump backup avant chaque op, rollback documenté |
| Migration `auteur:string` → `authorIds[]` sur presse rate des cas | Moyenne | Moyen | Mêmes garde-fous que Chantier B (script + manual ambiguities + backups). Bonus : presse n'a que 65 entrées, manuel possible si nécessaire. |
| Suppression du miroir `author: string` casse une lecture côté site | Faible | Moyen | Garder `author` en lecture seule pendant 1 mois, le supprimer après vérification de tous les renderers du site |
| Newsletter : injection footer désinscription casse les emails existants | Faible | Haut (RGPD) | Activer feature flag, tester sur 1 envoi, ouvrir 5 inboxes (Gmail/Outlook/Apple/Yahoo/web) |
| HelloAsso redirect : si Worker tombe, les liens sont morts | Faible | Très haut (revenu) | Fallback côté site : `<a href onClick="track(); window.location='https://helloasso.com/...';">` — la page va sur HelloAsso même si tracking down |
| Routing CC envoie un email à un destinataire inattendu | Moyenne | Haut (gouvernance) | Confirmation visuelle avant send (« CC : Nicolas Dufrêne, Linda… »), modifiable manuellement par l'utilisateur |
| Vercel build cassé pendant migration de schéma | Faible | Moyen (dashboard down) | Smoke test pré-merge, rollback Vercel en 1 clic |

### 6.2 Procédure de fusion de profils — détaillée

1. **Snapshot complet** : commit dump `backups/profiles-2026-05-08.json` + `backups/publications-data-2026-05-08.json` + `backups/presse-2026-05-08.json` + `backups/events-2026-05-08.json` dans le repo site.
2. **Détection** : script `scripts/detect-duplicates.mjs` génère `reports/duplicates-2026-05-08.csv` avec colonnes `id1, name1, id2, name2, score, signaturesCommune`.
3. **Validation manuelle** : tu coches dans le CSV chaque ligne `confirmed=yes/no/?`.
4. **Fusion (par paire confirmée)** : script `scripts/merge-profiles.mjs --keep nicolas-desquinado --merge 12407` fait :
   a. Crée le tombstone (`actif: false`, `mergedInto: "..."`, `mergedAt`, `mergedBy`)
   b. Réécrit toutes les `authorIds: [..., "12407", ...]` → `[..., "nicolas-desquinado", ...]` dans publications-data.js, presse.json, events.json
   c. Vérifie qu'aucune référence orpheline n'existe (`scripts/check-references.mjs`)
   d. Commit unique avec message `merge(profiles): 12407 → nicolas-desquinado`
5. **Rollback** : si erreur, `git revert <commit>` côté site rétablit le tombstone et les ID. Les backups JSON sont conservés au moins 30 jours.

### 6.3 Définition de staging

Aujourd'hui : pas de staging dédié. Le repo site a un seul environnement (Vercel prod = `main`). **Proposition** :

- Branche `staging` côté site → déploiement Vercel preview automatique (gratuit, déjà géré par Vercel)
- Le dashboard a un toggle Settings « pousser vers staging au lieu de main » (variable `VITE_SITE_BRANCH=staging`)
- Une fois la recette OK, merge `staging → main` côté site déclenche le build prod

Coût : ~½ jour à mettre en place. **Question Q4** ci-dessous.

---

## 7. Plan d'exécution proposé — par chantier

> Chaque chantier = 1 à N PRs atomiques, smoke tests étendus, recette manuelle avec toi.

### Chantier 1 — Profils refondus (1-2 jours)

**Objectif** : profil = entité centrale, schéma resserré, doublons purgés, checkbox email public.

1. Refonte schéma `auteurs.json` : `description`, `role` (enum fermé), `roleLibelle`, `email`, `emailPublic`, `linkedin`. Champs Chantier A déplacés sous `_legacy.*`.
2. Migration douce : script `scripts/migrate-profiles-2026-05-08.mjs` + backup.
3. Refonte formulaire `Profils.jsx` : sections claires (Identité / Photo / Description / Contact / Statut), checkbox « Afficher cet email sur le site », filtre rôle dans la liste.
4. Outil **Doublons** : nouvel onglet Profils → "Doublons potentiels", validation manuelle 1-clic.
5. Procédure de fusion (§6.2) avec scripts dédiés.
6. Suppression progressive des champs `_legacy.*` après 1 mois (Chantier 9).
7. Script de vérification : aucune référence orpheline.

### Chantier 2 — Presse migrée vers IDs (½ jour)

1. Migration `data/presse.json` : `auteur: "X"` → `authorIds: ["x"]` + `auteurExterne` pour les non-profils.
2. Adapter `Presse.jsx` (formulaire) : AuthorPicker + champ "Auteur externe (si pas dans la base)".
3. Côté site : `assets/js/presse.js` lit `authorIds` au runtime + lookup `auteurs.json`.
4. Backup `backups/presse-pre-migration-2026-05-08.json`.

### Chantier 3 — Événements migrés vers IDs (½ jour)

1. Migration `data/events.json` : `intervenants[].name` → `intervenants[].profileId` + `nameExterne` fallback. (9 entrées seulement.)
2. Adapter `Evenements.jsx` (formulaire) : AuthorPicker pour intervenants, champ "Titre dans cet événement" (`titreEvent`).
3. Côté site : `assets/js/events.js` lookup runtime.

### Chantier 4 — Backend e-mail mutualisé Messages + Newsletter (1-2 jours)

> **Pré-requis** : réponse Q3 (fournisseur boîte `contact@institut-rousseau.fr`).

1. **Routing CC par type** : `Settings.jsx` → onglet "Routing messages", édite `contenu.json.messageRouting`.
2. **Reply Sollicitations** : route Worker `/api/contact/:id/reply` ajoute le CC résolu depuis le routing + permet ajout manuel + envoie BCC à `contact@…`.
3. **Newsletter footer désinscription** : Worker injecte `<hr><p style="font-size:11px"><a href="…/newsletter/unsubscribe?token=…">Se désabonner</a></p>` au moment du `/api/brevo/email/send` si `list=newsletter`. Token = HMAC(email, secret).
4. **Endpoint public désinscription** : `GET /api/newsletter/unsubscribe?token=…` valide HMAC, désinscrit côté Brevo, affiche page de confirmation.
5. **Tests d'envoi** : 1 mail réel à toi + Bénédicte sur Gmail/Outlook/Apple Mail.

### Chantier 5 — Suivi HelloAsso (½ jour)

1. Worker : `GET /h/{type}` (redirect+count), `GET /api/helloasso/stats?period=…`.
2. Site : remplacer les 6 `<a href="https://helloasso.com/…">` par les liens trackés.
3. Dashboard `Accueil.jsx` ou `Dashboard.jsx` : 2 cartes + courbe.
4. Doc privacy : ajouter mention dans `confidentialite.html` du site.

### Chantier 6 — Auto-traduction publications (½ jour, optionnel)

> **Pré-requis** : réponse Q1 (langues à traduire).

1. `Articles.jsx` : au "Publier", si une langue cible est manquante, appeler `/api/translate` avec `model=anthropic`, mettre `autoTranslated: true` éditable.
2. UI : badge "Traduction auto" + bouton "Modifier la traduction".

### Chantier 7 — UX globale (1-2 jours)

1. Recherche live + filtres rôle/type/langue/date sur **toutes** les listes (Profils, Articles, Presse, Évents).
2. Confirmation systématique avant suppression (déjà partiel).
3. Responsive mobile vérifié.
4. Audit accessibilité (clavier + contrastes WCAG AA) + corrections.
5. Aligner design system sur le site public (couleurs, typographie).

### Chantier 8 — Nettoyage / dette (½ jour)

1. Supprimer `_legacy.*` de `auteurs.json` après 1 mois en prod stable.
2. Supprimer le miroir `author: string` des publications.
3. Supprimer pages dashboard non utilisées (à valider) : `EditeurVisuel`, `Accueil` vs `Dashboard` doublon ?
4. Documentation `README.md` + `CHANGELOG.md` + `DECISIONS.md`.

### Chantier 9 — Recette + déploiement staging (½-1 jour)

1. Définir staging (cf. §6.3).
2. Recette complète avec toi.
3. Plan de rollback documenté.
4. Bascule prod.

### Ordre & dépendances

```
1. Profils ──┬──► 2. Presse
             ├──► 3. Événements
             └──► 4. Messages routing  (besoin des emails profils CC)
4. Messages ─────► 5. Newsletter footer  (mutualise infra mail)
                                                 6. Auto-trad (peut être en parallèle)
                                                 5b. HelloAsso (parallèle, indépendant)
=> 7. UX (consomme tout)
=> 8. Nettoyage
=> 9. Staging + recette
```

**Total : 7-10 jours** selon réponses Q1 (auto-trad) et Q3 (mail).

---

## 8. Questions à valider — bloquantes avant Chantier 1

1. **Langues du site** : la réalité est **5 langues** (`fr, en, es, de, it`). Le brief mentionne « 3 langues du site ». Tu confirmes :
   - (a) on garde 5 langues et la traduction auto vise FR + 4 autres ;
   - (b) on réduit à 3 langues, lesquelles ;
   - (c) on traduit seulement FR + EN à la publication, les 3 autres restent saisies à la main quand quelqu'un veut.

2. **Profils — schéma vs Chantier A** : on **réduit** les champs aux strict minimum brief (description, role, email, emailPublic, linkedin) en archivant le reste sous `_legacy`, ou **on garde** le schéma actuel enrichi (bioCourte, bioLongue, x, site, dateArrivee) en y ajoutant simplement `emailPublic` et le rôle fermé ? Le brief dit « champs minimaux » donc je penche pour la réduction. Confirmes-tu ?

3. **Boîte `contact@institut-rousseau.fr`** : hébergée chez quel fournisseur ?
   - (a) Gmail Workspace
   - (b) Brevo SMTP
   - (c) OVH
   - (d) autre
   Selon la réponse, l'envoi des replies se fait soit via Brevo (déjà en place) soit via SMTP du fournisseur. Le BCC vers la boîte pour archive est aussi configuré différemment.

4. **Staging** : on met en place une branche `staging` côté site + preview Vercel, ou on continue à pousser direct sur `main` (statu quo) ? Je recommande l'introduction de staging pour les chantiers Messages/Newsletter (changements e-mail) — risque si on rate.

5. **Doublons profils** : je te génère le rapport CSV trié par nom normalisé pour validation manuelle, puis on traite par lots. **Tu valides cette procédure** (script + CSV + ton OK paire par paire) ?

6. **Profils archivés (mergedInto)** : on les laisse `actif: false` (visibles dans l'admin "Archives" mais invisibles publics), ou on les supprime totalement après 30 jours ? Je recommande de les garder définitivement pour traçabilité.

7. **Page `Accueil.jsx` vs `Dashboard.jsx`** : pourquoi 2 pages ? Doublon ? Une à supprimer ?

8. **`EditeurVisuel.jsx`** : usage réel ? Si l'éditeur d'Articles couvre tous les besoins, on le supprime au Chantier 8.

9. **Permissions** : aujourd'hui `admin` / `editor`. Sur la nouvelle vision, tu seras **seule** ou plusieurs personnes auront accès ? Si solo, on peut simplifier.

10. **Magic link / 2FA** : auth actuelle (OAuth GitHub + login/mdp PBKDF2) suffit-elle ? Pas demandé explicitement par le brief mais mentionné dans "À investiguer".

---

## 9. Ce que je ne fais pas tant que tu n'as pas validé

- Aucune modification de schéma `auteurs.json` / `presse.json` / `events.json`.
- Aucune fusion de profils, même `12407` ↔ `nicolas-desquinado`.
- Aucune suppression de page dashboard.
- Aucune modification du flow d'envoi d'emails (Brevo, sollicitations replies, newsletter).
- Aucun déploiement.

Une fois tes réponses validées, je commence par le **Chantier 1 (Profils)**, par PR atomiques en Conventional Commits sur `main` (ou `staging` si on instaure la branche).

---

## 10. Annexes — fichiers de référence

- Audit antérieur sécurité : [AUDIT-2026-05-01.md](AUDIT-2026-05-01.md)
- Audit antérieur relations : [AUDIT-2026-05-02.md](AUDIT-2026-05-02.md)
- Migration auteurs IDs : [AUTHORS_MIGRATION.md](AUTHORS_MIGRATION.md)
- Migration sécurité OAuth : [MIGRATION.md](MIGRATION.md)
- Conventions projet : [CLAUDE.md](CLAUDE.md)
