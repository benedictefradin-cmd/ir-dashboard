// Construit le HTML complet d'une page article (publications/{slug}.html)
// publié sur institut-rousseau.fr. Pendant exact du gabarit du site —
// ne pas diverger des classes/structure attendues par les CSS et scripts
// (article-author.js, related.js, article-i18n.js).

import { categoryColor } from '../services/github';

// Convertit une date stockée (YYYY-MM ou YYYY-MM-DD) au format ISO attendu
// par schema.org (YYYY-MM-DD). Retombe sur la date du jour si vide ou invalide.
export function toIsoDate(raw) {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return new Date().toISOString().split('T')[0];
}

// Slugifie une étiquette pour générer une classe CSS (ex: "Économie" → "economie").
export function slugifyTag(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Mappe un type ("Note d'analyse", "Essai", …) vers le suffixe de classe utilisé par le site.
export function typeBadgeSuffix(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('note')) return 'note';
  if (t.includes('essai')) return 'essai';
  if (t.includes('tribune')) return 'tribune';
  if (t.includes('rapport')) return 'rapport';
  if (t.includes('entretien') || t.includes('interview')) return 'entretien';
  return slugifyTag(type);
}

// Calcule les initiales (max 2) d'une chaîne d'auteurs.
export function authorInitials(authors) {
  const first = (authors || '').split(',')[0].trim();
  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Échappe les attributs HTML.
export function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPublicationHtml({ title, authors, authorBio, date, isoDate, pole, type, summary, content, slug, heroImage, pdfUrl, relatedSection, avatarColor }) {
  const tagsArr = Array.isArray(pole) ? pole : (pole ? [pole] : []);
  const typeSuffix = typeBadgeSuffix(type);
  const initials = authorInitials(authors);
  const canonical = `https://institut-rousseau.fr/publications/${slug}`;
  const shareUrl = encodeURIComponent(canonical);
  const shareTitle = encodeURIComponent(`${title} — Institut Rousseau`);
  const descEsc = escAttr(summary);
  const titleEsc = escAttr(title);
  // Couleur d'avatar : on garde celle d'origine si on a pu l'extraire,
  // sinon on retombe sur la couleur de catégorie (fallback pour nouveaux articles).
  const avatarGradientStart = avatarColor || categoryColor(slugifyTag(tagsArr[0] || ''));
  const heroHtml = heroImage?.src
    ? `<figure class="article-hero-img"><img src="${escAttr(heroImage.src)}" alt="${escAttr(heroImage.alt || title)}" loading="lazy"></figure>`
    : '';
  const bioHtml = authorBio ? `<div class="article-author-bio">${escAttr(authorBio)}</div>` : '';
  const pdfCtaHtml = pdfUrl
    ? `<div class="article-pdf-cta" style="margin:1rem 0 1.5rem;"><a href="${escAttr(pdfUrl)}" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size:.9rem;">📄 Télécharger le PDF</a></div>`
    : '';
  // Section "À lire aussi" curée à la main (préservée du HTML d'origine).
  // Le `#relatedPubs` ci-dessous est rempli côté client par related.js et
  // affiche d'autres recommandations automatiques.
  const relatedHtml = relatedSection || '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap"></noscript>
  <meta name="description" content="${descEsc}">
  <meta name="theme-color" content="#1B2A4A">
  <link rel="icon" type="image/svg+xml" href="../assets/images/favicon.svg">
  <link rel="apple-touch-icon" href="../assets/images/favicon.svg">
  <meta property="og:title" content="${titleEsc} — Institut Rousseau">
  <meta property="og:description" content="${descEsc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <link rel="canonical" href="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titleEsc} — Institut Rousseau">
  <meta name="twitter:description" content="${descEsc}">
  <title>${titleEsc} — Institut Rousseau</title>
  <link rel="stylesheet" href="../assets/css/variables.css?v=2">
  <link rel="stylesheet" href="../assets/css/base.css?v=2">
  <link rel="stylesheet" href="../assets/css/layout.css?v=2">
  <link rel="stylesheet" href="../assets/css/components.css?v=2">
  <link rel="stylesheet" href="../assets/css/header.css?v=2">
  <link rel="stylesheet" href="../assets/css/footer.css?v=2">
  <link rel="stylesheet" href="../assets/css/pages/publications.css?v=2">
  <link rel="stylesheet" href="../assets/css/responsive.css?v=2">
  <link rel="stylesheet" href="../assets/css/features.css?v=2">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": ${JSON.stringify(title)},
  "description": ${JSON.stringify(summary || '')},
  "datePublished": ${JSON.stringify(isoDate || toIsoDate(date))},
  "author": { "@type": "Person", "name": ${JSON.stringify(authors || 'Institut Rousseau')} },
  "publisher": { "@type": "Organization", "name": "Institut Rousseau", "url": "https://institut-rousseau.fr" },
  "mainEntityOfPage": ${JSON.stringify(canonical)}
}
</script>
</head>
<body>
<div id="progress-bar" class="reading-progress"></div>
<a href="#main" class="skip-link">Aller au contenu principal</a>
<div id="nav-placeholder"></div>

