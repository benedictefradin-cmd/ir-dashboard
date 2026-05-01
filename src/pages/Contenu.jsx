/**
 * Contenu.jsx — Redirige vers l'Éditeur visuel.
 *
 * Avant : 18 formulaires markdown éditant `contenu.json`. Sur les 18, seuls
 * `accueil`, `equipe`, `navigation`, `seo` étaient effectivement consommés
 * par le site (cf. `assets/js/contenu.js`). Les 14 autres (`projet`,
 * `adhesion`, `don`, `propositions`…) étaient sauvegardés mais jamais
 * relus — le contenu réellement affiché venait de `assets/js/translation.js`.
 *
 * Maintenant : tout texte avec `data-i18n` se modifie depuis l'Éditeur
 * visuel, qui édite `data/i18n.json`. Cette page sert juste de pointeur
 * pour les anciens chemins / bookmarks.
 */

export default function Contenu({ embedded, onTabChange }) {
  const goToEditor = () => onTabChange?.('editeur');

  const content = (
    <div className="card" style={{ padding: 24, maxWidth: 640 }}>
      <h3 style={{ marginBottom: 8 }}>Édition du contenu déplacée</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-light)' }}>
        Les textes des pages (Le Projet, Adhésion, Propositions, RGPD, etc.)
        s'éditent désormais depuis l'<strong>Éditeur visuel</strong>. Vous y
        cliquez directement sur un texte du site pour le modifier, sans
        passer par un formulaire.
      </p>
      <button className="btn btn-primary mt-16" onClick={goToEditor}>
        Ouvrir l'Éditeur visuel →
      </button>
    </div>
  );

  if (embedded) return content;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Contenu éditorial</h1>
          <p className="page-header-sub">Déplacé vers l'Éditeur visuel</p>
        </div>
      </div>
      <div className="page-body">{content}</div>
    </>
  );
}
