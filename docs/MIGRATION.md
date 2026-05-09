# MIGRATION — Sécuriser le dashboard et passer en OAuth GitHub

État du chantier au 2026-05-01.

| Phase | Status | Qui |
|-------|--------|-----|
| 1 — Révoquer les anciens tokens GitHub | ✅ FAIT | Bénédicte |
| 2 — Mettre le PAT en secret Worker | ✅ FAIT | Bénédicte + automatisé |
| 3 — Créer l'OAuth App GitHub + secrets Worker | ⏳ À FAIRE | Bénédicte (15 min) |
| Code dashboard | ✅ FAIT | Claude |

**Tout le code est en place.** Il ne reste qu'une action manuelle de ta part — créer l'OAuth App sur github.com — pour que le bouton « Se connecter avec GitHub » devienne fonctionnel.

---

## ⏳ Phase 3 — Créer l'OAuth App (15 min, à faire maintenant)

### 3.1 — Aller sur la page OAuth Apps

👉 https://github.com/settings/developers

Onglet **"OAuth Apps"** (en haut) → bouton **"New OAuth App"**.

### 3.2 — Remplir EXACTEMENT comme ça

| Champ | Valeur à coller |
|-------|-----------------|
| Application name | `Institut Rousseau Dashboard` |
| Homepage URL | `https://benedictefradin-cmd.github.io/ir-dashboard/` |
| Application description | `Back-office éditorial Institut Rousseau` |
| **Authorization callback URL** ⚠️ | `https://ir-dashboard-api.institut-rousseau.workers.dev/api/auth/github/callback` |

Ne coche pas "Enable Device Flow". Clique **"Register application"**.

### 3.3 — Récupérer Client ID + Secret

Sur la page suivante :

1. Note le **Client ID** (visible en haut, du genre `Iv1.abc123def456` ou `Ov23ab...`)
2. Clique **"Generate a new client secret"** → GitHub te montre un secret. **Copie-le immédiatement** (Cmd+C).

### 3.4 — Configurer les 3 secrets côté Worker (terminal)

```bash
cd /Users/mb/Documents/GitHub/ir-dashboard/worker

wrangler secret put GITHUB_OAUTH_CLIENT_ID
# colle le Client ID → Entrée

wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
# colle le secret → Entrée

wrangler secret put ALLOWED_GITHUB_USERS
# tape : benedictefradin-cmd
# (ou ajoute d'autres comptes séparés par virgules :
#  benedictefradin-cmd,michelhakim123)
# → Entrée

wrangler deploy
```

### 3.5 — Tester

Recharge la page du dashboard sur https://benedictefradin-cmd.github.io/ir-dashboard/. Le bouton **« Se connecter avec GitHub »** devrait maintenant marcher. Clique-le → tu seras redirigée vers GitHub pour autoriser l'app, puis renvoyée vers le dashboard, connectée avec ton compte. Tes commits seront attribués à ton compte GitHub.

---

## Récapitulatif sécurité

| Avant cette migration | Maintenant |
|-----------------------|-----------|
| 2 tokens GitHub visibles dans le code public | ✅ Tokens révoqués |
| PAT inliné dans le bundle JS de GitHub Pages | ✅ Bundle vide de tout secret (`grep github_pat_ dist/` → rien) |
| N'importe qui pouvait extraire ton token et écrire dans le repo site | ✅ Token uniquement chez Cloudflare, jamais exposé |
| Auth login/mdp partagé en localStorage (XSS-able) | ✅ OAuth GitHub en sessionStorage (vidé à la fermeture du tab) |
| Notion sync polling 5 min → fuite quota | ✅ Notion désactivé (Q5 : rien à migrer) |
| Pas de sanitize sur le contenu collé dans TipTap | ✅ DOMPurify au paste, whitelist stricte de tags |
| `new Function()` (eval) sur les fichiers du repo site | ✅ JSON5 |
| `SITE_URL` pointait vers un préview Vercel cassé | ✅ `https://institut-rousseau.fr` |

---

## En cas de souci

Recopie-moi simplement le message d'erreur exact ; je te dis quoi faire. Pas besoin de comprendre les commandes.