<main id="main">
<section class="page-header">
  <div class="container">
    <nav class="breadcrumb" aria-label="Fil d'Ariane">
      <a href="../index.html">Accueil</a> <span class="sep">/</span> <a href="../publications.html">Publications</a> <span class="sep">/</span> <span aria-current="page">${titleEsc}</span>
    </nav>
    ${tagsArr.length ? `<div class="pub-card-tags" style="margin-bottom:.75rem;">${tagsArr.map(t => `<span class="pub-card-tag tag-${slugifyTag(t)}">${escAttr(t)}</span>`).join('')}</div>` : ''}
    ${type ? `<span class="article-type-badge article-type-badge--${typeSuffix}">${escAttr(type)}</span>` : ''}
    <h1>${titleEsc}</h1>
    <p>${escAttr(date)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="article-content">
      ${heroHtml}
      ${authors ? `<div class="article-author-block">
        <div class="article-author-avatar" style="background:linear-gradient(135deg,${avatarGradientStart},#aaa)">${escAttr(initials)}</div>
        <div class="article-author-info">
          <div class="article-author-name">${escAttr(authors)}</div>
          ${bioHtml}
        </div>
      </div>` : ''}
      ${pdfCtaHtml}

      ${content}

      <div class="article-share">
        <span class="article-share-label">Partager</span>
        <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener noreferrer" aria-label="Partager sur Twitter">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Partager sur LinkedIn">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </a>
        <button class="copy-link-btn" aria-label="Copier le lien">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
      </div>

      ${relatedHtml}

      <div class="article-cta" style="margin:2.5rem 0 1.5rem;padding:1.5rem;background:var(--bg-alt,#f8fafc);border-radius:var(--radius-md,8px);text-align:center;">
        <p style="margin:0 0 .75rem;font-size:.95rem;color:var(--ink);">Vous avez apprécié cette publication ?</p>
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">
          <a href="../don.html" class="btn btn-terra" style="font-size:.85rem;">Faire un don <span style="font-size:.7rem;opacity:.8;">(66% déductible)</span></a>
          <a href="../adhesion.html" class="btn btn-secondary" style="font-size:.85rem;">Adhérer</a>
        </div>
      </div>
      <div id="relatedPubs" class="related-pubs"></div>
      <a href="../publications.html" class="article-back">← Retour aux publications</a>
    </div>
  </div>
</section>
</main>

<div id="footer-placeholder"></div>
<script src="../assets/js/translation.js?v=2"></script>
<script defer src="../assets/js/components.js?v=2"></script>
<script defer src="../assets/js/nav.js?v=2"></script>
<script defer src="../assets/js/main.js?v=2"></script>
<script defer src="../assets/js/search.js?v=2"></script>
<script src="../assets/js/publications-i18n.js?v=2"></script>
<script src="../assets/js/publications-data.js?v=3"></script>
<script src="../assets/js/article-i18n.js?v=2"></script>
<script src="../assets/js/related.js?v=3"></script>
<script defer src="../assets/js/article-author.js?v=1"></script>
</body>
</html>`;
}
