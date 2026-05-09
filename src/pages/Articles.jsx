import { useState, useMemo, useCallback, useRef } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import AuthorSearchBar from '../components/shared/AuthorSearchBar';
import MultiSelect from '../components/shared/MultiSelect';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo } from '../utils/formatters';
import { THEMATIQUES, PUB_TYPES, ARTICLE_STATUSES, COLORS, SITE_URL, TARGET_LANGUAGES, SITE_LANGUAGES, LS_KEYS, AUTO_TRANSLATE_TARGETS } from '../utils/constants';
import { translateArticle } from '../services/translate';
import { hasGitHub, insertHtmlInPage, formatDateSite, updatePublicationsI18n, updatePublicationsData, categoryColor, fetchPublicationI18n } from '../services/github';
import { fetchPublicationContent } from '../services/siteData';
import { loadLocal } from '../utils/localStorage';
import useDebounce from '../hooks/useDebounce';
import ARTICLE_TEMPLATES from '../data/articleTemplates';
import PublishWithTranslation from '../components/articles/PublishWithTranslation';
import PublishFlowModal from '../components/articles/PublishFlowModal';
import QuickAddProfileModal from '../components/articles/QuickAddProfileModal';
import RichEditor from '../components/editor/RichEditor';
import useDraftAutosave from '../hooks/useDraftAutosave';
import useUnsavedGuard from '../hooks/useUnsavedGuard';
import { useConfirm } from '../components/shared/ConfirmDialog';
import ResultsCount from '../components/shared/ResultsCount';
import RomanNumeral, { toRoman } from '../components/shared/RomanNumeral';
import { humanizeError } from '../utils/errors';
import { buildPublicationHtml, escAttr, toIsoDate } from '../utils/publicationHtml';

