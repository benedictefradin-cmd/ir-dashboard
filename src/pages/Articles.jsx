import { useState, useMemo, useCallback } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import AuthorPicker from '../components/shared/AuthorPicker';
import MultiSelect from '../components/shared/MultiSelect';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo } from '../utils/formatters';
import { THEMATIQUES, PUB_TYPES, ARTICLE_STATUSES, COLORS, SITE_URL, TARGET_LANGUAGES, LS_KEYS } from '../utils/constants';
import { hasGitHub, insertHtmlInPage, formatDateSite, updatePublicationsI18n, updatePublicationsData, categoryColor } from '../services/github';
import { fetchPublicationContent } from '../services/siteData';
import { loadLocal } from '../utils/localStorage';
import useDebounce from '../hooks/useDebounce';
import ARTICLE_TEMPLATES from '../data/articleTemplates';
import PublishWithTranslation from '../components/articles/PublishWithTranslation';
import RichEditor from '../components/editor/RichEditor';
import useDraftAutosave from '../hooks/useDraftAutosave';
import useUnsavedGuard from '../hooks/useUnsavedGuard';

export default function Articles({
  articles, setArticles, loading, toast,
  auteurs = [],
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [themeFilter, setThemeFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '', scheduledDate: '' });

  // Auto-save du brouillon dans localStorage (debounce 3s) + alerte beforeunload.
  const draftKey = editingArt?.id ? `article-${editingArt.id}` : 'article-new';
  const { existingDraft, restore: restoreDraft, clear: clearDraft, dismissDraft } =
    useDraftAutosave(draftKey, form, { enabled: showForm });
  const { markSaved } = useUnsavedGuard(showForm ? form : null);
  const [publishingId, setPublishingId] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const debouncedSearch = useDebounce(search);

  // ─── Publish flow state ───────────────────────
  const [publishFlow, setPublishFlow] = useState(null); // { article, step: 1|2|3 }
  const [showPublishTranslation, setShowPublishTranslation] = useState(false);
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Source unique : les publications du repo site (data/publications.json),
  // chargées par App.jsx via siteData.fetchAllSiteData() et passées en props.
  const allArticles = articles;

  // Filtrage
  const filtered = useMemo(() => {
    let list = allArticles;
    if (statusFilter.length) list = list.filter(a => statusFilter.includes(a.status));
    if (themeFilter.length) list = list.filter(a => (a.tags || []).some(t => themeFilter.includes(t)));
    if (typeFilter.length) list = list.filter(a => typeFilter.includes(a.type));
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allArticles, statusFilter, themeFilter, typeFilter, debouncedSearch]);

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
    setSelectedAuthors([]);
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
        // Fallback : insertion legacy dans publications.html via Worker
        const cardHtml = `
<article class="publication-card" data-tags="${(article.tags || []).join(' ')}">
  ${(article.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
  <span class="type">${pubType}</span>
  <h3>${article.title}</h3>
  <p class="meta">${authorNames} — ${todayFr}</p>
  <p>${article.summary || ''}</p>
</article>`;
        await insertHtmlInPage('publications.html', cardHtml, `Ajout publication : ${article.title}`);
      }

      // 5. Update local state (la source de vérité reste data/publications.json
      //    du repo site ; le rechargement est piloté par App.jsx).
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, status: 'published', synced: true, date: today, author: authorNames } : a
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
        const cardHtml = `
<article class="publication-card" data-tags="${(pub.tags || []).join(' ')}">
  ${(pub.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
  <span class="type">${pub.type}</span>
  <h3>${pub.title}</h3>
  <p class="meta">${pub.author} — ${formatDateSite(pub.date)}</p>
  <p>${pub.summary || ''}</p>${pub.pdfUrl ? `\n  <a href="${pub.pdfUrl}" target="_blank">Lire le PDF</a>` : ''}
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
      toast(e.message || 'Erreur de publication', 'error');
    }
    setPublishingId(null);
  };

  const deleteArticle = (id) => {
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
      date: dateFr,
      pole,
      type: formData.type,
      summary: formData.summary || '',
      content: formData.content,
      slug,
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
      const categories = (formData.tags || []).map(t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      await updatePublicationsData({
        id: slug,
        title: formData.title,
        author: formData.author,
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
      setSavingEdit(true);
      try {
        await pushArticleToSite(editingArt, form);
        setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
        toast('Publication mise à jour sur le site');
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
    setEditingArt(art);
    setForm({
      title: art.title, author: art.author, tags: [...(art.tags || [])],
      summary: art.summary || '', content: art.content || '',
      type: art.type || 'Note d\'analyse', pdfUrl: art.pdfUrl || '',
      scheduledDate: art.scheduledDate || '',
    });
    setShowForm(true);

    // Article du site sans contenu en mémoire → on récupère le HTML
    // depuis publications/{slug}.html et on le charge dans l'éditeur.
    if (art.slug && !art.content && hasGitHub()) {
      setContentLoading(true);
      try {
        const { content } = await fetchPublicationContent(art.slug);
        setForm(f => ({ ...f, content }));
        // Cache dans la liste pour éviter un nouveau fetch si on rouvre l'article.
        setArticles(prev => prev.map(a => a.id === art.id ? { ...a, content } : a));
      } catch (err) {
        toast(`Impossible de charger le contenu : ${err.message}`, 'error');
      } finally {
        setContentLoading(false);
      }
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setShowPublishTranslation(false);
    setEditingArt(null);
    setForm({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '', scheduledDate: '' });
  };

  // ─── Colonnes tableau ─────────────────────────
  const columns = [
    {
      key: 'status', label: 'Statut', render: (v) => {
        const cfg = ARTICLE_STATUSES[v] || ARTICLE_STATUSES.draft;
        return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
      }
    },
    { key: 'title', label: 'Titre', render: (v) => <span style={{ fontWeight: 500, maxWidth: 280, display: 'inline-block' }}>{v}</span> },
    { key: 'author', label: 'Auteur(s)' },
    { key: 'tags', label: 'Pôle', render: (v) => (v || []).map(t => <span key={t} className="badge badge-sky" style={{ marginRight: 4 }}>{t}</span>) },
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
          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); deleteArticle(row.id); }}>Suppr.</button>
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
            options={THEMATIQUES.map(t => ({ value: t, label: t }))}
          />
          <select className="filter-select" value={typeFilter[0] || ''} onChange={e => setTypeFilter(e.target.value ? [e.target.value] : [])}>
            <option value="">Tous les types</option>
            {PUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(statusFilter.length > 0 || themeFilter.length > 0 || typeFilter.length > 0) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setStatusFilter([]); setThemeFilter([]); setTypeFilter([]); }}
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
                <button type="button" onClick={() => setStatusFilter(statusFilter.filter(x => x !== v))}>×</button>
              </span>
            ))}
            {themeFilter.map(v => (
              <span key={`t-${v}`} className="filter-tag">
                {v}
                <button type="button" onClick={() => setThemeFilter(themeFilter.filter(x => x !== v))}>×</button>
              </span>
            ))}
            {typeFilter.map(v => (
              <span key={`y-${v}`} className="filter-tag">
                {v}
                <button type="button" onClick={() => setTypeFilter(typeFilter.filter(x => x !== v))}>×</button>
              </span>
            ))}
          </div>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          pageSize={15}
          totalCount={allArticles.length}
          emptyMessage="Aucune publication trouvée"
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Titre</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label>Auteur</label>
                <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Pôles thématiques</label>
              <div className="flex-wrap gap-8" style={{ marginTop: 4 }}>
                {THEMATIQUES.map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: form.tags.includes(t) ? 'var(--sky-light)' : '#F9FAFB', border: `1px solid ${form.tags.includes(t) ? 'var(--sky)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={form.tags.includes(t)} onChange={() => {
                      setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }));
                    }} style={{ width: 'auto', marginRight: 4 }} />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Type</label>
                <select value={form.type} onChange={e => {
                  const newType = e.target.value;
                  setForm(f => ({ ...f, type: newType }));
                  // Si article nouveau et contenu vide, proposer la trame
                  if (!editingArt && !form.content && ARTICLE_TEMPLATES[newType]) {
                    if (window.confirm(`Charger la trame "${newType}" dans l'éditeur ?`)) {
                      setForm(f => ({ ...f, type: newType, content: ARTICLE_TEMPLATES[newType].skeleton }));
                    }
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

            {/* Guide de rédaction + bouton trame */}
            {ARTICLE_TEMPLATES[form.type]?.guide && (
              <div style={{ marginBottom: 16 }}>
                <label>Guide de rédaction</label>
                <div className="template-guide">
                  {ARTICLE_TEMPLATES[form.type].guide.map((g, i) => (
                    <div key={i} className="template-guide-item">
                      <div className="template-guide-section">{g.section}</div>
                      <div className="template-guide-hint">{g.hint}</div>
                    </div>
                  ))}
                </div>
                {ARTICLE_TEMPLATES[form.type] && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => {
                      if (!form.content || window.confirm('Remplacer le contenu actuel par la trame ?')) {
                        setForm(f => ({ ...f, content: ARTICLE_TEMPLATES[f.type].skeleton }));
                      }
                    }}
                  >
                    📋 Charger la trame
                  </button>
                )}
              </div>
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
              <label>Résumé</label>
              <textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Contenu</label>
              {contentLoading && (
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
                  Chargement de l'article depuis le site…
                </div>
              )}
              <RichEditor
                value={form.content}
                onChange={(html) => setForm(f => ({ ...f, content: html }))}
                title={form.title}
                author={form.author}
                placeholder={contentLoading ? 'Chargement…' : 'Écrivez votre article ici…'}
                slug={editingArt?.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
                toast={toast}
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
                      const cardHtml = `
<article class="publication-card" data-tags="${(finalArticle.tags || []).join(' ')}">
  ${(finalArticle.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
  <span class="type">${pubType}</span>
  <h3>${finalArticle.fr.title}</h3>
  <p class="meta">${authorNames} — ${todayFr}</p>
  <p>${finalArticle.fr.summary || ''}</p>
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

        {/* ══ PUBLISH FLOW MODAL ═══════════════════ */}
        {publishFlow && (
          <Modal
            title={
              publishFlow.step === 1 ? 'Publier — Étape 1/3 : Sélection du profil' :
              publishFlow.step === 2 ? 'Publier — Étape 2/3 : Prévisualisation' :
              'Publier — Étape 3/3 : Confirmation'
            }
            onClose={closePublishFlow}
            size="lg"
          >
            {/* Stepper */}
            <div className="publish-stepper mb-20">
              {[1, 2, 3].map(s => (
                <div key={s} className={`publish-step${publishFlow.step === s ? ' active' : ''}${publishFlow.step > s ? ' done' : ''}`}>
                  <span className="publish-step-num">{publishFlow.step > s ? '✓' : s}</span>
                  <span className="publish-step-label">
                    {s === 1 ? 'Profil' : s === 2 ? 'Prévisualisation' : 'Publication'}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Step 1: Author selection ─────── */}
            {publishFlow.step === 1 && (
              <div>
                <p style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 16 }}>
                  Sélectionnez le ou les profil(s) auteur de « <strong>{publishFlow.article.title}</strong> »
                </p>
                <AuthorPicker
                  authors={auteurs}
                  selected={selectedAuthors}
                  onChange={setSelectedAuthors}
                  multiple={true}
                  onAddNew={() => toast('Utilisez la page Profils pour ajouter un profil')}
                />
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closePublishFlow}>Annuler</button>
                  <button
                    className="btn btn-primary"
                    disabled={selectedAuthors.length === 0}
                    onClick={goToStep2}
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Preview ─────────────── */}
            {publishFlow.step === 2 && (
              <div>
                {/* Metadata */}
                <div className="publish-preview-meta mb-16">
                  <div className="flex-wrap gap-8 mb-8">
                    {selectedAuthors.map(id => {
                      const a = auteurs.find(au => au.id === id);
                      if (!a) return null;
                      return (
                        <span key={id} className="author-chip">
                          {a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex-wrap gap-8">
                    {publishFlow.article.tags?.map(t => <span key={t} className="badge badge-sky">{t}</span>)}
                    {publishFlow.article.type && <span className="badge badge-navy">{publishFlow.article.type}</span>}
                    {publishFlow.article.mediaSource && <span className="badge badge-ochre">{publishFlow.article.mediaSource}</span>}
                  </div>
                </div>

                {/* Content preview */}
                <div className="publish-preview-content">
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, marginBottom: 12, color: COLORS.navy }}>
                    {publishFlow.article.title}
                  </h2>
                  {previewLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: COLORS.textLight }}>Chargement du contenu…</div>
                  ) : (
                    <div className="notion-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  )}
                </div>

                {/* Service badges */}
                <div className="flex-wrap gap-8 mt-16 mb-8">
                  
                  <ServiceBadge service="github" />
                  <ServiceBadge service="vercel" />
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setPublishFlow(prev => ({ ...prev, step: 1 }))}>← Retour</button>
                  <button className="btn btn-outline" onClick={closePublishFlow}>Annuler</button>
                  <button className="btn btn-primary" onClick={executePublish}>
                    Publier sur le site
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Confirmation ────────── */}
            {publishFlow.step === 3 && (
              <div>
                {!publishResult && !publishError && (
                  <div style={{ textAlign: 'center', padding: 48 }}>
                    <div className="publish-spinner" />
                    <p style={{ marginTop: 16, color: COLORS.textLight }}>Publication en cours…</p>
                  </div>
                )}

                {publishResult && (
                  <div className="publish-success slide-up">
                    <div className="publish-success-icon">&#10003;</div>
                    <h3>Article publié avec succès</h3>
                    <div className="publish-success-details">
                      <div><strong>Titre :</strong> {publishResult.title}</div>
                      <div><strong>Auteur(s) :</strong> {publishResult.authors}</div>
                      <div><strong>Date :</strong> {publishResult.date}</div>
                      <div><strong>Slug :</strong> {publishResult.slug}</div>
                      {publishResult.sha && <div><strong>Commit :</strong> <code>{publishResult.sha.slice(0, 7)}</code></div>}
                      <div className="flex-wrap gap-8 mt-8">
                        <span className="badge badge-green">Notion : Publié</span>
                        <span className="badge badge-green">GitHub : Commité</span>
                      </div>
                    </div>
                    <div className="modal-footer">
                      {publishResult.siteUrl && (
                        <a href={publishResult.siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                          Voir sur le site ↗
                        </a>
                      )}
                      <button className="btn btn-outline" onClick={closePublishFlow}>Fermer</button>
                    </div>
                  </div>
                )}

                {publishError && (
                  <div className="publish-error slide-up">
                    <div className="publish-error-icon">&#10007;</div>
                    <h3>Erreur lors de la publication</h3>
                    <p style={{ color: COLORS.danger, marginBottom: 16 }}>{publishError}</p>
                    <div className="modal-footer">
                      <button className="btn btn-primary" onClick={executePublish}>Réessayer</button>
                      <button className="btn btn-outline" onClick={closePublishFlow}>Fermer</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>
        )}
      </div>
    </>
  );
}

// ─── HTML Template builder ──────────────────────────
// Slugifie une étiquette pour générer une classe CSS (ex: "Économie" → "economie").
function slugifyTag(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Mappe un type ("Note d'analyse", "Essai", …) vers le suffixe de classe utilisé par le site.
function typeBadgeSuffix(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('note')) return 'note';
  if (t.includes('essai')) return 'essai';
  if (t.includes('tribune')) return 'tribune';
  if (t.includes('rapport')) return 'rapport';
  if (t.includes('entretien') || t.includes('interview')) return 'entretien';
  return slugifyTag(type);
}

// Calcule les initiales (max 2) d'une chaîne d'auteurs.
function authorInitials(authors) {
  const first = (authors || '').split(',')[0].trim();
  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Échappe les attributs HTML.
function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPublicationHtml({ title, authors, date, pole, type, summary, content, slug }) {
  const tagsArr = Array.isArray(pole) ? pole : (pole ? [pole] : []);
  const typeSuffix = typeBadgeSuffix(type);
  const initials = authorInitials(authors);
  const canonical = `https://institut-rousseau.fr/publications/${slug}`;
  const shareUrl = encodeURIComponent(canonical);
  const shareTitle = encodeURIComponent(`${title} — Institut Rousseau`);
  const descEsc = escAttr(summary);
  const titleEsc = escAttr(title);

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
  "datePublished": ${JSON.stringify(date)},
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
      ${authors ? `<div class="article-author-block">
        <div class="article-author-avatar" style="background:linear-gradient(135deg,#2D6A4F,#aaa)">${escAttr(initials)}</div>
        <div class="article-author-info">
          <div class="article-author-name">${escAttr(authors)}</div>
        </div>
      </div>` : ''}

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
</body>
</html>`;
}
