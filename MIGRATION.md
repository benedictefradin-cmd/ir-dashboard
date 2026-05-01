# MIGRATION — Sécuriser le dashboard et passer en OAuth GitHub

Ce guide est pour **Bénédicte**. Il liste, dans l'ordre, les actions que **toi seule** dois faire (cliquer sur des sites externes, copier-coller des secrets). Le code est de mon côté.

À chaque étape : **fais ce qui est demandé, puis dis-moi "ok étape X faite"**. Je continue là où tu t'es arrêtée.

---

## ⚠️ Étape 1 — RÉVOQUER les deux tokens GitHub exposés (URGENT)

Tes deux fichiers `.env` et `.env.local` (sur ta machine) contiennent chacun un token GitHub. Ces tokens donnent accès en lecture/écriture à tes repos privés. Comme le dashboard est servi sur internet (GitHub Pages), **il y a un risque qu'ils soient lisibles dans le code public**. On va donc les supprimer et les remplacer.

### 1.1 — Aller sur la page de gestion des tokens

Ouvre dans ton navigateur :
👉 **https://github.com/settings/tokens**

Connecte-toi avec ton compte GitHub `benedictefradin-cmd` si on te le demande.

### 1.2 — Révoquer les deux tokens existants

Tu devrais voir une liste de tokens. Pour chacun de ceux dont le nom commence par **"Fine-grained personal access token"** ou par les préfixes :

- `github_pat_11CABKEYQ0E0…`
- `github_pat_11CABKEYQ0Jp…`

clique dessus, puis clique sur le bouton rouge **"Delete"** (ou "Revoke").

✅ Une fois fait : ces tokens ne marchent plus. Le dashboard ne pourra plus écrire sur le repo du site **temporairement** — c'est normal, on va remettre ça en place proprement aux étapes suivantes.

---

## Étape 2 — Créer un nouveau token GitHub pour le Worker (transition)

On va recréer **un seul** token, qu'on stockera **côté serveur** (Cloudflare Worker), pas dans le code public. Personne d'autre ne pourra le voir.

### 2.1 — Sur la même page https://github.com/settings/tokens

Clique sur **"Generate new token"** → choisis **"Fine-grained tokens"**.

Remplis :
- **Token name** : `ir-dashboard-worker`
- **Expiration** : 1 an (ou "No expiration" si tu préfères)
- **Repository access** : "Only select repositories" → choisir **`institut-rousseau`** (le repo du site)
- **Permissions** :
  - **Contents** : `Read and write`
  - **Metadata** : `Read-only` (s'ajoute automatiquement)

Clique en bas sur **"Generate token"**.

GitHub te montre le token **une seule fois**. Copie-le tout de suite (il commence par `github_pat_…`).

### 2.2 — Le donner au Worker Cloudflare

Ouvre un terminal dans le dossier `worker/` du dashboard, puis tape :

```bash
cd worker
wrangler secret put GITHUB_PAT
```

Quand wrangler demande la valeur, **colle le token** que tu viens de générer puis appuie sur Entrée.

✅ Le token est maintenant stocké chiffré chez Cloudflare. Personne ne peut le lire (même pas toi). Le Worker l'utilisera automatiquement à chaque requête vers GitHub.

### 2.3 — Nettoyer tes fichiers locaux

Ouvre `.env` et `.env.local` à la racine du dashboard et **supprime les lignes** `VITE_GITHUB_TOKEN=…` et `VITE_NOTION_API_KEY=…`. Garde uniquement `VITE_WORKER_URL=…`.

---

## Étape 3 — Créer une OAuth App GitHub (objectif : tu te connectes avec GitHub au dashboard)

À terme, chaque personne qui utilise le dashboard se connectera avec **son propre compte GitHub**, et ses commits seront attribués à son nom. Pour ça il faut une "OAuth App" (une application autorisée par GitHub à demander une connexion).

### 3.1 — Aller sur la page des OAuth Apps

👉 **https://github.com/settings/developers**

Onglet **"OAuth Apps"** → bouton **"New OAuth App"**.

### 3.2 — Remplir le formulaire

- **Application name** : `Institut Rousseau Dashboard`
- **Homepage URL** : l'URL du dashboard en prod (à confirmer ensemble — probablement `https://benedictefradin-cmd.github.io/ir-dashboard/`)
- **Application description** : `Back-office éditorial Institut Rousseau`
- **Authorization callback URL** : `https://ir-dashboard-api.institut-rousseau.workers.dev/api/auth/github/callback`

Clique **"Register application"**.

### 3.3 — Récupérer Client ID + Client Secret

Sur la page suivante :
- Note le **Client ID** (visible en haut)
- Clique **"Generate a new client secret"** → GitHub te montre un secret commençant par `github_oauth_secret_…`. Copie-le tout de suite.

### 3.4 — Donner les deux au Worker

Dans le terminal :

```bash
cd worker
wrangler secret put GITHUB_OAUTH_CLIENT_ID
# colle le Client ID, Entrée
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
# colle le secret, Entrée
```

### 3.5 — Définir qui a le droit de se connecter

```bash
wrangler secret put ALLOWED_GITHUB_USERS
# colle la liste des comptes GitHub autorisés, séparés par des virgules
# exemple : benedictefradin-cmd,michel-hakim,guillaume-x
```

✅ Seuls ces comptes pourront se connecter au dashboard via GitHub.

---

## Étape 4 — Re-déployer le Worker

```bash
cd worker
wrangler deploy
```

Le Worker prend en compte les nouveaux secrets immédiatement.

---

## Récapitulatif — Checklist à cocher

- [ ] Étape 1.1-1.2 : les deux anciens tokens GitHub sont révoqués sur https://github.com/settings/tokens
- [ ] Étape 2.1-2.2 : nouveau token créé, stocké via `wrangler secret put GITHUB_PAT`
- [ ] Étape 2.3 : `.env` et `.env.local` nettoyés (plus de `VITE_GITHUB_TOKEN` ni `VITE_NOTION_API_KEY`)
- [ ] Étape 3.1-3.4 : OAuth App créée, `GITHUB_OAUTH_CLIENT_ID` et `GITHUB_OAUTH_CLIENT_SECRET` configurés sur le Worker
- [ ] Étape 3.5 : `ALLOWED_GITHUB_USERS` configuré avec la liste des comptes autorisés
- [ ] Étape 4 : `wrangler deploy` exécuté

Une fois la checklist complète, le dashboard est **sécurisé** et **prêt pour OAuth**. Je peux alors brancher l'écran "Se connecter avec GitHub" côté front.

---

## En cas de doute

Si quelque chose te bloque, recopie-moi simplement le message d'erreur et je te dis quoi faire. Pas besoin de comprendre les commandes.
