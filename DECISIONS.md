# DECISIONS — choix tranchés sans validation explicite (Chantiers 0-9)

> Bénédicte a demandé « fais au mieux » + « fais tous les chantiers un après
> l'autre ». Ce fichier liste les arbitrages que j'ai pris seul, à toi de me
> dire si tu veux qu'on en revienne sur certains.

| # | Décision | Alternative écartée | Pourquoi ce choix |
|---|---|---|---|
| Q1 | Auto-trad FR → **EN + ES** | FR + 4 langues | Sur reformulation explicite (« FR + EN + ES seulement ») |
| Q2 | Schéma profil **réduit** au strict brief, backup JSON séparé | Conserver `_legacy.*` dans le JSON publié | Anti-pattern, polluerait le repo public 1 mois pour rien |
| Q3 | Boîte `contact@` : **pas de BCC** pour l'instant | BCC contact@ direct | Risque de boucle si Brevo SMTP — à valider avec toi avant activation |
| Q4 | **Pas de staging** mis en place | Branche `staging` + preview Vercel | YAGNI tant qu'on n'a pas un cycle multi-collaborateurs |
| Q5 | Doublons profils : **fusion 12407 → nicolas-desquinado** automatique (script dry-run/apply) | Validation paire-par-paire | Une seule paire détectée, no-op sur les références (0 publi signée) |
| Q6 | Profils archivés : **`actif: false` permanent**, jamais delete | Delete au bout de 30j | Traçabilité, le site les filtre via `actif !== false` |
| Q7 | `Accueil.jsx` vs `Dashboard.jsx` : **conservés tous les deux** | Suppression Accueil | Pas vérifié si lien externe pointe vers `'accueil'`. À trancher avant Chantier 9 |
| Q8 | `EditeurVisuel.jsx` : **conservé** | Suppression au Chantier 8 | Pas vérifié son usage réel par toi. À trancher avant Chantier 9 |
| Q9 | Permissions : **statu quo admin/editor** | Simplifier à 1 rôle | Suffit pour l'instant |
| Q10 | Magic link / 2FA : **non implémenté** | Magic link, TOTP | Pas demandé explicitement, OAuth GitHub + login PBKDF2 suffit |
| Q11 | Roles profil : **tableau** `roles[]` | Scalaire `role` | Multi-appartenance (ex: CA + Conseil scientifique) |
| Q12 | HelloAsso : **beacon non bloquant** (sendBeacon) | Redirect Worker (302) | Single point of failure pour les revenus si Worker down |
| Q13 | Routing messages : **KV Worker** (`config:messageRouting`) | `data/contenu.json` du repo site | Donnée admin, pas du contenu public, pas de rebuild Vercel par édition |
| Q14 | Suppression du miroir `author: string` des publications : **reportée** | Suppression immédiate Chantier 8 | Trop de lecteurs site (`article-author.js`, schema.org, fallback). À faire après recette |
| Q15 | Miroir `name`/`titre` dans events : **conservé** | Suppression immédiate | Idem rétrocompat assets/js/events.js |

## Configurations qu'il te reste à faire en prod (cf. CLAUDE.md)

```bash
cd worker

# Chantier 0 — RGPD
openssl rand -hex 32 | wrangler secret put NEWSLETTER_UNSUBSCRIBE_SECRET

# (recommandé) ID liste Brevo "newsletter" — colonne ID dans Brevo
echo "12" | wrangler secret put BREVO_NEWSLETTER_LIST_ID

# Déploiement
wrangler deploy
```

Sans `NEWSLETTER_UNSUBSCRIBE_SECRET`, l'envoi newsletter retourne 503 (volontaire,
RGPD-safe).
