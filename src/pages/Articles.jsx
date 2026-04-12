import { useState, useMemo } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { CATEGORIES, ARTICLE_STATUSES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Articles({ articles, setArticles, loading, toast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', category: '\u00c9conomie', content: '' });
  const [publishingId, setPublishingId] = useState(null);
  const debouncedSearch = useDebounce(search);

  // ─── Filtrage ─────────────────────────────────
  const filtered = useMemo(() => {
    let list = articles;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [articles, statusFilter, debouncedSearch]);

  const counts = useMemo(() => ({
    total: articles.length,
    draft: articles.filter(a => a.status === 'draft').length,
    review: articles.filter(a => a.status === 'review').length,
    ready: articles.filter(a => a.status === 'ready').length,
    published: articles.filter(a => a.status === 'published').length,
  }), [articles]);

  // ─── Actions ──────────────────────────────────
  const updateStatus = (id, newStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    toast(`Article pass\u00e9 en ${ARTICLE_STATUSES[newStatus]?.label || newStatus}`);
  };

  const publishArticle = async (id) => {
    setPublishingId(id);
    // Simulation de publication (sera connect\u00e9 au Worker plus tard)
    await new Promise(r => setTimeout(r, 1500));
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
    toast('Article publi\u00e9');
    setPublishingId(null);
  };

  const saveArticle = () => {
    if (!form.title) return toast('Le titre est requis', 'error');
    if (editingArt) {
      setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...form } : a));
      toast('Article mis \u00e0 jour');
    } else {
      const newArt = {
        id: Date.now(),
        ...form,
        status: 'draft',
        date: new Date().toISOString().split('T')[0],
        synced: false,
        source: 'Manuel',
      };
      setArticles(prev => [newArt, ...prev]);
      toast('Article cr\u00e9\u00e9');
    }
    closeForm();
  };

  const startEdit = (art) => {
    setEditingArt(art);
    setForm({ title: art.title, author: art.author, category: art.category, content: art.content || '' });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingArt(null);
    setForm({ title: '', author: '', category: '\u00c9conomie', content: '' });
  };

  // ─── Colonnes ─────────────────────────────────
  const columns = [
    { key: 'title', label: 'Titre', render: (v) => <span style={{ fontWeight: 500, maxWidth: 260, display: 'inline-block' }}>{v}</span> },
    { key: 'author', label: 'Auteur' },
    { key: 'category', label: 'Cat\u00e9gorie', render: (v) => <span className="badge badge-sky">{v}</span> },
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
    { key: 'status', label: 'Statut', render: (v) => {
      const cfg = ARTICLE_STATUSES[v] || ARTICLE_STATUSES.draft;
      return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
    }},
    { key: 'synced', label: 'GitHub', render: (v) => (
      <span style={{ fontSize: 12, color: v ? 'var(--green)' : 'var(--text-light)' }}>
        {v ? 'Synchronis\u00e9' : 'Non sync.'}
      </span>
    )},
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
      </div>
    )},
  ];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Articles</h1></div>
        <div className="page-body"><SkeletonTable /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Articles</h1>
          <p className="page-header-sub">
            {counts.total} articles \u2014 {counts.draft} brouillons, {counts.review} \u00e0 relire, {counts.published} publi\u00e9s
          </p>
        </div>
        <button className="btn btn-sky" onClick={() => { closeForm(); setShowForm(true); }}>Nouvel article</button>
      </div>

      <div className="page-body">
        {/* Recherche + filtres */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un article\u2026" />
          <div>
            {[['all', 'Tous'], ['draft', 'Brouillons'], ['review', '\u00c0 relire'], ['ready', 'Pr\u00eats'], ['published', 'Publi\u00e9s']].map(([k, l]) => (
              <span key={k} className={`pill${statusFilter === k ? ' active' : ''}`} onClick={() => setStatusFilter(k)}>{l}</span>
            ))}
          </div>
        </div>

        <DataTable columns={columns} data={filtered} pageSize={15} emptyMessage="Aucun article trouv\u00e9" />

        {/* Formulaire modal */}
        {showForm && (
          <Modal
            title={editingArt ? 'Modifier l\u2019article' : 'Nouvel article'}
            onClose={closeForm}
            size="lg"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Titre</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label>Auteur</label>
                <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
              </div>
              <div>
                <label>Cat\u00e9gorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Contenu</label>
              <textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm}>Annuler</button>
              <button className="btn btn-sky" onClick={saveArticle}>{editingArt ? 'Sauvegarder' : 'Cr\u00e9er'}</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
