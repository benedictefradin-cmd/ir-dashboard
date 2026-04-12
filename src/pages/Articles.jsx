import { useState, useMemo, useCallback } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import AuthorPicker from '../components/shared/AuthorPicker';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo } from '../utils/formatters';
import { THEMATIQUES, PUB_TYPES, ARTICLE_STATUSES, COLORS, SITE_URL } from '../utils/constants';
import { hasGitHub, insertHtmlInPage, formatDateSite } from '../services/github';
import { fetchArticleContent, updateArticleStatus, hasNotion } from '../services/notion';
import { loadLocal } from '../utils/localStorage';
import useDebounce from '../hooks/useDebounce';

// ─── Notion status mapping ─────────────────────────
const NOTION_STATUS_MAP = {
  'idée': 'draft', 'idee': 'draft',
  'en rédaction': 'draft', 'en redaction': 'draft',
  'prêt à relire': 'review', 'pret a relire': 'review',
  'prêt à publier': 'ready', 'pret a publier': 'ready',
  'publié': 'published', 'publie': 'published',
  'archivé': 'archived', 'archive': 'archived',
};

function mapNotionStatus(notionStatus) {
  return NOTION_STATUS_MAP[(notionStatus || '').toLowerCase()] || 'draft';
}

function isReadyToPublish(article) {
  const s = (article.status || '').toLowerCase();
  return s === 'prêt à publier' || s === 'pret a publier' || s === 'ready';
}

