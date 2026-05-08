# Institut Rousseau — Back-office (ir-dashboard)

## Projet

Back-office d'édition pour le site `institut-rousseau.fr`. Permet à l'équipe de
publier/modifier les articles, événements, presse, profils, etc. **sans toucher
au code du site**.

Ce repo est **distinct** du repo du site (`institut-rousseau`). Le dashboard
édite le repo du site via l'API GitHub, en passant par un proxy Worker
Cloudflare qui détient le token côté serveur.

## Stack technique

- **Front** : React 18 + Vite (SPA, pas de routeur — onglets gérés par état)
- **Éditeur de texte** : TipTap (`@tiptap/*`)
- **Backend** : Cloudflare Worker (`worker/index.js`, ~1900 lignes, monolithique)
- **Stockage** :
  - Données de contenu (articles, events, profils) → **GitHub** (repo `institut-rousseau`)
  - Comptes utilisateurs + sessions + sollicitations contact → **Cloudflare KV**
    (namespace `CONTACT_SUBMISSIONS`, id `539bcd0d0e2c43eda11a6994a3375880`)
- **Tests** : Vitest (unit) + Playwright + axe-core (a11y)

## Architecture (data flow)

```
Navigateur (React)
    │  fetch Bearer token
    ▼
Cloudflare Worker (ir-dashboard-api.workers.dev)
    │  proxy authentifié
    ├──► GitHub API           (lecture/écriture repo institut-rousseau)
    ├──► Notion API           (import depuis bases Notion)
    ├──► Brevo                (newsletter, mails transactionnels)
    ├──► DeepL / Anthropic    (traduction d'articles)
    └──► Cloudflare KV        (auth, sollicitations, calendrier)
```

Le navigateur ne parle **jamais directement** à GitHub : il appelle le Worker,
qui détient le `GITHUB_PAT` côté serveur.

## Pages du dashboard (`src/pages/`)

| Page              | Édite                                                |
|-------------------|------------------------------------------------------|
| `Articles.jsx`    | `publications/*.html` + `assets/js/publications-data.js` + `publications-i18n.js` |
| `Evenements.jsx`  | `data/events.json`                                   |
| `Presse.jsx`      | `data/presse.json`                                   |
| `Profils.jsx`     | `data/auteurs.json`                                  |
| `Equipe.jsx`      | équipe permanente, CA, conseil scientifique          |
| `Medias.jsx`      | uploads dans `assets/img/...`                        |
| `Newsletter.jsx`  | abonnés Brevo                                        |
| `Sollicitations.jsx` / `Messagerie.jsx` | KV `contact:*` + envois Brevo |
| `EditeurVisuel.jsx` | édition libre d'une page HTML du site              |
| `Settings.jsx`    | paramètres + onglet Utilisateurs (admin only)        |
| `Calendrier.jsx`  | KV partagée                                          |
| `Technique.jsx`   | sondes/diagnostics                                   |

## Authentification

