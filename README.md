# Dashboard Institut Rousseau

Dashboard de gestion du site [institut-rousseau-kb9p.vercel.app](https://institut-rousseau-kb9p.vercel.app), hébergé sur GitHub Pages.

## Architecture

```
Frontend (React/Vite)          Backend (Cloudflare Worker)
   GitHub Pages         ←→     Proxy API gratuit
       ↓                           ↓
   - CRM contacts              - Brevo SMTP
   - Articles Notion            - Notion API
   - Commits GitHub             - Notion API
   - Link checker               (100K req/jour gratuit)
   - Campagnes email/TG
```

**Appels directs (pas de proxy)** : GitHub API, Telegram Bot API, Link checker

## Déploiement — étape par étape

### 1. Cloudflare Worker (backend API)

Le Worker est nécessaire pour Brevo et Notion (CORS bloqué depuis le navigateur).

```bash
# Installer Wrangler
npm install -g wrangler

# Se connecter (créer un compte Cloudflare gratuit si besoin)
wrangler login

# Déployer le worker
cd worker
wrangler deploy
```

→ Copier l'URL du worker (ex: `https://ir-dashboard-api.xxx.workers.dev`)

### 2. GitHub Pages (frontend)

```bash
# Créer le repo sur GitHub
gh repo create ir-dashboard --public --source=. --push

# OU manuellement :
git init
git add .
git commit -m "Initial dashboard"
git remote add origin https://github.com/TON-ORG/ir-dashboard.git
git push -u origin main
```

**Configurer GitHub Pages :**
1. Repo → Settings → Pages → Source : **GitHub Actions**
2. Repo → Settings → Secrets → Actions → Ajouter :
   - `WORKER_URL` = l'URL du Cloudflare Worker

**Mettre à jour `vite.config.js` :**
```js
base: '/ir-dashboard/',  // ← remplacer par le nom exact du repo
```

Le site sera disponible à `https://TON-ORG.github.io/ir-dashboard/`

### 3. Configuration dans le dashboard

Tout se configure dans l'onglet **Config** du dashboard :

| Service | Où trouver les identifiants |
|---------|---------------------------|
| Brevo | [Paramètres → Clés API](https://app.brevo.com/settings/keys/api) |
| Telegram | Créer un bot via [@BotFather](https://t.me/BotFather) |
| Notion | [My integrations](https://www.notion.so/my-integrations) |
| GitHub | [Personal access tokens](https://github.com/settings/tokens) (optionnel, repos publics) |

Les clés sont stockées dans `localStorage` du navigateur — elles ne transitent jamais par GitHub.

## Structure Notion attendue

Créer une base de données Notion avec ces colonnes :

| Colonne | Type | Valeurs |
|---------|------|---------|
| Titre | Title | — |
| Auteur | Text ou People | — |
| Statut | Select ou Status | Brouillon, Prêt, Publié |
| Date | Date | — |
| Pôle | Select | Écologie, Économie, Institutions, Social, International, Culture |

→ Partager la base avec l'intégration Notion créée

## Développement local

```bash
npm install
npm run dev
```

Créer `.env.local` :
```
VITE_WORKER_URL=https://ir-dashboard-api.xxx.workers.dev
```

## Sécurité

- Les clés API sont dans `localStorage`, jamais committées
- Le Cloudflare Worker devrait restreindre CORS à ton domaine GitHub Pages en production (modifier `CORS_HEADERS` dans `worker/index.js`)
- Le token GitHub est optionnel (l'API publique suffit pour les repos publics)

## Fonctionnalités

- **CRM** : contacts unifiés avec tags (Membre, Donateur, Newsletter, Presse, Auteur, Événement)
- **Notion** : sync des articles depuis la base de données
- **Campagnes** : envoi email (Brevo) et Telegram par segment
- **Automations** : workflows déclenchés par événements (bienvenue, relance, alertes)
- **Import/Export CSV** : compatible Excel
- **GitHub** : derniers commits du repo
- **Link checker** : vérification de toutes les pages du site
