import { useState, useMemo } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { THEMATIQUES, PUB_TYPES, ARTICLE_STATUSES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Articles({ articles, setArticles, loading, toast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note d\'analyse', pdfUrl: '' });
  const [publishingId, setPublishingId] = useState(null);
  const debouncedSearch = useDebounce(search);

  // Filtrage
  const filtered = useMemo(() => {
    let list = articles;
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
  }, [articles, statusFilter, themeFilter, typeFilter, debouncedSearch]);

  const counts = useMemo(() => ({
    total: articles.length,
    draft: articles.filter(a => a.status === 'draft').length,
    review: articles.filter(a => a.status === 'review').length,
    ready: articles.filter(a => a.status === 'ready').length,
    published: articles.filter(a => a.status === 'published').length,
  }), [articles]);

  // Actions
  const updateStatus = (id, newStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    toast(`Publication pass\u00e9e en ${ARTICLE_STATUSES[newStatus]?.label || newStatus}`);
  };

  const publishArticle = async (id) => {
    setPublishingId(id);
    await new Promise(r => setTimeout(r, 1500));
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
    toast('Publication publi\u00e9e');
    setPublishingId(null);
  };

  const deleteArticle = (id) => {
    setArticles(prev => prev.filter(a => a.id !== id));
    toast('Publication supprim\u00e9e');
  };

  const saveArticle = () => {
    if (!form.title) return toast('Le titre est requis', 'error');
    if (editingArt) {
      setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
      toast('Publication mise \u00e0 jour');
    } else {
      const newArt = {
        id: Date.now(),
        ...form,
        status: 'draft',
        date: new Date().toISOString().split('T')[0],
        synced: false,
      };
      setArticles(prev => [newArt, ...prev]);
      toast('Publication cr\u00e9\u00e9e');
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

  // Colonnes
  const columns = [
    { key: 'title', label: 'Titre', render: (v) => <span style={{ fontWeight: 500, maxWidth: 260, display: 'inline-block' }}>{v}</span> },
    { key: 'author', label: 'Auteur' },
    { key: 'tags', label: 'P\u00f4le', render: (v) => (v || []).map(t => <span key={t} className="badge badge-sky" style={{ marginRight: 4 }}>{t}</span>) },
    { key: 'type', label: 'Type', render: (v) => <span className="badge badge-navy">{v}</span> },
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
    { key: 'status', label: 'Statut', render: (v) => {
      const cfg = ARTICLE_STATUSES[v] || ARTICLE_STATUSES.draft;
      return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
    }},
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
        <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>\u00c9diter</button>
        {row.status === 'draft' && (
          <button className="btn btn-ochre btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'review'); }}>Relecture</button>
        )}
        {row.status === 'review' && (
          <button className="btn btn-sky btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'ready'); }}>Valider</button>
        )}
        {row.status === 'ready' && (
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); publishArticle(row.id); }} disabled={publishingId === row.id}>
            {publishingId === row.id ? 'Publication\u2026' : 'Publier'}
          </button>
        )}
        {row.status === 'published' && (
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row.id, 'draft'); }}>D\u00e9publier</button>
        )}
        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); deleteArticle(row.id); }}>Suppr.</button>
      </div>
    )},
  ];

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
            {counts.total} publications \u2014 {counts.published} publi\u00e9es, {counts.draft} brouillons, {counts.review} \u00e0 relire
          </p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="notion" />
          <ServiceBadge service="github" />
          <button className="btn btn-primary" onClick={() => { closeForm(); setShowForm(true); }}>+ Nouvelle publication</button>
        </div>
      </div>

      <div className="page-body">
        {/* Recherche + filtres */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une publication\u2026" />
        </div>

        {/* Filtre par p\u00f4le */}
        <div className="mb-8">
          <span className={`pill${themeFilter === 'all' ? ' active' : ''}`} onClick={() => setThemeFilter('all')}>Tous les p\u00f4les</span>
          {THEMATIQUES.map(t => (
            <span key={t} className={`pill${themeFilter === t ? ' active' : ''}`} onClick={() => setThemeFilter(t)}>{t}</span>
          ))}
        </div>

        {/* Filtre par type */}
        <div className="mb-8">
          <span className={`pill${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>Tous les types</span>
          {PUB_TYPES.map(t => (
            <span key={t} className={`pill${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</span>
          ))}
        </div>

        {/* Filtre par statut */}
        <div className="mb-16">
          {[['all', 'Tous'], ['draft', 'Brouillons'], ['review', '\u00c0 relire'], ['ready', 'Pr\u00eats'], ['published', 'Publi\u00e9s']].map(([k, l]) => (
            <span key={k} className={`pill${statusFilter === k ? ' active' : ''}`} onClick={() => setStatusFilter(k)}>{l}</span>
          ))}
        </div>

        <DataTable columns={columns} data={filtered} pageSize={15} emptyMessage="Aucune publication trouv\u00e9e" />

        {/* Formulaire modal */}
        {showForm && (
          <Modal
            title={editingArt ? 'Modifier la publication' : 'Nouvelle publication'}
            onClose={closeForm}
            size="lg"
          >
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
              <label>P\u00f4les th\u00e9matiques</label>
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
              <label>R\u00e9sum\u00e9</label>
              <textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Contenu</label>
              <textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm}>Annuler</button>
              <button className="btn btn-primary" onClick={saveArticle}>{editingArt ? 'Sauvegarder' : 'Cr\u00e9er'}</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
