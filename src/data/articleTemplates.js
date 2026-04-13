/**
 * Trames d'écriture par type de publication.
 * - `skeleton` : HTML pré-rempli dans l'éditeur (les placeholders sont en <em> grisés)
 * - `guide` : conseils affichés dans la sidebar du formulaire
 * - `estimatedWords` : longueur cible
 */
const ARTICLE_TEMPLATES = {
  "Note d'analyse": {
    estimatedWords: '3 000 – 5 000 mots',
    guide: [
      { section: 'Résumé exécutif', hint: 'Les 3-4 points clés en 5 lignes max. C\'est ce qui sera lu en premier.' },
      { section: 'Contexte', hint: 'Situation actuelle, données factuelles, enjeux. Sourcer les chiffres.' },
      { section: 'Analyse', hint: 'Développement argumenté. Chaque sous-partie = un argument + preuves.' },
      { section: 'Propositions', hint: 'Mesures concrètes, chiffrées si possible. Qui fait quoi, quel calendrier.' },
      { section: 'Conclusion', hint: 'Synthèse en 3 phrases. L\'appel à l\'action.' },
    ],
    skeleton: `<h2>Résumé exécutif</h2>
<p><em style="color: #9CA3AF;">Synthétisez les conclusions principales en 4-5 phrases. Ce paragraphe doit permettre au lecteur pressé de comprendre l'essentiel.</em></p>

<h2>Contexte et enjeux</h2>
<p><em style="color: #9CA3AF;">Présentez la situation actuelle, les données clés et les enjeux. Sourcez les chiffres importants.</em></p>

<h2>Analyse</h2>
<h3>Premier axe d'analyse</h3>
<p><em style="color: #9CA3AF;">Développez votre premier argument avec des preuves factuelles.</em></p>

<h3>Deuxième axe d'analyse</h3>
<p><em style="color: #9CA3AF;">Développez votre deuxième argument.</em></p>

<h2>Propositions</h2>
<p><em style="color: #9CA3AF;">Listez vos propositions concrètes. Pour chaque proposition : la mesure, le mécanisme, le calendrier estimé, le coût éventuel.</em></p>
<ol>
<li><em style="color: #9CA3AF;">Proposition 1 : …</em></li>
<li><em style="color: #9CA3AF;">Proposition 2 : …</em></li>
<li><em style="color: #9CA3AF;">Proposition 3 : …</em></li>
</ol>

<h2>Conclusion</h2>
<p><em style="color: #9CA3AF;">Résumez en 3 phrases l'essentiel de l'analyse et des propositions. Terminez par un appel à l'action clair.</em></p>`,
  },

  "Point de vue": {
    estimatedWords: '1 500 – 2 500 mots',
    guide: [
      { section: 'Accroche', hint: 'Fait d\'actualité ou question provocante qui justifie la prise de parole.' },
      { section: 'Thèse', hint: 'Votre position en une phrase claire.' },
      { section: 'Argumentation', hint: '2-3 arguments développés. Un point de vue, pas un rapport.' },
      { section: 'Ouverture', hint: 'Ce que ça implique pour la suite. Pas de conclusion molle.' },
    ],
    skeleton: `<p><em style="color: #9CA3AF;">Commencez par un fait d'actualité, un chiffre marquant ou une question qui interpelle. Pourquoi ce sujet, pourquoi maintenant ?</em></p>

<h2>Notre position</h2>
<p><em style="color: #9CA3AF;">Énoncez votre thèse en 2-3 phrases directes. Le lecteur doit savoir immédiatement où vous vous situez.</em></p>

<h2>Pourquoi c'est important</h2>
<p><em style="color: #9CA3AF;">Développez 2-3 arguments. Un point de vue est personnel et engagé — assumez une voix forte.</em></p>

<h2>Ce qu'il faut faire</h2>
<p><em style="color: #9CA3AF;">Concluez par ce que ça implique concrètement. Pas de "il faudrait" — des impératifs.</em></p>`,
  },

  "Rapport": {
    estimatedWords: '10 000 – 30 000 mots',
    guide: [
      { section: 'Résumé exécutif', hint: '1-2 pages. Doit se suffire à lui-même.' },
      { section: 'Introduction', hint: 'Objet, méthode, plan du rapport.' },
      { section: 'Parties', hint: 'Structurez en 3-5 parties avec sous-parties. Chaque partie = un chapitre.' },
      { section: 'Recommandations', hint: 'Numérotées, concrètes, avec destinataire identifié.' },
      { section: 'Annexes', hint: 'Données, méthodologie, bibliographie.' },
    ],
    skeleton: `<h2>Résumé exécutif</h2>
<p><em style="color: #9CA3AF;">Synthèse complète du rapport en 1-2 pages. Doit se suffire à lui-même pour un décideur pressé : contexte, principales conclusions, recommandations clés.</em></p>

<h2>Introduction</h2>
<p><em style="color: #9CA3AF;">Objet du rapport, questions traitées, méthodologie employée, plan de lecture.</em></p>

<h2>I. Première partie</h2>
<h3>1.1 Sous-partie</h3>
<p><em style="color: #9CA3AF;">Contenu de la sous-partie…</em></p>

<h2>II. Deuxième partie</h2>
<h3>2.1 Sous-partie</h3>
<p><em style="color: #9CA3AF;">Contenu de la sous-partie…</em></p>

<h2>III. Troisième partie</h2>
<h3>3.1 Sous-partie</h3>
<p><em style="color: #9CA3AF;">Contenu de la sous-partie…</em></p>

<h2>Recommandations</h2>
<ol>
<li><em style="color: #9CA3AF;">Recommandation 1 — destinataire, mesure, calendrier</em></li>
<li><em style="color: #9CA3AF;">Recommandation 2 — …</em></li>
</ol>

<h2>Annexes</h2>
<p><em style="color: #9CA3AF;">Données complémentaires, méthodologie détaillée, bibliographie.</em></p>`,
  },

  "Rapport phare": {
    estimatedWords: '15 000 – 50 000 mots',
    guide: [
      { section: 'Avant-propos', hint: 'Mot du directeur ou du président. Contextualise le rapport.' },
      { section: 'Résumé exécutif', hint: '2-3 pages. Les 10 propositions clés.' },
      { section: 'Chapitres', hint: '5-8 chapitres thématiques avec données et propositions par chapitre.' },
      { section: 'Chiffrage', hint: 'Budget estimé des propositions. Tableau récapitulatif.' },
      { section: 'Feuille de route', hint: 'Calendrier de mise en œuvre. Court/moyen/long terme.' },
    ],
    skeleton: `<h2>Avant-propos</h2>
<p><em style="color: #9CA3AF;">Mot introductif — pourquoi ce rapport, dans quel contexte, quelle ambition.</em></p>

<h2>Résumé exécutif — Les 10 propositions clés</h2>
<ol>
<li><em style="color: #9CA3AF;">Proposition 1 : …</em></li>
<li><em style="color: #9CA3AF;">Proposition 2 : …</em></li>
</ol>

<h2>Chapitre 1 — Titre thématique</h2>
<h3>Diagnostic</h3>
<p><em style="color: #9CA3AF;">État des lieux, données, comparaisons internationales.</em></p>
<h3>Propositions</h3>
<p><em style="color: #9CA3AF;">Mesures concrètes pour ce chapitre.</em></p>

<h2>Chapitre 2 — Titre thématique</h2>
<p><em style="color: #9CA3AF;">Même structure : diagnostic + propositions.</em></p>

<h2>Chiffrage budgétaire</h2>
<p><em style="color: #9CA3AF;">Estimation des coûts par proposition. Tableau récapitulatif.</em></p>

<h2>Feuille de route</h2>
<p><em style="color: #9CA3AF;">Calendrier de mise en œuvre : mesures à 6 mois, 2 ans, 5 ans.</em></p>`,
  },

  "Tribune": {
    estimatedWords: '800 – 1 200 mots',
    guide: [
      { section: 'Attaque', hint: '1 phrase choc. Le lecteur décide en 3 secondes s\'il continue.' },
      { section: 'Constat', hint: '1 paragraphe de contexte factuel. Court.' },
      { section: 'Argumentation', hint: '2-3 paragraphes. Un argument par paragraphe, pas plus.' },
      { section: 'Chute', hint: '1 phrase de conclusion. Mémorable.' },
    ],
    skeleton: `<p><strong><em style="color: #9CA3AF;">Première phrase choc — fait, chiffre ou question qui arrête le lecteur.</em></strong></p>

<p><em style="color: #9CA3AF;">Contexte factuel en 3-4 phrases. Pas de blabla — des faits, des dates, des chiffres.</em></p>

<p><em style="color: #9CA3AF;">Premier argument. Court, direct, sourcé si possible. Une idée par paragraphe.</em></p>

<p><em style="color: #9CA3AF;">Deuxième argument. Montez en puissance.</em></p>

<p><em style="color: #9CA3AF;">Troisième argument — le plus fort. Celui qui reste.</em></p>

<p><strong><em style="color: #9CA3AF;">Phrase de conclusion — ce que vous demandez, ce que vous proposez, ce que vous espérez. Mémorable.</em></strong></p>`,
  },
};

export default ARTICLE_TEMPLATES;
