# AUDIT — Dashboard Institut Rousseau

> État réel du repo `ir-dashboard` au 2026-05-01, avant refonte vers le modèle GitHub-as-CMS + OAuth GitHub.
> Ce document n'est **pas** un plan d'action validé : il liste ce qui existe, ce qui marche, ce qui ne marche pas, ce qui est dangereux, et propose un découpage P0/P1/P2 à valider avant tout code.

---

## 1. Arborescence commentée

### `src/`

```
src/
├── App.jsx                  Routeur custom (switch tab), auth login/mdp, chargement initial des données
├── main.jsx                 Bootstrap React
├── styles.css               ~63 Ko de CSS global (un seul fichier — pas de tokens isolés)
├── assets/                  logo.svg
│
├── components/
│   ├── articles/
│   │   └── PublishWithTranslation.jsx   Modal flow publication + traduction (DeepL/Anthropic)
│   ├── editor/
│   │   ├── RichEditor.jsx               TipTap + 3 onglets Visuel / HTML / Aperçu
│   │   ├── EditorToolbar.jsx            Toolbar TipTap (gras, listes, couleurs, image, lien)
│   │   ├── CodeEditor.jsx               Textarea HTML brut
│   │   ├── PreviewPane.jsx              Rendu CSS du site
│   │   └── editor.css
│   ├── layout/
│   │   ├── Layout.jsx                   Container + sidebar + toasts
│   │   └── Sidebar.jsx                  Nav groupée (4 groupes, 18 pages)
│   └── shared/
│       ├── AuthorPicker, DataTable, ExportButton, Modal, MultiSelect,
│       ├── RepoPhoto                    Charge image privée via API GitHub authentifiée
│       ├── SearchBar, ServiceBadge, SkeletonLoader, StatsCard,
│       └── StatusBadge, ToastContainer
│
├── data/
│   ├── articleTemplates.js             Templates HTML de mise en forme
│   └── authors.json                     ⚠ Auteurs DUPLIQUÉS ici alors que le repo site a déjà data/auteurs.json
│
├── hooks/
│   ├── useDebounce, useToast, useUnsavedGuard
│   ├── usePhoto                         Wrapping de githubGetImageDataUrl
│   └── useNotionSync                    Polling Notion 5 min
│
├── pages/                               18 pages, toutes lazy-loaded
│   ├── Dashboard, Accueil, Articles, Calendrier, Contenu, Equipe,
│   ├── Evenements, Medias, Messagerie, Navigation, Newsletter,
│   ├── PagesSite, Presse, Profils, SEO, Settings, Sollicitations, Technique
│
├── services/                            Couche API (front)
│   ├── api.js                           Wrapper fetch vers Worker
│   ├── auth.js                          Login/mdp via Worker (PBKDF2 KV)
│   ├── brevo.js                         Contacts, listes, send, campagnes
│   ├── calendar.js                      Persistance KV des socialPosts/rapports/extEvents
│   ├── contact.js                       Sollicitations (KV)
│   ├── deploy.js                        Hook Vercel (re-déclenche un deploy)
│   ├── export.js                        XLSX read/write + validation email + dédup
│   ├── github.js                        ⚠ Appels GitHub directs avec VITE_GITHUB_TOKEN front
│   ├── notion.js                        Lecture/PATCH base Notion via Worker
│   ├── siteData.js                      CRUD des fichiers data/*.json du repo site
│   ├── telegram.js                      Send + getUpdates
│   └── translate.js                     Wrapper /api/translate
│
└── utils/
    ├── activity.js                      Feed d'activité local
    ├── constants.js                     COLORS, NAV_GROUPS, LS_KEYS, resolvePhotoUrl
    ├── formatters.js                    Dates FR, timeAgo
    └── localStorage.js                  loadLocal/saveLocal/removeLocal (préfixe ir-dash-)
```

### `worker/`