Deux mécanismes coexistent (la bascule OAuth n'est pas terminée) :

1. **Login + mot de passe** (utilisé en pratique)
   - PBKDF2 100k itérations + sel SHA-256
   - Sessions en KV, TTL 12 h, token Bearer en `localStorage`
   - Rate limit : 10 tentatives / 15 min / IP
   - Bootstrap : `admin` / `IR2026!` à la première connexion (à changer immédiatement)
   - Gestion des comptes : Paramètres → Utilisateurs (admin requis)
   - Rôles : `admin`, `editor`

2. **OAuth GitHub** (en cours, whitelist `ALLOWED_GITHUB_USERS`)

## Endpoints Worker (`worker/index.js`)

```
/api/auth/login                  POST   login + mdp → token
/api/auth/logout                 POST
/api/auth/me                     GET
/api/auth/me/password            PATCH  changer son mdp
/api/auth/users                  GET/POST       (admin)
/api/auth/users/:id              PATCH/DELETE   (admin)
/api/auth/github/start           GET    OAuth GitHub
/api/auth/github/callback        GET

/api/github/contents/*           GET/PUT/DELETE  fichiers du repo site
/api/github/list/*               GET            lister un dossier
/api/github/publish              POST           écrit publications/{slug}.html
/api/github/check/:slug          GET            existe ?

/api/notion/*                    proxy Notion
/api/contact                     POST           formulaire de contact
/api/newsletter                  POST           abonnement Brevo
/health, /api/health             GET
```

**Whitelist d'écriture** : voir `worker/index.js` (fonction `isAllowedPath`).
Limite ce qui est éditable côté repo site (pas de `.github/`, pas de tokens).

## Workflow de publication d'un article

1. Rédacteur écrit l'article dans le dashboard (TipTap → HTML)
2. Clic "Publier" → `POST /api/github/publish` → écrit `publications/{slug}.html`
3. Front appelle aussi `PUT /api/github/contents/assets/js/publications-data.js`
   pour ajouter l'entrée dans la liste publique du site
4. Vercel détecte le commit sur `main` et redéploie le site (~1 min)
5. L'article est en ligne sur `institut-rousseau.fr/publications/{slug}.html`

**Conséquence** : 1 publication = 1-3 commits + 1 rebuild Vercel. C'est le
prix d'un Git-based CMS — site statique gratuit, mais latence d'~1 min.

## Secrets requis (Worker)

À configurer avec `wrangler secret put <NAME>` :

```
GITHUB_PAT                       # Fine-grained PAT, Contents: Read+Write sur le repo site
GITHUB_OWNER                     # ex: benedictefradin-cmd
GITHUB_SITE_REPO                 # ex: institut-rousseau
GITHUB_OAUTH_CLIENT_ID           # OAuth App GitHub (login dashboard)
GITHUB_OAUTH_CLIENT_SECRET
ALLOWED_GITHUB_USERS             # whitelist OAuth, séparés par virgules
BREVO_API_KEY                    # newsletter + mails
TELEGRAM_BOT_TOKEN               # notifications optionnelles
TELEGRAM_CHAT_ID
TELEGRAM_CHANNEL_ID
DEEPL_API_KEY                    # traduction (optionnel)
ANTHROPIC_API_KEY                # traduction LLM (optionnel)
CONTACT_AUTH_TOKEN               # déprécié, à retirer
```

## Variables d'environnement front (`.env.local`)

```
VITE_WORKER_URL=https://ir-dashboard-api.institut-rousseau.workers.dev
VITE_NOTION_DATABASE_ID=...
VITE_GITHUB_OWNER=benedictefradin-cmd
VITE_GITHUB_SITE_REPO=institut-rousseau
```

## Lancer en local

```bash
# Front (Vite, port 5173 par défaut)
npm install
npm run dev

# Worker (wrangler, port 8787)
cd worker
wrangler dev

# Tests
npm test            # vitest run
npm run test:watch  # vitest mode interactif
```

Pour tester l'auth localement : voir `worker/test-auth.sh`.

## Conventions / pièges connus

- **Pas de routeur** : les pages sont un état React (`activePage`) géré dans `App.jsx`. Pas d'URL spécifique par page.
- **Token GitHub jamais côté navigateur** : tout passe par le Worker.
- **Le repo `institut-rousseau` est la base de données.** Pas de DB SQL/NoSQL pour les contenus.
- **`publications-data.js` est un fichier JS, pas JSON** : `window.PUBLICATIONS_DATA = [...]`. Voir `parsePublicationsData()` / `updatePublicationsData()` dans `src/services/github.js`.
- **`data/auteurs.json`** : les articles référencent les auteurs par ID (`authorIds: []`) depuis le Chantier B (mai 2026). La string `author` reste en miroir pour rétrocompat.
- **Whitelist Worker** : si un endpoint front renvoie 403, vérifier `isAllowedPath` dans `worker/index.js`.
- **Cache busting** : `<script src="...?v=3">` côté site. Bumper `v=N` après changement structurant de `publications-data.js`.

## Déploiement

- Front : déployé sur Vercel (projet séparé du site).
- Worker : déployé sur Cloudflare via `wrangler deploy` (depuis `worker/`).

## Maintenance

Repo maintenu par une personne seule. Documentation historique dans
`AUDIT.md`, `AUDIT-2026-05-01.md`, `MIGRATION.md`, `AUTHORS_MIGRATION.md`.