export default function Articles({
  articles, setArticles, loading, toast,
  auteurs = [], setAuteurs,
  saveToSite,
}) {
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [themeFilter, setThemeFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [langFilter, setLangFilter] = useState('all');     // Chantier 7
  const [authorFilter, setAuthorFilter] = useState('all'); // Chantier 7
  const [showForm, setShowForm] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const emptyTranslations = () => Object.fromEntries(
    TARGET_LANGUAGES.map(l => [l.code, { title: '', summary: '', content: '' }])
  );
  const [form, setForm] = useState({ title: '', author: '', authorIds: [], tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '', scheduledDate: '', translations: emptyTranslations() });

  // Calcule la chaîne lisible "Prénom Nom, Prénom Nom" à partir d'une liste
  // d'IDs profil. Source unique : auteurs (prop). Fallback sur form.author si
  // aucun ID (article legacy non encore migré vers authorIds).
  const namesFromIds = useCallback((ids) => {
    if (!ids || !ids.length) return '';
    return ids.map(id => {
      const a = auteurs.find(au => au.id === id);
      if (!a) return null;
      const full = `${a.firstName || ''} ${a.lastName || ''}`.trim();
      return full || a.name || null;
    }).filter(Boolean).join(', ');
  }, [auteurs]);

  // Renvoie la liste d'IDs effective : form.authorIds si renseignée, sinon
  // tente un match tolérant sur form.author (string libre legacy).
  const resolveAuthorIds = useCallback(() => {
    if (form.authorIds && form.authorIds.length) return form.authorIds;
    const raw = (form.author || '').trim();
    if (!raw) return [];
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    return raw.split(/ *(?:,|&| et | and ) */).map(part => {
      const k = norm(part);
      const m = auteurs.find(a => norm(`${a.firstName || ''} ${a.lastName || ''}`) === k);
      return m?.id || null;
    }).filter(Boolean);
  }, [form.authorIds, form.author, auteurs]);

  // Synchronise form.author depuis form.authorIds dès qu'authorIds change.
  // Ainsi le rendu HTML construit côté pushArticleToSite reste cohérent.
  const setAuthorIds = useCallback((ids) => {
    setForm(f => ({ ...f, authorIds: ids, author: ids.length ? namesFromIds(ids) : f.author }));
  }, [namesFromIds]);
  // Langue actuellement éditée dans le formulaire ('fr' = source, sinon code de TARGET_LANGUAGES).
  const [langTab, setLangTab] = useState('fr');

  // Auto-save du brouillon dans localStorage (debounce 3s) + alerte beforeunload.
  // On désactive l'autosave pour les articles déjà publiés sur le site : la
  // sauvegarde se fait directement vers GitHub, et un brouillon résiduel en
  // localStorage finit par proposer de restaurer un état périmé.
  const draftKey = editingArt?.id ? `article-${editingArt.id}` : 'article-new';
  const draftEnabled = showForm && editingArt?.status !== 'published';
  const { existingDraft, restore: restoreDraft, clear: clearDraft, dismissDraft } =
    useDraftAutosave(draftKey, form, { enabled: draftEnabled });
  const { markSaved } = useUnsavedGuard(showForm ? form : null);
  const [publishingId, setPublishingId] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  // Identifie l'édition en cours pour annuler l'application d'un fetch
  // lent si l'utilisateur a entre-temps cliqué Éditer sur un autre article.
  const editGenRef = useRef(0);
  const debouncedSearch = useDebounce(search);

  // ─── Publish flow state ───────────────────────
  const [publishFlow, setPublishFlow] = useState(null); // { article, step: 1|2|3 }
  const [showPublishTranslation, setShowPublishTranslation] = useState(false);
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Création rapide d'un profil depuis le picker (Brief 2026-05-08).
  // Ces hooks DOIVENT rester avant l'early-return `if (loading)` plus bas —
  // sinon React #310 (hook count différent entre deux renders).
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState({ firstName: '', lastName: '' });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [autoTranslating, setAutoTranslating] = useState(false);

  // Source unique : les publications du repo site (assets/js/publications-data.js),
  // chargées par App.jsx via siteData.fetchAllSiteData() et passées en props.
  const allArticles = articles;

  // Filtrage
  const filtered = useMemo(() => {
    let list = allArticles;
    if (statusFilter.length) list = list.filter(a => statusFilter.includes(a.status));
    if (themeFilter.length) list = list.filter(a => (a.tags || []).some(t => themeFilter.includes(t)));
    if (typeFilter.length) list = list.filter(a => typeFilter.includes(a.type));
    if (langFilter !== 'all') {
      // missing-{code} → publis qui n'ont PAS de traduction dans cette langue
      // has-{code}     → publis qui en ont une
      const m = langFilter.match(/^(missing|has)-(\w+)$/);
      if (m) {
        const [, mode, code] = m;
        list = list.filter(a => {
          const t = a.translations?.[code];
          const filled = !!(t?.title?.trim() && t?.content?.trim());
          return mode === 'has' ? filled : !filled;
        });
      }
    }
    if (authorFilter !== 'all') {
      list = list.filter(a => Array.isArray(a.authorIds) && a.authorIds.includes(authorFilter));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allArticles, statusFilter, themeFilter, typeFilter, langFilter, authorFilter, debouncedSearch]);

  const counts = useMemo(() => ({
    total: allArticles.length,
    draft: allArticles.filter(a => a.status === 'draft').length,
    review: allArticles.filter(a => a.status === 'review').length,
    ready: allArticles.filter(a => a.status === 'ready').length,
    published: allArticles.filter(a => a.status === 'published').length,
    archived: allArticles.filter(a => a.status === 'archived').length,
  }), [allArticles]);

  const readyArticles = useMemo(() =>
    allArticles.filter(a => a.status === 'ready'),
  [allArticles]);

  // ─── Actions ──────────────────────────────────
  const updateStatus = (id, newStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    toast(`Publication passée en ${ARTICLE_STATUSES[newStatus]?.label || newStatus}`);
  };

  // Repasse un article publié en brouillon (statut local seulement).
  const sendBackToDraft = (article) => {
    updateStatus(article.id, 'draft');
  };

  // ─── Publish flow ─────────────────────────────
  const startPublishFlow = (article) => {
    setPublishFlow({ article, step: 1 });
    // Pré-remplit la sélection avec les authorIds de l'article (ou un match
    // tolérant sur la string `author` legacy si aucun ID n'est encore posé).
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    let preset = Array.isArray(article.authorIds) ? [...article.authorIds] : [];
    if (!preset.length && article.author) {
      preset = (article.author || '').split(/ *(?:,|&| et | and ) */).map(part => {
        const k = norm(part);
        const m = auteurs.find(a => norm(`${a.firstName || ''} ${a.lastName || ''}`) === k);
        return m?.id || null;
      }).filter(Boolean);
    }
    setSelectedAuthors(preset);
    setPreviewHtml('');
    setPublishResult(null);
    setPublishError(null);
  };

  const goToStep2 = () => {
    setPublishFlow(prev => ({ ...prev, step: 2 }));
    setPreviewLoading(true);
    setPreviewHtml(publishFlow.article.content || '<p>Aucun contenu disponible.</p>');
    setPreviewLoading(false);
  };

  const executePublish = async () => {
    setPublishFlow(prev => ({ ...prev, step: 3 }));
    setPublishError(null);
    const article = publishFlow.article;

    try {
      // 0. Auto-traduction (Chantier 6) — déclenchée automatiquement au
      //    publish pour combler les langues cibles vides. Best-effort : si
      //    le service de traduction échoue, on continue avec les langues
      //    disponibles (l'utilisatrice peut éditer après et republier).
      const translations = { ...(article.translations || {}) };
      const translateMissing = AUTO_TRANSLATE_TARGETS.filter(code => {
        const t = translations[code];
        return !(t?.title?.trim() && t?.content?.trim());
      });
      if (translateMissing.length && article.title?.trim() && article.content?.trim()) {
        toast?.(`Traduction auto en cours (${translateMissing.join(', ').toUpperCase()})…`);
        for (const code of translateMissing) {
          try {
            const result = await translateArticle(
              { title: article.title, summary: article.summary || '', content: article.content || '' },
              'fr',
              code,
            );
            translations[code] = {
              title: result.title || '',
              summary: result.summary || '',
              content: result.content || '',
              autoTranslated: true,
              translatedAt: new Date().toISOString(),
            };
          } catch (err) {
            console.warn(`[Articles] Auto-trad ${code} échouée :`, err.message);
          }
        }
        // Persiste localement la traduction obtenue (visible avant retour publish)
        setArticles(prev => prev.map(a => a.id === article.id ? { ...a, translations } : a));
      }

      // 1. Get content
      const html = previewHtml || article.content || '';

      // 2. Build author names
      const authorNames = selectedAuthors
        .map(id => {
          const a = auteurs.find(au => au.id === id);
          if (!a) return null;
          return a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name;
        })
        .filter(Boolean)
        .join(', ');

      // 3. Build full HTML page
      const today = new Date().toISOString().split('T')[0];
      const todayFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      const slug = article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const pole = (article.tags || [])[0] || '';
      const pubType = article.type || '';

      const fullHtml = buildPublicationHtml({
        title: article.title,
        authors: authorNames,
        date: todayFr,
        pole,
        type: pubType,
        summary: article.summary || '',
        content: html,
        slug,
      });

      // 4. Push to GitHub via Worker (secret GITHUB_PAT côté serveur)
      const workerUrl = loadLocal(LS_KEYS.workerUrl, '') || import.meta.env.VITE_WORKER_URL || '';
      let commitSha = null;
      if (workerUrl) {
        const resp = await fetch(`${workerUrl}/api/github/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            html: fullHtml,
            metadata: { title: article.title, authors: authorNames, pole, type: pubType },
            commitMessage: `Publish: ${article.title}`,
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `GitHub : ${resp.status}`);
        }
        const result = await resp.json();
        commitSha = result.sha;
      } else if (hasGitHub()) {
        // Fallback : insertion legacy dans publications.html via Worker. Tous les
        // champs susceptibles de venir de la saisie utilisateur sont passés par
        // escAttr() — un titre comme `</h3><script>…</script>` ne casse plus la
        // page publique (cf. AUDIT §4.6).
        const cardHtml = `
<article class="publication-card" data-tags="${escAttr((article.tags || []).join(' '))}">
  ${(article.tags || []).map(t => `<span class="tag">${escAttr(t)}</span>`).join('')}
  <span class="type">${escAttr(pubType)}</span>
  <h3>${escAttr(article.title)}</h3>
  <p class="meta">${escAttr(authorNames)} — ${escAttr(todayFr)}</p>
  <p>${escAttr(article.summary || '')}</p>
</article>`;
        await insertHtmlInPage('publications.html', cardHtml, `Ajout publication : ${article.title}`);
      }

      // 5. Update local state (la source de vérité reste publications-data.js
      //    du repo site ; le rechargement est piloté par App.jsx).
      setArticles(prev => prev.map(a =>
        a.id === article.id
          ? { ...a, status: 'published', synced: true, date: today, author: authorNames, authorIds: [...selectedAuthors] }
          : a
      ));

      setPublishResult({
        title: article.title,
        authors: authorNames,
        date: todayFr,
        slug,
        sha: commitSha,
        siteUrl: `${SITE_URL}/publications/${slug}.html`,
      });
    } catch (e) {
      setPublishError(e.message || 'Erreur lors de la publication');
    }
  };

  const closePublishFlow = () => {
    setPublishFlow(null);
    setSelectedAuthors([]);
    setPreviewHtml('');
    setPublishResult(null);
    setPublishError(null);
  };

  // ─── Legacy local CRUD ────────────────────────
  const publishArticleLegacy = async (id) => {
    setPublishingId(id);
    const pub = articles.find(a => a.id === id);
    if (!pub) { setPublishingId(null); return; }
    try {
      if (hasGitHub()) {
        // Échappement des champs (cf. AUDIT §4.6).
        const safePdfUrl = pub.pdfUrl && /^https?:/i.test(pub.pdfUrl) ? pub.pdfUrl : '';
        const cardHtml = `
<article class="publication-card" data-tags="${escAttr((pub.tags || []).join(' '))}">
  ${(pub.tags || []).map(t => `<span class="tag">${escAttr(t)}</span>`).join('')}
  <span class="type">${escAttr(pub.type)}</span>
  <h3>${escAttr(pub.title)}</h3>
  <p class="meta">${escAttr(pub.author || '')} — ${escAttr(formatDateSite(pub.date))}</p>
  <p>${escAttr(pub.summary || '')}</p>${safePdfUrl ? `\n  <a href="${escAttr(safePdfUrl)}" target="_blank" rel="noopener noreferrer">Lire le PDF</a>` : ''}
</article>`;
        await insertHtmlInPage('publications.html', cardHtml, `Ajout publication : ${pub.title}`);
        setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
        toast('Publication publiée sur le site');
      } else {
        await new Promise(r => setTimeout(r, 1500));
        setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
        toast('Publication publiée (simulation)');
      }
    } catch (e) {
      toast(humanizeError(e, 'La publication a échoué'), 'error', {
        action: { label: 'Réessayer', onClick: () => publishArticle(id) },
      });
    }
    setPublishingId(null);
  };

  const deleteArticle = async (id) => {
    const art = articles.find(a => a.id === id);
    const title = art?.title || 'cette publication';
    const isPublished = art?.status === 'published';
    const ok = await confirm({
      title: 'Supprimer la publication',
      message: `Voulez-vous vraiment supprimer « ${title} » ?`,
      details: isPublished
        ? 'Cette publication est en ligne sur le site. La supprimer ici ne la retire pas du site automatiquement — il faudra la dépublier ensuite.'
        : null,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setArticles(prev => prev.filter(a => a.id !== id));
    toast('Publication supprimée');
  };

  // Republie un article existant du site : reconstruit le HTML complet via
  // buildPublicationHtml et le pousse sur publications/{slug}.html.
  const pushArticleToSite = async (art, formData) => {
    const slug = art.slug;
    if (!slug) throw new Error('Slug manquant');
    const dateFr = art.date ? formatDateSite(art.date) : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const pole = (formData.tags || [])[0] || '';
    const fullHtml = buildPublicationHtml({
      title: formData.title,
      authors: formData.author,
      authorBio: art.authorBio || '',
      date: art.displayDate || dateFr,
      isoDate: toIsoDate(art.date),
      pole,
      type: formData.type,
      summary: formData.summary || '',
      content: formData.content,
      slug,
      heroImage: art.heroImage || null,
      pdfUrl: formData.pdfUrl || '',
      relatedSection: art.relatedSection || '',
      avatarColor: art.avatarColor || '',
    });
    const workerUrl = loadLocal(LS_KEYS.workerUrl, '') || import.meta.env.VITE_WORKER_URL || '';
    if (!workerUrl) throw new Error('URL du Worker non configurée');
    const resp = await fetch(`${workerUrl}/api/github/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        html: fullHtml,
        metadata: { title: formData.title, authors: formData.author, pole, type: formData.type },
        commitMessage: `Update: ${formData.title}`,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `GitHub : ${resp.status}`);
    }
    // Met aussi à jour publications-data.js pour refléter les nouvelles
    // métadonnées dans la liste publique du site (titre, auteur, résumé…).
    try {
      const categories = (formData.tags || []).map(t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      // Chantier B : authorIds est la nouvelle relation par ID. author (string)
      // reste \u00e9crit en miroir pour la r\u00e9trocompat avec les vues du site qui ne
      // lisent pas encore les IDs (cf. Chantier C).
      const idsToWrite = (formData.authorIds && formData.authorIds.length) ? formData.authorIds : resolveAuthorIds();
      const authorString = idsToWrite.length ? namesFromIds(idsToWrite) : (formData.author || '');
      await updatePublicationsData({
        id: slug,
        title: formData.title,
        author: authorString,
        authorIds: idsToWrite,
        type: formData.type,
        categories,
        color: categoryColor(categories[0]),
        description: formData.summary || '',
      });
    } catch (dataErr) {
      // L'article HTML est à jour, mais publications-data.js n'a pas pu être patché.
      console.warn('[Articles] publications-data.js non mis à jour :', dataErr.message);
    }
  };

  const saveArticle = async () => {
    if (!form.title) return toast('Le titre est requis', 'error');

    // Article venant du site (slug + déjà publié) → republier sur GitHub.
    if (editingArt && editingArt.slug && editingArt.status === 'published') {
      // Garde-fou : refuser une republication avec 0 catégorie. Sans tag,
      // publications-data.js perd l'entrée du carrousel et les filtres
      // de la page /publications.html ne retrouvent plus l'article.
      if (!form.tags || form.tags.length === 0) {
        return toast('Au moins un pôle thématique est requis', 'error');
      }
      setSavingEdit(true);
      try {
        await pushArticleToSite(editingArt, form);
        // Pousse aussi les traductions saisies dans les onglets EN/ES/DE/IT
        // dans `assets/js/publications-i18n.js` du repo site.
        const i18nEntry = {};
        const filledLangs = [];
        for (const lang of TARGET_LANGUAGES) {
          const t = form.translations?.[lang.code];
          if (!(t?.title?.trim() && t?.content?.trim())) continue;
          i18nEntry[`title_${lang.code}`] = t.title;
          if (t.summary) i18nEntry[`description_${lang.code}`] = t.summary;
          i18nEntry[`body_${lang.code}`] = t.content;
          filledLangs.push(lang.code);
        }
        if (Object.keys(i18nEntry).length > 0) {
          try {
            await updatePublicationsI18n(editingArt.slug, i18nEntry);
          } catch (i18nErr) {
            toast(`HTML mis à jour mais traductions non sauvegardées : ${i18nErr.message}`, 'error');
          }
        }
        setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
        toast(filledLangs.length
          ? `Publication mise à jour sur le site (FR + ${filledLangs.join(', ').toUpperCase()})`
          : 'Publication mise à jour sur le site');
        markSaved();
        clearDraft();
        closeForm();
      } catch (e) {
        toast(`Erreur publication : ${e.message}`, 'error');
      } finally {
        setSavingEdit(false);
      }
      return;
    }

    if (editingArt) {
      setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
      toast('Publication mise à jour');
    } else {
      const newArt = {
        id: Date.now(),
        ...form,
        status: form.scheduledDate ? 'scheduled' : 'draft',
        date: new Date().toISOString().split('T')[0],
        synced: false,
      };
      setArticles(prev => [newArt, ...prev]);
      toast('Publication créée');
    }
    markSaved();
    clearDraft();
    closeForm();
  };

  const startEdit = async (art) => {
    const gen = ++editGenRef.current;
    setEditingArt(art);
    // Pré-remplit translations avec ce qui est déjà présent sur l'article
    // (clés `en`, `es`, etc. injectées par PublishWithTranslation lors d'une
    // précédente publication multilingue).
    const initialTranslations = emptyTranslations();
    for (const lang of TARGET_LANGUAGES) {
      // Deux sources : `art[code]` (legacy, posé par PublishWithTranslation lors
      // d'une publication multilingue) ou `art.translations[code]` (nouvelle source,
      // posée par le formulaire à chaque sauvegarde locale).
      const t = art.translations?.[lang.code] || art[lang.code];
      if (t) initialTranslations[lang.code] = { title: t.title || '', summary: t.summary || '', content: t.content || '' };
    }
    setForm({
      title: art.title, author: art.author || '',
      authorIds: Array.isArray(art.authorIds) ? [...art.authorIds] : [],
      tags: [...(art.tags || [])],
      summary: art.summary || '', content: art.content || '',
      type: art.type || 'Note d\'analyse', pdfUrl: art.pdfUrl || '',
      scheduledDate: art.scheduledDate || '',
      translations: initialTranslations,
    });
    setLangTab('fr');
    setShowForm(true);

    // Best-effort : charger les traductions existantes depuis publications-i18n.js
    // pour pré-remplir les onglets EN/ES/DE/IT. Ne bloque pas l'ouverture du form.
    if (art.slug && hasGitHub()) {
      fetchPublicationI18n(art.slug).then(i18n => {
        if (gen !== editGenRef.current) return;
        const updates = {};
        let hasAny = false;
        for (const lang of TARGET_LANGUAGES) {
          const title = i18n[`title_${lang.code}`] || '';
          const summary = i18n[`description_${lang.code}`] || '';
          const content = i18n[`body_${lang.code}`] || '';
          if (title || summary || content) {
            updates[lang.code] = { title, summary, content };
            hasAny = true;
          }
        }
        if (hasAny) {
          setForm(f => ({
            ...f,
            translations: { ...f.translations, ...updates },
          }));
        }
      });
    }

    // Article du site sans contenu en mémoire → on récupère le HTML
    // depuis publications/{slug}.html et on le charge dans l'éditeur.
    if (art.slug && !art.content && hasGitHub()) {
      setContentLoading(true);
      try {
        const fetched = await fetchPublicationContent(art.slug);
        // Si l'utilisateur a relancé un autre Éditer pendant le fetch, on
        // ignore le résultat — `gen` ne correspond plus à l'édition en cours.
        if (gen !== editGenRef.current) return;
        setForm(f => ({ ...f, content: fetched.content, pdfUrl: f.pdfUrl || fetched.pdfUrl || '' }));
        // On garde tout ce qui n'est pas dans le formulaire (hero, bio, date
        // d'origine, section curée "À lire aussi", couleur avatar) sur
        // editingArt pour le ré-injecter à la republication.
        const enriched = {
          ...art,
          content: fetched.content,
          heroImage: fetched.heroImage,
          authorBio: fetched.authorBio,
          pdfUrl: art.pdfUrl || fetched.pdfUrl || '',
          displayDate: fetched.displayDate,
          relatedSection: fetched.relatedSection,
          avatarColor: fetched.avatarColor,
        };
        setEditingArt(enriched);
        setArticles(prev => prev.map(a => a.id === art.id ? enriched : a));
      } catch (err) {
        if (gen !== editGenRef.current) return;
        toast(`Impossible de charger le contenu : ${err.message}`, 'error');
      } finally {
        if (gen === editGenRef.current) setContentLoading(false);
      }
    }
  };

  const closeForm = () => {
    editGenRef.current++;
    setShowForm(false);
    setShowPublishTranslation(false);
    setEditingArt(null);
    setForm({ title: '', author: '', authorIds: [], tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '', scheduledDate: '', translations: emptyTranslations() });
    setLangTab('fr');
  };

  // ─── Colonnes tableau ─────────────────────────
  const columns = [
    {
      key: '_n', label: 'Nº', align: 'center',
      render: (v) => <RomanNumeral value={v} style={{ color: 'var(--text-light)', fontSize: 12, fontVariant: 'small-caps' }} />,
    },
    {
      key: 'status', label: 'Statut', render: (v) => {
        const cfg = ARTICLE_STATUSES[v] || ARTICLE_STATUSES.draft;
        return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
      }
    },
    { key: 'title', label: 'Titre', render: (v) => <span style={{ fontWeight: 500, maxWidth: 280, display: 'inline-block' }}>{v}</span> },
    { key: 'author', label: 'Auteur(s)' },
    { key: 'tags', label: 'Pôle', render: (v) => (v || []).map(t => {
      const n = THEMATIQUES.indexOf(t) + 1;
      return (
        <span key={t} className="badge badge-sky" style={{ marginRight: 4 }}>
          {n > 0 && <RomanNumeral value={n} style={{ marginRight: 4, opacity: 0.7 }} />}
          {t}
        </span>
      );
    }) },
    { key: 'type', label: 'Type', render: (v) => v ? <span className="badge badge-navy">{v}</span> : null },
    { key: 'date', label: 'Date', render: (v, row) => row.lastEdited ? timeAgo(row.lastEdited) : formatDateFr(v) },
    {
      key: 'actions', label: 'Actions', render: (_, row) => (
        <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>Éditer</button>
          {row.status === 'ready' && (
            <>
              <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); startPublishFlow(row); }}>
                Publier
              </button>
              <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); sendBackToDraft(row); }}>
                Renvoyer
              </button>
            </>
          )}
          {row.status === 'draft' && (
            <button className="btn btn-ochre btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'review'); }}>Relecture</button>
          )}
          {row.status === 'review' && (
            <button className="btn btn-sky btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'ready'); }}>Valider</button>
          )}
          {row.status === 'published' && row.slug && (
            <a
              href={`${SITE_URL}/publications/${row.slug}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              onClick={e => e.stopPropagation()}
            >
              Voir ↗
            </a>
          )}
          {row.status === 'published' && (
            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'draft'); }}>Dépublier</button>
          )}
          <button
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--danger)' }}
            title="Supprimer cette publication"
            aria-label={`Supprimer la publication ${row.title || ''}`}
            onClick={(e) => { e.stopPropagation(); deleteArticle(row.id); }}
          >
            Supprimer
          </button>
        </div>
      )
    },
  ];

  // ─── Row class for ready articles ─────────────
  const rowClassName = (row) => {
    if (row.status === 'ready') return 'row-ready-publish';
    if (row.status === 'archived') return 'row-archived';
    return '';
  };

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Publications</h1></div>
        <div className="page-body"><SkeletonTable /></div>
      </>
    );
  }

  // Accesseurs basés sur l'onglet de langue actif. La source FR vit sur
  // form.{title,summary,content} ; les autres langues sur form.translations[code].
  const isSourceLang = langTab === 'fr';
  const currentTitle = isSourceLang ? form.title : (form.translations[langTab]?.title ?? '');
  const currentSummary = isSourceLang ? form.summary : (form.translations[langTab]?.summary ?? '');
  const currentContent = isSourceLang ? form.content : (form.translations[langTab]?.content ?? '');
  const updateLangField = (field, value) => {
    if (isSourceLang) {
      setForm(f => ({ ...f, [field]: value }));
    } else {
      setForm(f => ({
        ...f,
        translations: {
          ...f.translations,
          [langTab]: { ...(f.translations[langTab] || { title: '', summary: '', content: '' }), [field]: value },
        },
      }));
    }
  };
  const isLangFilled = (code) => {
    if (code === 'fr') return !!(form.title?.trim() && form.content?.trim());
    const t = form.translations[code];
    return !!(t?.title?.trim() && t?.content?.trim());
  };

  const submitQuickAdd = async () => {
    const fn = quickAdd.firstName.trim();
    const ln = quickAdd.lastName.trim();
    if (!fn || !ln) { toast?.('Prénom et nom requis', 'error'); return; }
    const slug = `${fn}-${ln}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (auteurs.some(a => a.id === slug)) {
      toast?.('Un profil avec ce nom existe déjà', 'error');
      return;
    }
    const newProfile = {
      id: slug,
      firstName: fn,
      lastName: ln,
      photo: '',
      description: '',
      roles: ['auteur_externe'],
      roleLibelle: '',
      email: '',
      emailPublic: false,
      linkedin: '',
      actif: true,
    };
    const next = [...auteurs, newProfile];
    setQuickAddSaving(true);
    try {
      if (setAuteurs) setAuteurs(next);
      if (saveToSite) {
        await saveToSite('auteurs', next, `Profil ajouté (depuis publication) : ${fn} ${ln}`);
      }
      // Auto-sélectionne le nouveau profil dans le picker actif
      setSelectedAuthors(prev => prev.includes(slug) ? prev : [...prev, slug]);
      toast?.(`Profil créé : ${fn} ${ln}`);
      setQuickAddOpen(false);
      setQuickAdd({ firstName: '', lastName: '' });
    } catch (err) {
      toast?.(`Erreur : ${err.message}`, 'error');
    } finally {
      setQuickAddSaving(false);
    }
  };

  // Chantier 6 : auto-traduction FR → EN/ES (DE/IT restent saisies à la main).
  // Ne touche pas aux langues déjà remplies — l'utilisatrice doit pouvoir
  // forcer une re-traduction via le bouton "Forcer".
  const autoTranslateMissing = async (force = false) => {
    if (!form.title?.trim() || !form.content?.trim()) {
      toast?.('Saisis d\'abord le titre et le contenu en français', 'error');
      return;
    }
    setAutoTranslating(true);
    const updated = { ...form.translations };
    const errors = [];
    let translated = 0;
    for (const code of AUTO_TRANSLATE_TARGETS) {
      const existing = updated[code];
      const filled = !!(existing?.title?.trim() && existing?.content?.trim());
      if (filled && !force) continue;
      try {
        const result = await translateArticle(
          { title: form.title, summary: form.summary, content: form.content },
          'fr',
          code,
        );
        updated[code] = {
          title: result.title || '',
          summary: result.summary || '',
          content: result.content || '',
          autoTranslated: true,
          translatedAt: new Date().toISOString(),
        };
        translated++;
      } catch (err) {
        errors.push(`${code.toUpperCase()} : ${err.message}`);
      }
    }
    setForm(f => ({ ...f, translations: updated }));
    setAutoTranslating(false);
    if (translated > 0) toast?.(`Auto-traduction OK : ${translated} langue${translated > 1 ? 's' : ''}`);
    if (errors.length) toast?.(`Échec : ${errors.join(' · ')}`, 'error');
  };
  const currentLangAutoTranslated = form.translations[langTab]?.autoTranslated === true;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Publications</h1>
          <p className="page-header-sub">
            {counts.total} publications — {counts.published} publiées, {counts.draft} brouillons, {counts.ready} prêtes
          </p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          <button className="btn btn-primary" onClick={() => { closeForm(); setShowForm(true); }}>+ Nouvelle publication</button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Alert banner ──────────────────────── */}
        {counts.ready > 0 && (
          <div className="alert-banner alert-banner-amber mb-16 slide-up">
            <span className="alert-banner-icon">&#128276;</span>
            <span className="alert-banner-text">
              <strong>{counts.ready}</strong> article{counts.ready > 1 ? 's' : ''} en attente de publication
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => setStatusFilter('ready')}>
              Voir
            </button>
          </div>
        )}

        {/* Barre de filtres compacte */}
        <div className="filter-bar mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une publication…" />
          <MultiSelect
            label={`Statut (${counts.total})`}
            selected={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'draft', label: `Brouillons (${counts.draft})` },
              { value: 'review', label: `À relire (${counts.review})` },
              { value: 'ready', label: `Prêts à publier (${counts.ready})` },
              { value: 'published', label: `Publiés (${counts.published})` },
              { value: 'archived', label: `Archivés (${counts.archived})` },
            ]}
          />
          <MultiSelect
            label="Pôle"
            selected={themeFilter}
            onChange={setThemeFilter}
            options={THEMATIQUES.map((t, i) => ({ value: t, label: `${toRoman(i + 1)} · ${t}` }))}
          />
          <select
            className="filter-select"
            aria-label="Filtrer par type de publication"
            value={typeFilter[0] || ''}
            onChange={e => setTypeFilter(e.target.value ? [e.target.value] : [])}
          >
            <option value="">Tous les types</option>
            {PUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            className="filter-select"
            aria-label="Filtrer par auteur"
            value={authorFilter}
            onChange={e => setAuthorFilter(e.target.value)}
          >
            <option value="all">Tous les auteurs</option>
            {auteurs
              .filter(a => a.actif !== false)
              .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'fr'))
              .map(a => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
          </select>
          <select
            className="filter-select"
            aria-label="Filtrer par langue de traduction"
            value={langFilter}
            onChange={e => setLangFilter(e.target.value)}
          >
            <option value="all">Toutes les langues</option>
            <optgroup label="Manque la traduction">
              {TARGET_LANGUAGES.map(l => (
                <option key={`m-${l.code}`} value={`missing-${l.code}`}>Sans {l.label}</option>
              ))}
            </optgroup>
            <optgroup label="Traduit en">
              {TARGET_LANGUAGES.map(l => (
                <option key={`h-${l.code}`} value={`has-${l.code}`}>Avec {l.label}</option>
              ))}
            </optgroup>
          </select>
          {(statusFilter.length > 0 || themeFilter.length > 0 || typeFilter.length > 0 || authorFilter !== 'all' || langFilter !== 'all') && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setStatusFilter([]); setThemeFilter([]); setTypeFilter([]); setAuthorFilter('all'); setLangFilter('all'); }}
            >
              Effacer filtres
            </button>
          )}
        </div>
        {(statusFilter.length > 0 || themeFilter.length > 0 || typeFilter.length > 0) && (
          <div className="filter-tags">
            {statusFilter.map(v => (
              <span key={`s-${v}`} className="filter-tag">
                {ARTICLE_STATUSES[v]?.label || v}
                <button
                  type="button"
                  aria-label={`Retirer le filtre ${ARTICLE_STATUSES[v]?.label || v}`}
                  title="Retirer ce filtre"
                  onClick={() => setStatusFilter(statusFilter.filter(x => x !== v))}
                >×</button>
              </span>
            ))}
            {themeFilter.map(v => (
              <span key={`t-${v}`} className="filter-tag">
                {v}
                <button
                  type="button"
                  aria-label={`Retirer le filtre ${v}`}
                  title="Retirer ce filtre"
                  onClick={() => setThemeFilter(themeFilter.filter(x => x !== v))}
                >×</button>
              </span>
            ))}
            {typeFilter.map(v => (
              <span key={`y-${v}`} className="filter-tag">
                {v}
                <button
                  type="button"
                  aria-label={`Retirer le filtre ${v}`}
                  title="Retirer ce filtre"
                  onClick={() => setTypeFilter(typeFilter.filter(x => x !== v))}
                >×</button>
              </span>
            ))}
          </div>
        )}

        <ResultsCount
          count={filtered.length}
          total={allArticles.length}
          itemLabel="publication"
          itemLabelPlural="publications"
          onReset={() => { setStatusFilter([]); setThemeFilter([]); setTypeFilter([]); setSearch(''); }}
        />

        <DataTable
          columns={columns}
          data={filtered.map((a, i) => ({ ...a, _n: i + 1 }))}
          pageSize={15}
          totalCount={allArticles.length}
          emptyMessage={
            (statusFilter.length || themeFilter.length || typeFilter.length || search)
              ? 'Aucune publication ne correspond à vos filtres. Essayez d\'élargir votre recherche.'
              : 'Aucune publication pour le moment. Cliquez sur « + Nouvelle publication » pour commencer.'
          }
          rowClassName={rowClassName}
        />

        {/* ── Formulaire local ──────────────────── */}
        {showForm && (
          <Modal title={editingArt ? 'Modifier la publication' : 'Nouvelle publication'} onClose={closeForm} size="lg">
            {existingDraft && (
              <div className="alert-banner alert-banner-amber mb-16" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>📝</span>
                <div style={{ flex: 1, fontSize: 13 }}>
                  Brouillon trouvé — sauvegardé {timeAgo(existingDraft.savedAt)}.
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  type="button"
                  onClick={() => {
                    const restored = restoreDraft();
                    if (restored) setForm(restored);
                  }}
                >
                  Restaurer
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  type="button"
                  onClick={() => { dismissDraft(); clearDraft(); }}
                >
                  Ignorer
                </button>
              </div>
            )}
            {/* Onglets de langue : FR (source) + traductions */}
            <div className="lang-tabs" role="tablist" aria-label="Langue éditée" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {SITE_LANGUAGES.map(l => {
                const filled = isLangFilled(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="tab"
                    aria-selected={langTab === l.code}
                    className={`lang-tab${langTab === l.code ? ' active' : ''}${filled ? ' filled' : ''}`}
                    onClick={() => setLangTab(l.code)}
                  >
                    <span className="lang-tab-flag">{l.flag}</span>
                    <span className="lang-tab-label">{l.label}</span>
                    {l.isSource && <span className="lang-tab-source">source</span>}
                    {!l.isSource && filled && <span className="lang-tab-check" aria-hidden="true">✓</span>}
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={autoTranslating || !form.title?.trim() || !form.content?.trim()}
                  onClick={() => autoTranslateMissing(false)}
                  title="Auto-traduit FR → EN + ES uniquement pour les langues vides"
                >
                  {autoTranslating ? '⏳ Traduction…' : '✨ Auto-traduire EN + ES'}
                </button>
                {(form.translations.en?.autoTranslated || form.translations.es?.autoTranslated) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={autoTranslating}
                    onClick={() => autoTranslateMissing(true)}
                    title="Re-traduit FR → EN + ES en écrasant les traductions existantes"
                  >
                    Re-traduire (force)
                  </button>
                )}
              </div>
            </div>
            {currentLangAutoTranslated && (
              <p style={{ fontSize: 12, color: COLORS.ochre, margin: '4px 0 8px' }}>
                ⚠ Traduction auto — relisez attentivement et corrigez si besoin avant publication.
              </p>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>Titre {!isSourceLang && <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— version {SITE_LANGUAGES.find(l => l.code === langTab)?.label}</span>}</label>
              <input value={currentTitle} onChange={e => updateLangField('title', e.target.value)} />
            </div>

            {isSourceLang && (
              <div style={{ marginBottom: 16 }}>
                <label>Auteur(s) <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>(commun à toutes les langues)</span></label>
                <AuthorSearchBar
                  authors={auteurs}
                  selected={form.authorIds || []}
                  onChange={setAuthorIds}
                  onAddNew={(query) => {
                    const parts = query.trim().split(/\s+/);
                    setQuickAdd({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' });
                    setQuickAddOpen(true);
                  }}
                  placeholder="Tape un nom (ex : Nicolas Dufrêne)…"
                />
                {form.author && !(form.authorIds && form.authorIds.length) && (
                  <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 6 }}>
                    Auteur legacy : <code>{form.author}</code>. Tape le nom ci-dessus pour relier au profil.
                  </p>
                )}
              </div>
            )}
            {!isSourceLang && form.author && (
              <div style={{ marginBottom: 16, padding: 8, background: '#f3f4f6', borderRadius: 6, fontSize: 12, color: 'var(--text-light)' }}>
                Auteur(s) (commun à toutes les langues) : <strong>{namesFromIds(form.authorIds) || form.author}</strong>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>Pôles thématiques</label>
              <div className="flex-wrap gap-8" style={{ marginTop: 4 }}>
                {THEMATIQUES.map((t, i) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: form.tags.includes(t) ? 'var(--sky-light)' : '#F9FAFB', border: `1px solid ${form.tags.includes(t) ? 'var(--sky)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={form.tags.includes(t)} onChange={() => {
                      setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }));
                    }} style={{ width: 'auto', marginRight: 4 }} />
                    <RomanNumeral value={i + 1} style={{ opacity: 0.6, marginRight: 2 }} />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Type</label>
                <select value={form.type} onChange={(e) => {
                  const newType = e.target.value;
                  // Si l'éditeur est vide → charge la trame silencieusement.
                  // Sinon, on change juste le type sans toucher au contenu.
                  if (!form.content?.trim() && ARTICLE_TEMPLATES[newType]?.skeleton) {
                    setForm(f => ({ ...f, type: newType, content: ARTICLE_TEMPLATES[newType].skeleton }));
                  } else {
                    setForm(f => ({ ...f, type: newType }));
                  }
                }}>
                  {PUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {ARTICLE_TEMPLATES[form.type] && (
                  <span style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2, display: 'block' }}>
                    Cible : {ARTICLE_TEMPLATES[form.type].estimatedWords}
                  </span>
                )}
              </div>
              <div>
                <label>Lien PDF (optionnel)</label>
                <input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            {/* Guide de rédaction — accordéon replié par défaut (UX 2026-05-08) */}
            {ARTICLE_TEMPLATES[form.type]?.guide && (
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-light)', padding: '6px 0' }}>
                  Aide à la rédaction pour ce type
                </summary>
                <div style={{ marginTop: 8 }}>
                  <div className="template-guide">
                    {ARTICLE_TEMPLATES[form.type].guide.map((g, i) => (
                      <div key={i} className="template-guide-item">
                        <div className="template-guide-section">{g.section}</div>
                        <div className="template-guide-hint">{g.hint}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={async () => {
                      if (form.content) {
                        const ok = await confirm({
                          title: 'Remplacer le contenu ?',
                          message: 'Le contenu actuel de l\'éditeur va être remplacé par la trame du modèle.',
                          confirmLabel: 'Remplacer',
                          danger: true,
                        });
                        if (!ok) return;
                      }
                      setForm(f => ({ ...f, content: ARTICLE_TEMPLATES[f.type].skeleton }));
                    }}
                  >
                    Recharger la trame
                  </button>
                </div>
              </details>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>Publication programmée (optionnel)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="datetime-local"
                  value={form.scheduledDate || ''}
                  onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                  style={{ maxWidth: 260 }}
                />
                {form.scheduledDate && (
                  <>
                    <span className="badge badge-ochre" style={{ fontSize: 12 }}>
                      Programmé le {new Date(form.scheduledDate).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={() => setForm({ ...form, scheduledDate: '' })} style={{ fontSize: 11 }}>Annuler</button>
                  </>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                Laissez vide pour une publication manuelle. Si renseigné, l'article passera en statut "Programmé".
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Résumé {!isSourceLang && <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— version {SITE_LANGUAGES.find(l => l.code === langTab)?.label}</span>}</label>
              <textarea rows={3} value={currentSummary} onChange={e => updateLangField('summary', e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Contenu {!isSourceLang && <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— version {SITE_LANGUAGES.find(l => l.code === langTab)?.label}</span>}</label>
              {contentLoading && (
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
                  Chargement de l'article depuis le site…
                </div>
              )}
              {editingArt?.slug && editingArt?.status === 'published' && !contentLoading && isSourceLang && (
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
                  Article existant : édition en HTML uniquement (round-trip exact garanti — préserve notes de bas de page, tableaux, iframes, SVG et toutes les balises d'origine). Utilise l'onglet Aperçu pour vérifier le rendu.
                </div>
              )}
              {!isSourceLang && (
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
                  Saisis ici la traduction du contenu en {SITE_LANGUAGES.find(l => l.code === langTab)?.label}. HTML autorisé. Laisse vide pour ne pas publier cette langue.
                </div>
              )}
              {/* Forcer le remount à chaque changement de langue : sinon l'éditeur garde
                  son état interne (mode visuel/HTML, sélection) sur le contenu précédent. */}
              <RichEditor
                key={`editor-${langTab}`}
                value={currentContent}
                onChange={(html) => updateLangField('content', html)}
                title={currentTitle}
                author={form.author}
                placeholder={contentLoading ? 'Chargement…' : 'Écrivez votre article ici…'}
                slug={editingArt?.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
                toast={toast}
                trusted={!!(editingArt?.slug && editingArt?.status === 'published') && isSourceLang}
                defaultMode={editingArt?.slug && editingArt?.status === 'published' && isSourceLang ? 'html' : 'apercu'}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm} disabled={savingEdit}>Annuler</button>
              <button className="btn btn-sky" onClick={saveArticle} disabled={savingEdit || contentLoading}>
                {savingEdit ? 'Enregistrement…' : editingArt ? 'Sauvegarder' : 'Brouillon'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!form.title.trim()) { toast('Le titre est obligatoire', 'error'); return; }
                  if (!form.content.trim()) { toast('Le contenu est obligatoire', 'error'); return; }
                  setShowPublishTranslation(true);
                }}
                disabled={!form.title.trim() || !form.content.trim()}
              >
                Publier ({TARGET_LANGUAGES.length + 1} langues)
              </button>
            </div>

            {showPublishTranslation && (
              <PublishWithTranslation
                article={{
                  id: editingArt?.id || `pub-${Date.now()}`,
                  slug: form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                  date: editingArt?.date || new Date().toISOString().split('T')[0],
                  type: form.type,
                  tags: form.tags,
                  author: form.author,
                  pdfUrl: form.pdfUrl,
                  fr: { title: form.title, summary: form.summary, content: form.content },
                  // Traductions saisies dans les onglets EN/ES/DE/IT du formulaire :
                  // pré-remplir la modale (status: 'done') pour qu'elle ne lance pas
                  // d'appel à l'API de traduction et publie directement le contenu.
                  ...Object.fromEntries(
                    TARGET_LANGUAGES
                      .map(l => {
                        const t = form.translations[l.code];
                        if (!(t?.title?.trim() && t?.content?.trim())) return null;
                        return [l.code, { title: t.title, summary: t.summary || '', content: t.content }];
                      })
                      .filter(Boolean)
                  ),
                }}
                onPublished={async (finalArticle) => {
                  // 1. Pousser sur GitHub (version FR)
                  try {
                    const authorNames = form.author || '';
                    const today = new Date().toISOString().split('T')[0];
                    const todayFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    const slug = finalArticle.slug;
                    const pole = (finalArticle.tags || [])[0] || '';
                    const pubType = finalArticle.type || '';

                    const fullHtml = buildPublicationHtml({
                      title: finalArticle.fr.title,
                      authors: authorNames,
                      date: todayFr,
                      pole,
                      type: pubType,
                      summary: finalArticle.fr.summary || '',
                      content: finalArticle.fr.content,
                      slug,
                    });

                    const workerUrl = loadLocal(LS_KEYS.workerUrl, '') || import.meta.env.VITE_WORKER_URL || '';
                    if (workerUrl) {
                      const resp = await fetch(`${workerUrl}/api/github/publish`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          slug,
                          html: fullHtml,
                          metadata: { title: finalArticle.fr.title, authors: authorNames, pole, type: pubType },
                          commitMessage: `Publish: ${finalArticle.fr.title}`,
                        }),
                      });
                      if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || `GitHub : ${resp.status}`);
                      }
                    } else if (hasGitHub()) {
                      // Échappement des champs (cf. AUDIT §4.6).
                      const cardHtml = `
<article class="publication-card" data-tags="${escAttr((finalArticle.tags || []).join(' '))}">
  ${(finalArticle.tags || []).map(t => `<span class="tag">${escAttr(t)}</span>`).join('')}
  <span class="type">${escAttr(pubType)}</span>
  <h3>${escAttr(finalArticle.fr.title)}</h3>
  <p class="meta">${escAttr(authorNames)} — ${escAttr(todayFr)}</p>
  <p>${escAttr(finalArticle.fr.summary || '')}</p>
</article>`;
                      await insertHtmlInPage('publications.html', cardHtml, `Ajout publication : ${finalArticle.fr.title}`);
                    } else {
                      throw new Error('GitHub non configuré — renseigne le token dans Paramètres');
                    }

                    // 1b. Enregistrer la publication dans publications-data.js (liste du site)
                    if (hasGitHub()) {
                      const dateYm = today.slice(0, 7); // YYYY-MM
                      const categories = (finalArticle.tags || []).map(t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                      try {
                        await updatePublicationsData({
                          id: slug,
                          title: finalArticle.fr.title,
                          author: authorNames,
                          authorIds: selectedAuthors,           // Chantier B : relation par ID
                          date: dateYm,
                          type: pubType,
                          categories,
                          color: categoryColor(categories[0]),
                          description: finalArticle.fr.summary || '',
                          image: `assets/img/publications/${slug}-1200.jpg`,
                        });
                      } catch (dataErr) {
                        toast(`Publication OK mais liste non mise à jour : ${dataErr.message}`, 'error');
                      }
                    }

                    // 1c. Mettre à jour publications-i18n.js avec les traductions
                    if (hasGitHub() && (finalArticle.translatedLangs || []).length > 0) {
                      const i18nEntry = {};
                      for (const langCode of finalArticle.translatedLangs) {
                        const t = finalArticle[langCode];
                        if (!t) continue;
                        if (t.title) i18nEntry[`title_${langCode}`] = t.title;
                        if (t.summary) i18nEntry[`description_${langCode}`] = t.summary;
                        if (t.content) i18nEntry[`body_${langCode}`] = t.content;
                      }
                      try {
                        await updatePublicationsI18n(slug, i18nEntry);
                      } catch (i18nErr) {
                        toast(`Publication OK mais traductions non sauvegardées : ${i18nErr.message}`, 'error');
                      }
                    }

                    // 2. Mettre à jour l'état local
                    if (editingArt) {
                      setArticles(prev => prev.map(a => a.id === editingArt.id ? {
                        ...a,
                        ...finalArticle,
                        title: finalArticle.fr.title,
                        summary: finalArticle.fr.summary,
                        content: finalArticle.fr.content,
                        status: 'published',
                        date: today,
                        synced: true,
                      } : a));
                    } else {
                      setArticles(prev => [{
                        ...finalArticle,
                        title: finalArticle.fr.title,
                        summary: finalArticle.fr.summary,
                        content: finalArticle.fr.content,
                        status: 'published',
                        date: today,
                        synced: true,
                      }, ...prev]);
                    }
                    toast('Article publié sur le site');
                    closeForm();
                  } catch (err) {
                    toast(`Erreur publication : ${err.message}`, 'error');
                  }
                }}
                onClose={() => setShowPublishTranslation(false)}
                toast={toast}
              />
            )}
          </Modal>
        )}

        {quickAddOpen && (
          <QuickAddProfileModal
            value={quickAdd}
            onChange={setQuickAdd}
            onSubmit={submitQuickAdd}
            onClose={() => setQuickAddOpen(false)}
            saving={quickAddSaving}
          />
        )}

        {publishFlow && (
          <PublishFlowModal
            publishFlow={publishFlow}
            setPublishFlow={setPublishFlow}
            onClose={closePublishFlow}
            auteurs={auteurs}
            selectedAuthors={selectedAuthors}
            setSelectedAuthors={setSelectedAuthors}
            previewHtml={previewHtml}
            previewLoading={previewLoading}
            publishResult={publishResult}
            publishError={publishError}
            goToStep2={goToStep2}
            executePublish={executePublish}
            onAddNewProfile={() => setQuickAddOpen(true)}
          />
        )}
      </div>
    </>
  );
}
