# CHANGELOG — ir-dashboard

> Date courante : 2026-05-08
> Périmètre : Chantiers 0 à 9 du brief « refonte profil-centrée » (cf. [docs/AUDIT.md](docs/AUDIT.md))

## Chantier 0 — RGPD newsletter (P0 légal) [2026-05-08]

- Worker : `POST /api/brevo/email/send` accepte `body.newsletter === true` qui
  déclenche un envoi 1-par-1 avec footer désinscription personnalisé HMAC.
  Refuse l'envoi (503) si `NEWSLETTER_UNSUBSCRIBE_SECRET` absent.
- Worker : `GET /api/newsletter/unsubscribe?token=…` valide HMAC, désinscrit
  côté Brevo, renvoie page HTML FR. Idempotent.
- Front : `sendBulkEmail` passe `newsletter: true` par défaut.
- Headers `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` (Gmail/Outlook).
- Doc CLAUDE.md : 2 nouveaux secrets (NEWSLETTER_UNSUBSCRIBE_SECRET,
  BREVO_NEWSLETTER_LIST_ID).

## Chantier 1 — Profils refondus [2026-05-08]

- Schéma `data/auteurs.json` resserré : `description`, `roles[]`, `roleLibelle`,
  `email`, `emailPublic` (opt-in RGPD), `linkedin`, `actif`. Champs supprimés :
  `bio`, `bioCourte`, `bioLongue`, `role`, `reseaux.{x,site,linkedin,email}`,
  `dateArrivee`. Backup : `backups/auteurs-pre-2026-05-08.json`.
- `roles[]` est un tableau (multi-appartenance, ex: CA + Conseil scientifique).
- Lecteurs site adaptés (rétrocompat) : `assets/js/auteurs.js`,
  `assets/js/article-author.js` lisent `roleLibelle || role || ...` et
  `description || bioCourte || ...`.
- Fusion `12407 → nicolas-desquinado` via `scripts/merge-profiles.mjs --dry-run --apply`.
  Tombstone `actif:false`, `mergedInto`, `mergedAt`. Voir `MERGES.md`.
- Profils.jsx : nouveau formulaire (Identité / Description / Rattachements /
  Contact / Statut), filtre par rattachement, archive auto-masquée.

## Chantier 2 — Presse migrée vers IDs [2026-05-08]

- Schéma `data/presse.json` : `auteur:string` → `authorIds[]` + `auteurExterne`.
- 65 entrées migrées (56 internes, 16 externes — Cyril Dion, tribunes signées…).
- `Presse.jsx` : `AuthorPicker` + champ texte fallback. Validation ≥1 source.
- Miroir `auteur:string` reconstruit auto à chaque save (rétrocompat).

## Chantier 3 — Événements migrés vers IDs [2026-05-08]

- Schéma `data/events.json` : `intervenants[].{name,titre}` →
  `intervenants[].{profileId|nameExterne, titreEvent}`.
- 9 events traités (3 internes, 6 externes).
- `Evenements.jsx` : select profil OU input externe (mutuellement exclusifs)
  + champ titreEvent.
- Miroir `name`/`titre` conservé (rétrocompat assets/js/events.js).

## Chantier 4 — Routing CC par type de sollicitation [2026-05-08]

- KV Worker `config:messageRouting` (admin only).
- Worker : `GET/PUT /api/messages/routing`. `POST /api/contact/:id/reply`
  accepte `cc[]` et `bcc[]`.
- `MessageRoutingEditor.jsx` : panneau collapsible en haut de Sollicitations.
  Chips toggle profils CC par type d'objet. Affiche uniquement les profils
  ayant un email saisi.
- `Sollicitations.jsx` : pré-remplit le champ CC du modal reply depuis le
  routing au moment de la sélection. Bénédicte peut éditer manuellement.

## Chantier 5 — Tracking HelloAsso non bloquant [2026-05-08]

- `assets/js/helloasso-tracking.js` : intercepte les clics sur
  `<a data-track-helloasso="adhesion|don" data-track-source="…">`, beacon
  async vers le Worker. Le clic vers helloasso.com part toujours.
- 5 boutons annotés (don.html × 2, adhesion.html × 3).
- Worker : `POST /api/track/click` (public) + `GET /api/helloasso/stats?period=…`
  (admin). KV `helloasso:click:{type}:{source}:{YYYY-MM-DD}`, TTL 400j.
- Dashboard : `HelloAssoStatsCard` sur la page d'accueil (clics 30 derniers
  jours, total adhésion + don).

## Chantier 6 — Auto-traduction FR → EN + ES [2026-05-08]

- Constante `AUTO_TRANSLATE_TARGETS = ['en', 'es']`. DE/IT restent saisis à
  la main (qualité variable, mieux vaut révision humaine).
- `Articles.jsx` : bouton "✨ Auto-traduire EN + ES" dans la barre d'onglets
  de langue. Ne touche pas aux langues déjà remplies. Bouton "Re-traduire
  (force)" pour écraser.
- Marquage `translations[code].autoTranslated: true` + `translatedAt`.
  Bandeau orange en édition d'une langue auto-traduite : « relisez
  attentivement ».
- Endpoint Worker `/api/translate` inchangé (DeepL ou Anthropic Claude Haiku).

## Chantier 7 — UX globale (filtres) [2026-05-08]

- `Articles.jsx` : filtres auteur (par profil) et traduction (sans/avec
  chaque langue cible). Identifie immédiatement les trous éditoriaux.

## Chantier 8 — Nettoyage / dette [2026-05-08]

- CHANGELOG.md créé (ce fichier).
- `docs/DECISIONS.md` : trace des arbitrages tranchés sans validation explicite.
- Pages `Equipe.jsx`, `Accueil.jsx`, `EditeurVisuel.jsx` **conservées en l'état** :
  - Equipe.jsx édite `data/contenu.json` (sections du site `equipe.html`),
    pas un doublon de Profils.jsx. Suppression nécessite refonte du site
    (assets/js/contenu.js). Reportée à un chantier dédié.
  - Accueil.jsx vs Dashboard.jsx : Dashboard est l'écran réel utilisé,
    Accueil semble vestigial. Décision déférée le temps de confirmer
    qu'aucun lien externe pointe sur 'accueil'.
  - EditeurVisuel.jsx : usage réel à confirmer avec Bénédicte avant retrait.
- Suppression du miroir `author:string` des publications : reportée. Trop
  de lecteurs site (`article-author.js`, schema.org). À traiter en bloc
  après Chantier 9.

## Chantier 9 — Recette + smoke [2026-05-08]

- Script `scripts/check-references.mjs` côté repo site. Vérifie en < 1s :
  - 262 publications scannées → 0 authorId cassé
  - 65 entrées presse → 0 authorId cassé
  - 9 events → 0 profileId cassé
  - 1 tombstone détecté (12407 → nicolas-desquinado), 0 ref pointe vers lui
  - 169 profils actifs jamais référencés (info — vestiges WP)
- Première recette : ✅ tout vert
- Smoke Playwright (`tests/smoke.mjs`) : non étendu (les nouvelles features
  nécessitent un Worker déployé + secrets Brevo, hors portée d'un E2E local).
  À déclencher manuellement par `npm test` après `wrangler deploy` côté prod.

---

## Format

`feat(scope): description` Conventional Commits sur `main`. Pas de PR
intermédiaire (utilisatrice solo). Backups dans `backups/<entité>-pre-<date>.json`
côté repo site.