export default function Articles({
  articles, setArticles, loading, toast,
  notionArticles = [], notionCounts = {}, notionLoading, syncNotion, notionConfigured,
  auteurs = [],
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '' });
  const [publishingId, setPublishingId] = useState(null);
  const debouncedSearch = useDebounce(search);

  // ─── Publish flow state ───────────────────────
  const [publishFlow, setPublishFlow] = useState(null); // { article, step: 1|2|3 }
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Merge local + Notion articles
  const allArticles = useMemo(() => {
    if (!notionConfigured || notionArticles.length === 0) return articles;

    const notionMapped = notionArticles.map(na => ({
      id: na.id,
      title: na.title,
      author: na.authors,
      tags: na.pole ? [na.pole] : [],
      type: na.type || 'Note d\'analyse',
      date: na.publishDate || na.lastEdited?.split('T')[0] || '',
      summary: na.summary,
      slug: na.slug,
      status: mapNotionStatus(na.status),
      notionStatus: na.status,
      featured: na.featured,
      mediaSource: na.mediaSource,
      externalUrl: na.externalUrl,
      lastEdited: na.lastEdited,
      isNotion: true,
      synced: na.status?.toLowerCase().includes('publié'),
    }));

    // Prefer Notion articles, keep local-only articles
    const notionIds = new Set(notionMapped.map(a => a.id));
    const localOnly = articles.filter(a => !notionIds.has(a.id));
    return [...notionMapped, ...localOnly];
  }, [articles, notionArticles, notionConfigured]);

  // Filtrage
  const filtered = useMemo(() => {
    let list = allArticles;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (themeFilter !== 'all') list = list.filter(a => (a.tags || []).includes(themeFilter));
    if (typeFilter !== 'all') list = list.filter(a => a.type === typeFilter);
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

  // Send back to draft in Notion
  const sendBackToDraft = async (article) => {
    if (article.isNotion) {
      try {
        await updateArticleStatus(article.id, 'En rédaction');
        toast('Article renvoyé en rédaction');
        syncNotion?.();
      } catch (e) {
        toast(e.message || 'Erreur', 'error');
      }
    } else {
      updateStatus(article.id, 'draft');
    }
  };

  // ─── Publish flow ─────────────────────────────
  const startPublishFlow = (article) => {
    setPublishFlow({ article, step: 1 });
    setSelectedAuthors([]);
    setPreviewHtml('');
    setPublishResult(null);
    setPublishError(null);
  };

  const goToStep2 = async () => {
    setPublishFlow(prev => ({ ...prev, step: 2 }));
    setPreviewLoading(true);
    try {
      if (publishFlow.article.isNotion) {
        const { html } = await fetchArticleContent(publishFlow.article.id);
        setPreviewHtml(html);
      } else {
        setPreviewHtml(publishFlow.article.content || '<p>Aucun contenu disponible.</p>');
      }
    } catch (e) {
      setPreviewHtml(`<p style="color: red;">Erreur : ${e.message}</p>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const executePublish = async () => {
    setPublishFlow(prev => ({ ...prev, step: 3 }));
    setPublishError(null);
    const article = publishFlow.article;

    try {
      // 1. Get content
      let html = previewHtml;
      if (!html && article.isNotion) {
        const resp = await fetchArticleContent(article.id);
        html = resp.html;
      }

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

      // 4. Push to GitHub via Worker
      const workerUrl = loadLocal('ir_worker_url', '') || loadLocal('worker-url', '') || import.meta.env.VITE_WORKER_URL || '';
      const githubToken = loadLocal('ir_github_token', '');
      const githubOwner = loadLocal('ir_github_owner', '');
      const githubRepo = loadLocal('ir_github_site_repo', '');

      let commitSha = null;
      if (githubToken && githubOwner && githubRepo && workerUrl) {
        const resp = await fetch(`${workerUrl}/api/github/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Token': githubToken,
            'X-GitHub-Owner': githubOwner,
            'X-GitHub-Repo': githubRepo,
          },
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
        // Fallback to direct GitHub API
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

      // 5. Update Notion status
      if (article.isNotion) {
        await updateArticleStatus(article.id, 'Publié', today, authorNames);
      }

      // 6. Update local state
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

      syncNotion?.();
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

  const saveArticle = () => {
    if (!form.title) return toast('Le titre est requis', 'error');
    if (editingArt) {
      setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
      toast('Publication mise à jour');
    } else {
      const newArt = {
        id: Date.now(),
        ...form,
        status: 'draft',
        date: new Date().toISOString().split('T')[0],
        synced: false,
      };
      setArticles(prev => [newArt, ...prev]);
      toast('Publication créée');
    }
    closeForm();
  };

  const startEdit = (art) => {
    setEditingArt(art);
    setForm({
      title: art.title, author: art.author, tags: [...(art.tags || [])],
      summary: art.summary || '', content: art.content || '',
      type: art.type || 'Note d\'analyse', pdfUrl: art.pdfUrl || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingArt(null);
    setForm({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '' });
  };

  // ─── Colonnes tableau ─────────────────────────
  const columns = [
    {
      key: 'status', label: 'Statut', render: (v, row) => {
        const cfg = ARTICLE_STATUSES[v] || ARTICLE_STATUSES.draft;
        return (
          <span className={`badge ${cfg.badgeClass}`}>
            {row.isNotion ? (row.notionStatus || cfg.label) : cfg.label}
          </span>
        );
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
          {!row.isNotion && (
            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>Éditer</button>
          )}
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
          {row.status === 'draft' && !row.isNotion && (
            <button className="btn btn-ochre btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'review'); }}>Relecture</button>
          )}
          {row.status === 'review' && !row.isNotion && (
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
          {row.status === 'published' && !row.isNotion && (
            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'draft'); }}>Dépublier</button>
          )}
          {!row.isNotion && (
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); deleteArticle(row.id); }}>Suppr.</button>
          )}
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

  if (loading && !notionConfigured) {
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
          <ServiceBadge service="notion" />
          <ServiceBadge service="github" />
          {notionConfigured && (
            <button className="btn btn-outline" onClick={syncNotion} disabled={notionLoading}>
              {notionLoading ? 'Sync…' : '↻ Sync Notion'}
            </button>
          )}
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
          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Tous les statuts ({counts.total})</option>
            <option value="draft">Brouillons ({counts.draft})</option>
            <option value="review">À relire ({counts.review})</option>
            <option value="ready">Prêts à publier ({counts.ready})</option>
            <option value="published">Publiés ({counts.published})</option>
            <option value="archived">Archivés ({counts.archived})</option>
          </select>
          <select
            className="filter-select"
            value={themeFilter}
            onChange={e => setThemeFilter(e.target.value)}
          >
            <option value="all">Tous les pôles</option>
            {THEMATIQUES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            className="filter-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">Tous les types</option>
            {PUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(statusFilter !== 'all' || themeFilter !== 'all' || typeFilter !== 'all') && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setStatusFilter('all'); setThemeFilter('all'); setTypeFilter('all'); }}
            >
              Effacer filtres
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          pageSize={15}
          emptyMessage="Aucune publication trouvée"
          rowClassName={rowClassName}
        />

        {/* ── Formulaire local ──────────────────── */}
        {showForm && (
          <Modal title={editingArt ? 'Modifier la publication' : 'Nouvelle publication'} onClose={closeForm} size="lg">
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
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {PUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Lien PDF (optionnel)</label>
                <input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Résumé</label>
              <textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Contenu</label>
              <textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm}>Annuler</button>
              <button className="btn btn-primary" onClick={saveArticle}>{editingArt ? 'Sauvegarder' : 'Créer'}</button>
            </div>
          </Modal>
        )}

        {/* ══ PUBLISH FLOW MODAL ═══════════════════ */}
        {publishFlow && (
          <Modal
            title={
              publishFlow.step === 1 ? 'Publier — Étape 1/3 : Sélection de l\u2019auteur' :
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
                    {s === 1 ? 'Auteur' : s === 2 ? 'Prévisualisation' : 'Publication'}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Step 1: Author selection ─────── */}
            {publishFlow.step === 1 && (
              <div>
                <p style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 16 }}>
                  Sélectionnez le ou les auteur(s) de « <strong>{publishFlow.article.title}</strong> »
                </p>
                <AuthorPicker
                  authors={auteurs}
                  selected={selectedAuthors}
                  onChange={setSelectedAuthors}
                  multiple={true}
                  onAddNew={() => toast('Utilisez la page Auteurs pour ajouter un auteur')}
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
                  <ServiceBadge service="notion" />
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
function buildPublicationHtml({ title, authors, date, pole, type, summary, content, slug }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Institut Rousseau</title>
  <meta name="description" content="${summary.replace(/"/g, '&quot;')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+3:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root { --navy: #1a2744; --sky: #4a90d9; --cream: #f7f4ee; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Source Sans 3', sans-serif; color: var(--navy); background: var(--cream); line-height: 1.7; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 24px; }
    header { background: var(--navy); color: white; padding: 16px 0; }
    header .container { display: flex; justify-content: space-between; align-items: center; }
    header a { color: white; text-decoration: none; font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; }
    nav a { color: rgba(255,255,255,0.8); text-decoration: none; margin-left: 24px; font-size: 15px; }
    nav a:hover { color: white; }
    .breadcrumb { padding: 12px 0; font-size: 14px; color: #6B7280; }
    .breadcrumb a { color: var(--sky); text-decoration: none; }
    article { background: white; border-radius: 12px; padding: 48px; margin: 24px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    article h1 { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E5E7EB; }
    .meta .tag { background: #EBF4FF; color: var(--sky); padding: 2px 10px; border-radius: 4px; font-size: 13px; }
    .meta .author { font-weight: 600; }
    .meta .date { color: #6B7280; font-size: 14px; }
    .content h2 { font-family: 'Cormorant Garamond', serif; font-size: 24px; margin: 32px 0 12px; }
    .content h3 { font-size: 20px; margin: 24px 0 8px; }
    .content p { margin-bottom: 16px; }
    .content ul, .content ol { margin: 0 0 16px 24px; }
    .content li { margin-bottom: 4px; }
    .content blockquote { border-left: 3px solid var(--sky); padding: 12px 20px; margin: 20px 0; background: #f8f9fa; font-style: italic; }
    .content figure { margin: 24px 0; text-align: center; }
    .content figure img { max-width: 100%; border-radius: 8px; }
    .content figcaption { font-size: 13px; color: #6B7280; margin-top: 8px; }
    footer { text-align: center; padding: 32px 0; font-size: 14px; color: #6B7280; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="/">Institut Rousseau</a>
      <nav>
        <a href="/publications.html">Publications</a>
        <a href="/evenements.html">Événements</a>
        <a href="/contact.html">Contact</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <div class="breadcrumb">
      <a href="/">Accueil</a> / <a href="/publications.html">Publications</a> / ${title}
    </div>
    <article>
      <h1>${title}</h1>
      <div class="meta">
        ${pole ? `<span class="tag">${pole}</span>` : ''}
        ${type ? `<span class="tag">${type}</span>` : ''}
        <span class="author">${authors}</span>
        <span class="date">${date}</span>
      </div>
      <div class="content">
        ${content}
      </div>
    </article>
  </main>
  <footer>
    <div class="container">
      <p>&copy; Institut Rousseau ${new Date().getFullYear()} — <a href="https://institut-rousseau.fr" style="color: var(--sky);">institut-rousseau.fr</a></p>
    </div>
  </footer>
</body>
</html>`;
}