```
worker/
├── index.js                 ~1410 lignes — TOUTES les routes dans un seul fichier
│   /api/auth/*              login, logout, me, users CRUD (PBKDF2 + sessions KV)
│   /api/brevo/*             contacts, listes, send, campagnes
│   /api/telegram/*          send, send-channel, messages
│   /api/calendar/*          GET/PUT KV (socialPosts, rapports, extEvents)
│   /api/contact/*           formulaire public + back-office (sollicitations KV)
│   /api/notion/*            articles, content, status (proxy + parser blocks→HTML)
│   /api/github/*            data/:file, publish, check (proxy GitHub avec token client)
│   /api/translate           DeepL ou Anthropic Claude (Haiku 4.5)
│   /health                  Status des secrets
│   /brevo/send              Legacy
└── wrangler.toml            KV CONTACT_SUBMISSIONS, secrets BREVO, TELEGRAM, etc.
```

### Autres

- `tests/smoke.mjs` : smoke E2E Playwright (18 pages + CRUD calendrier).
- `.github/workflows/` : présent (non lu en détail, sans doute deploy GH Pages).
- `dist/` : build local committé (à supprimer).
- `index.html` + `vite.config.js` : standard Vite.

---

## 2. État réel des features annoncées au README

| Feature                       | État       | Preuve / commentaire |
|-------------------------------|------------|----------------------|
| CRM contacts unifiés          | ⚠ partiel | [src/services/brevo.js:5-28](src/services/brevo.js#L5-L28) liste max 300 contacts. Pas de virtualisation, pas de fusion doublons UI (la dédup CSV existe : [src/services/export.js:70-90](src/services/export.js#L70-L90)). |
| Sync Notion articles          | ✅ marche | [src/hooks/useNotionSync.js](src/hooks/useNotionSync.js) + [worker/index.js:721-847](worker/index.js#L721-L847). À **abandonner** selon brief — l'utilisatrice ne s'en sert pas. |
| Campagnes email Brevo         | ⚠ partiel | `sendBulkEmail` par lots de 50 ([src/services/brevo.js:55-69](src/services/brevo.js#L55-L69)). Pas de preview rendue, pas de test-send dédié, pas de compteur cible live. |
| Campagnes Telegram            | ⚠ partiel | `sendMessage`, `sendChannelMessage`, `testConnection` ([src/services/telegram.js](src/services/telegram.js)). Pas de preview, pas de test send avant blast. |
| Automations                   | ❌ vide   | Un seul toggle dans [src/pages/Settings.jsx:721-723](src/pages/Settings.jsx#L721-L723) (`telegramNewSubscriber`). Aucun consommateur de ce toggle dans le worker — il n'est jamais lu. **À mettre en pause.** |
| Import / Export CSV (xlsx)    | ✅ marche | [src/services/export.js](src/services/export.js) gère parse, validation, doublons, multi-sheet. |
| GitHub commits viewer         | ❌ absent | Aucun composant ne liste les commits. Le README ment. |
| Link checker                  | ❌ absent | `grep -i link` ne ramène rien d'utile. La page Technique édite robots/sitemap, mais ne vérifie pas les liens. |

**Features non documentées qui existent en plus :**
- **Auth** maison login/mdp ([src/services/auth.js](src/services/auth.js) + [worker/index.js:39-189](worker/index.js#L39-L189)) avec PBKDF2 100k, sessions KV 12h, rate-limit 10 tentatives / 15 min, comptes admin/editor.
- **Sollicitations** : formulaire public + back-office complet (statut, tags, notes, replies par email Brevo, archivage soft-delete).
- **Calendrier éditorial** persistant en KV (socialPosts, rapports de fondations, événements extérieurs).
- **Page Technique** : édition de robots.txt, manifest.json, sitemap.xml, rss.xml, search-index.json, vercel.json, Schema.org dans index.html.
- **Translation** : DeepL ou Claude Haiku 4.5 fallback, FR→EN/ES/DE/IT.
- **Page Profils** ([src/pages/Profils.jsx](src/pages/Profils.jsx)) avec barre de recherche, photos chargées via API auth (mémoire récente).

---

## 3. Bugs reproductibles

1. **Token GitHub exposé dans le bundle JS public** — voir §4.1, c'est aussi un bug fonctionnel : tout utilisateur du dashboard peut récupérer un token PAT et écrire dans le repo site sans passer par l'auth dashboard.

2. **`SITE_URL` pointe vers une URL Vercel temporaire** — [src/utils/constants.js:207](src/utils/constants.js#L207) hardcode `https://institut-rousseau-kb9p.vercel.app` alors que le vrai site est `institut-rousseau.fr` (CNAME présent dans le repo site). Tous les liens "Voir sur le site" sont cassés en prod.

3. **`saveAuthorsToGitHub` écrit dans le mauvais repo** — [src/services/github.js:221-264](src/services/github.js#L221-L264) commit `src/data/authors.json` dans `ir-dashboard` (le repo du dashboard), pas dans le repo site. Cela explique les commits récents `Mise à jour authors.json depuis le back-office`. Le repo site a déjà `data/auteurs.json` qui est la source canonique. **Split-brain.**

4. **Notion sync polle même quand l'onglet est en arrière-plan** — [src/hooks/useNotionSync.js:38](src/hooks/useNotionSync.js#L38), `setInterval` à 5 min sans `document.visibilityState`. Consomme du quota Notion pour rien.

5. **TipTap perd la valeur initiale dans certaines races** — [src/components/editor/RichEditor.jsx:50-55](src/components/editor/RichEditor.jsx#L50-L55) : effet `setContent` sur changement externe, mais sans guard sur le timing d'initialisation de l'éditeur ; reproductible en passant rapidement entre articles.

6. **Aucun auto-save** dans l'éditeur d'articles. Si la fenêtre se ferme, le brouillon est perdu (pas de localStorage de sécurité, pas d'IndexedDB, pas de `beforeunload`).

7. **Toolbar TipTap utilise `window.prompt()` pour les liens et images** — [src/components/editor/EditorToolbar.jsx:23-38](src/components/editor/EditorToolbar.jsx#L23-L38). Pas d'alt obligatoire, pas de validation URL, pas de drag&drop, pas de paste image, pas de upload sur le repo. La promesse "insertion image avec upload + alt obligatoire + redim" du brief n'existe pas du tout.

8. **`escape` / `unescape` (globals dépréciés)** dans [src/services/github.js:24,138,247](src/services/github.js#L24) et [worker/index.js:880,906,953](worker/index.js#L880). Marche aujourd'hui, peut casser sur Node 24+ ou navigateurs récents qui les retirent.

9. **`new Function('return (...)')` dans `updatePublicationsI18n` et `updatePublicationsData`** — [src/services/github.js:285,323](src/services/github.js#L285) — eval déguisée. Casse à la moindre quote bizarre dans le contenu du site, et c'est une porte d'entrée à code injection si un fichier du repo site est modifié hors-dashboard.

10. **`hasNotion()` est `true` même quand Notion répond 401** — [src/services/notion.js:101-104](src/services/notion.js#L101-L104) ne checke que la présence locale du token. Le badge "Notion connecté" ment.

11. **`automations.telegramNewSubscriber` jamais consommé** — toggle dans Settings, mais aucune route worker/front ne le lit. Toggle décoratif.

12. **`CONTACT_AUTH_TOKEN` partagé** : si configuré, c'est un Bearer commun à tous les utilisateurs du back-office sollicitations + calendrier ([worker/index.js:386-391](worker/index.js#L386-L391)). Mauvais modèle d'auth (déjà remplacé par `auth:*` mais le code conserve les deux portes en parallèle).

13. **Le smoke test `tests/smoke.mjs` n'est pas exécuté en CI** (workflow non vérifié, mais à valider).

---

## 4. Failles de sécurité

### 4.1 CRITIQUE — Token PAT GitHub exposé côté navigateur
- [src/services/github.js:5](src/services/github.js#L5) lit `import.meta.env.VITE_GITHUB_TOKEN`.
- Vite **inline** toute variable préfixée `VITE_*` dans le bundle JS public.
- Le dashboard est servi sur GitHub Pages (public). **Le token PAT est récupérable par n'importe quel visiteur** via `view-source` ou DevTools → onglet Network → un `bundle.js`.
- Le `.env` local de la machine actuelle contient un token réel `github_pat_11CABKEYQ0E0...` avec les droits sur `institut-rousseau` (privé). Si un build a déjà été déployé avec ce token, **il faut le révoquer immédiatement** sur https://github.com/settings/tokens, indépendamment de la refonte.
- Idem `VITE_NOTION_API_KEY` et `VITE_NOTION_DATABASE_ID`.
- **Action urgente** : révoquer le token PAT visible, vérifier que le bundle déployé sur GH Pages ne le contient pas, sinon le dashboard a été un canal d'exfiltration depuis avril 2026.

### 4.2 Auth front en `localStorage`
- [src/services/auth.js:8,18](src/services/auth.js#L8) stocke le bearer en `localStorage`. Persistant, accessible à tout JS de la page (XSS → vol de session). Le brief demande explicitement `sessionStorage`.

### 4.3 Bootstrap admin avec mdp en clair codé
- [worker/index.js:64-67](worker/index.js#L64-L67) : si la KV est vide, `admin / IR2026!` crée le compte. Si la KV est purgée (par accident, rollback…), n'importe qui peut bootstrapper l'admin tant que personne n'a encore reconnecté. À supprimer après bascule OAuth.

### 4.4 CORS Worker `*`
- [worker/index.js:18-22](worker/index.js#L18-L22) : `Access-Control-Allow-Origin: *`. Tout site malveillant peut faire des requêtes (sauf endpoints qui exigent un Bearer). À restreindre au domaine GitHub Pages prod + `localhost:5173` dev.

### 4.5 TipTap sans sanitize au paste
- [src/components/editor/RichEditor.jsx:27-47](src/components/editor/RichEditor.jsx#L27-L47) : pas de DOMPurify, pas de `transformPastedHTML`. Coller du HTML d'un site externe peut amener `<script>`, `onerror`, etc., qui finiront dans une page publique du site. Vecteur XSS stocké.

### 4.6 Construction HTML par concat de strings
- [src/pages/Articles.jsx:239-247](src/pages/Articles.jsx#L239-L247) construit la carte HTML par template string sans aucun escape. Un titre contenant `</article><script>...` casse la page et exécute du JS sur `publications.html`.

### 4.7 `new Function` côté front
- [src/services/github.js:285,323](src/services/github.js#L285) — voir bug §3.9. Si le repo site est compromis, le dashboard exécute le code attaquant.

### 4.8 Bearer commun `CONTACT_AUTH_TOKEN`
- Voir bug §3.12. À retirer dès qu'OAuth GitHub est en place.

### 4.9 Pas de Content-Security-Policy
- `index.html` ne déclare pas de CSP. Aucun rempart si XSS.

### 4.10 Limites manquantes
- Aucune limite sur la taille des fichiers uploadés (images TipTap base64, qui peuvent peser 10 Mo et faire péter le commit GitHub).
- Aucun `rel="noopener"` strict sur les liens TipTap externes (présent en attribute par défaut, à vérifier au paste).

---

## 5. Le repo du site `institut-rousseau`

**Existe** : `benedictefradin-cmd/institut-rousseau`, **privé**, accessible avec le PAT actuel.

**Déjà en place :**
- `CNAME` → `institut-rousseau.fr` (déployé sur Vercel via Git integration, deploy auto sur push `main`).
- HTML statique pur (vanilla JS), aucun build step. `python3 -m http.server` suffit en local.
- **253 publications** dans `publications/<slug>.html` (pages autonomes complètes).
- **`data/`** déjà structuré :
  - `publications.json` (253 entrées, format `{ id, title, author, date, type, categories, color, description, slug, image, excerpt }`)
  - `events.json`, `presse.json`, `auteurs.json`, `contenu.json`
- `assets/` : `css/`, `js/` (i18n, traduction maison FR/EN/ES/DE/IT), `images/{equipe,auteurs,publications,evenements,le-projet}`, `img/` (publications en 400/800/1200px), `pdf/`.
- `includes/` : `header.html`, `footer.html` (injectés via JS).
- `api/` : 2 fonctions serverless Vercel (`contact.js`, `newsletter.js`).
- Pages thématiques, équipe, publications, presse, événements toutes en `.html` à la racine.
- `search-index.json` : index full-text généré (mention dans Technique : "300+ entrées").

**Constat majeur pour la refonte :**
Le brief propose d'introduire `content/{articles,press,pages,team,events}/` avec frontmatter Markdown.  
**Mais le site actuel ne consomme pas de Markdown** — il sert du HTML statique. Migrer vers Markdown impliquerait soit :
- (A) **Garder le HTML** : le dashboard édite `publications/<slug>.html` + `data/publications.json` directement (modèle actuel, juste à fiabiliser).
- (B) **Introduire un générateur statique** (Eleventy / Astro / Hugo) côté site qui transforme `content/*.md` en `publications/*.html` au build, déployé toujours sur Vercel ou sur GitHub Pages. **C'est une refonte du site, pas seulement du dashboard.**

C'est une décision majeure qui dépasse le périmètre "dashboard" — voir §7 questions bloquantes.

---

## 6. Plan de refonte proposé

> Cadrage avant code. Tout est négociable selon les réponses du §7.

### P0 — sécurité + fondations (1-2 jours)
1. **Révoquer le PAT GitHub exposé** (à faire par l'admin, pas moi) et purger `.env` du disque.
2. **Retirer `VITE_GITHUB_TOKEN` et `VITE_NOTION_API_KEY` du front** : tout passe par le Worker, plus aucun secret dans le bundle.
3. **OAuth GitHub** : OAuth App (l'admin crée le client_id/secret), worker `POST /auth/github/callback`, front stocke en `sessionStorage`, whitelist d'usernames `ALLOWED_GITHUB_USERS` (ou org `institut-rousseau` si elle existe).
4. **Service `gitContent.js`** : remplace `services/github.js` et `services/siteData.js` ; appels GitHub directs (avec le token OAuth de l'utilisateur en mémoire), gestion des conflits 409.
5. **CORS worker** restreint aux origines réelles.
6. **CSP** dans `index.html`.
7. **Conserver l'auth login/mdp existante en parallèle** le temps de la transition (pas de big-bang).

### P1 — refonte éditeur articles + collections (3-5 jours)
8. **Décision contenu (cf. §7 question 5)** :
   - Si **(A) on garde le HTML** : le dashboard pilote `publications/<slug>.html` + `data/publications.json` proprement, avec `<CollectionEditor>` générique pour chaque type.
   - Si **(B) on migre Markdown** : sortir d'abord le générateur statique côté site (hors périmètre dashboard).
9. **Éditeur TipTap nouvelle génération** : DOMPurify, drag&drop image avec upload `assets/img/publications/<slug>/`, alt obligatoire, redim auto 2000px max, auto-save debounced 3s, IndexedDB backup 5 versions, `beforeunload` warning, validation pré-publication.
10. **`<CollectionEditor schema={...}>`** mutualisé pour `events`, `presse`, `auteurs`, `pages`.
11. **Écran "Réglages site"** qui édite `data/contenu.json` (le fichier existe déjà, contient titres/descriptions globales).
12. **Migration Notion → fichiers** : script one-shot `scripts/migrate-notion.mjs` **uniquement si** la base Notion contient des articles non encore présents dans `data/publications.json` (à vérifier).

### P2 — polish + suppression de la dette (selon temps restant)
13. **CRM Brevo** : virtualisation `react-window` si > 500 contacts, fusion doublons UI.
14. **Campagnes Brevo / Telegram** : preview + test send + compteur cible live.
15. **Automations** : commenter le menu (toggle inutilisé). Réactiver plus tard si vraie demande.
16. **Link checker** : ajouter un vrai vérificateur (background job côté worker : crawl + rapport) — utile sur 253 publications.
17. **Healthcheck par service** dans Settings (boutons "Tester la connexion" déjà partiellement en place).
18. **Tokens CSS** dans `src/styles/tokens.css` alignés sur la charte du site live (capture couleurs/typo).
19. **UI partagée** `src/ui/` : Button, Input, Select, Modal, Toast, Badge, Table.
20. **Fixer `SITE_URL`** = `https://institut-rousseau.fr`.
21. **Supprimer `saveAuthorsToGitHub` qui écrit dans le repo dashboard** : tout doit aller dans le repo site.
22. **`automations` UI off** + retirer `CONTACT_AUTH_TOKEN` au profit des sessions OAuth.
23. **Smoke test en CI** (`tests/smoke.mjs`) sur PR.

### Hors périmètre / à débattre
- Migration site Vercel → GitHub Pages : possible plus tard, le dashboard sait déjà parler `VITE_SITE_REPO`.
- Refonte du système de traduction (translation.js du site) : trop gros pour cette mission.

---

## 7. Questions bloquantes — à valider avant de coder

1. **PAT GitHub `github_pat_11CABKEYQ0E0...` (visible dans `.env` local)** : peux-tu le révoquer maintenant sur https://github.com/settings/tokens, et confirmer si un build du dashboard a déjà été déployé en prod avec ce token (sinon je vérifie le bundle live) ?

2. **OAuth App vs GitHub App** : je propose **OAuth App** (plus simple, pas d'install per-user). Tu confirmes ? L'admin (toi) devra créer l'OAuth App et fournir `client_id` + `client_secret` au Worker.

3. **Whitelist accès** : tu préfères une **liste blanche d'usernames GitHub** (variable worker `ALLOWED_GITHUB_USERS=alice,bob,charlie`) ou une **organisation GitHub** `institut-rousseau` à laquelle on rattache les comptes ? Si l'org n'existe pas encore, la liste blanche est plus simple à démarrer.

4. **Format de contenu — décision majeure** :
   - **(A)** Le dashboard édite **les fichiers HTML existants** dans `publications/*.html` + `data/*.json` (pas de Markdown, pas de générateur statique). Le site reste tel quel. **Refonte plus rapide, moindre risque.**
   - **(B)** Le site est refondu pour consommer du Markdown via un générateur statique (Eleventy ou Astro). Le dashboard édite `content/*.md`. **Refonte profonde du site lui-même, plusieurs jours côté site.**
   
   Le brief décrit (B), mais la réalité du repo site (HTML pur, 253 pages déjà publiées) rend (A) **bien plus pragmatique**. **Quelle option ?**

5. **Notion** : l'abandon est acté dans le brief. La base Notion contient-elle des articles **non encore publiés** sur le site ? Si non, le script de migration Notion→fichiers n'a rien à faire — on coupe juste l'intégration. Peux-tu me dire ce qu'il y a dedans ?

6. **Auth login/mdp existante (admin/editor en KV)** : on la **supprime** une fois OAuth GitHub en place, ou on la garde en backup ? Je penche pour la supprimer après une période de transition (1 mois) pour éviter deux mécaniques d'auth en parallèle.

7. **Worker — périmètre cible** : le brief dit "uniquement OAuth callback + proxy Brevo". Mais le worker fait aujourd'hui aussi : sollicitations (KV), calendrier (KV), Telegram, Notion, traduction, GitHub publish. Tu veux qu'on **garde tout** (sollicitations / calendrier / Telegram / traduction sont utiles) et qu'on **retire** seulement Notion et l'auth maison ? Ou tu veux vraiment réduire au minimum ?

8. **`SITE_URL`** : je passe à `https://institut-rousseau.fr` ? Tu confirmes que c'est bien ce domaine en prod (et pas l'URL Vercel preview qui est dans le code aujourd'hui) ?

9. **Automations** : un toggle décoratif jamais consommé. Je le **commente** ?

10. **Calendrier de la migration** : tu as une deadline ? Je bosse sur un dashboard 100% nouveau en parallèle, ou je fais évoluer le code actuel sur place ? **Je recommande l'évolution sur place, lot par lot**, pour ne jamais casser ce qui marche.

---

## 8. Ce que je ne ferai pas tant que tu n'as pas répondu

- Aucun changement de code dans `src/` ou `worker/`.
- Aucune révocation/rotation de token (c'est ton rôle, pas le mien).
- Aucune création de l'OAuth App GitHub (idem).
- Aucune migration Notion (j'attends ta réponse §7.5).
- Aucune décision A/B sur le format de contenu.

Une fois tes réponses validées, je publie un plan détaillé phase par phase, puis je commence par P0 par lots atomiques en Conventional Commits sur `main`.
