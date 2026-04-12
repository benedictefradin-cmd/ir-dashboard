import { useState, useMemo } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { COLORS, PRESSE_TYPES } from '../utils/constants';
import { hasGitHub, insertHtmlInPage, formatDateSite } from '../services/github';
import useDebounce from '../hooks/useDebounce';

const TYPE_BADGE = {
  Tribune: 'badge-sky',
  Entretien: 'badge-green',
  Podcast: 'badge-ochre',
};

const TABS = ['Tribunes', 'Entretiens', 'Podcast'];
const TAB_TO_TYPE = { Tribunes: 'Tribune', Entretiens: 'Entretien', Podcast: 'Podcast' };

const emptyForm = {
  type: 'Tribune',
  title: '',
  auteur: '',
  date: '',
  media: '',
  urlExterne: '',
  urlInterne: '',
};

export default function Presse({ presse, setPresse, loading, toast }) {
  const [activeTab, setActiveTab] = useState('Tribunes');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [publishingId, setPublishingId] = useState(null);
  const debouncedSearch = useDebounce(search);

  // ─── Années disponibles ──────────────────────
  const years = useMemo(() => {
    const set = new Set();
    presse.forEach(p => {
      if (p.date) set.add(p.date.slice(0, 4));
    });
    return [...set].sort((a, b) => b - a);
  }, [presse]);

  // ─── Stats ────────────────────────────────────
  const stats = useMemo(() => ({
    total: presse.length,
    tribune: presse.filter(p => p.type === 'Tribune').length,
    entretien: presse.filter(p => p.type === 'Entretien').length,
    podcast: presse.filter(p => p.type === 'Podcast').length,
  }), [presse]);

  // ─── Filtrage ─────────────────────────────────
  const filtered = useMemo(() => {
    let list = presse.filter(p => p.type === TAB_TO_TYPE[activeTab]);
    if (yearFilter !== 'all') {
      list = list.filter(p => p.date && p.date.startsWith(yearFilter));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.auteur || '').toLowerCase().includes(q) ||
        (p.media || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [presse, activeTab, yearFilter, debouncedSearch]);

  // ─── Actions ──────────────────────────────────
  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm({ ...emptyForm });
  };

  const saveItem = () => {
    if (!form.title) return toast('Le titre est requis', 'error');
    if (!form.auteur) return toast('L\u2019auteur est requis', 'error');
    if (!form.media) return toast('Le m\u00e9dia est requis', 'error');

    if (editingItem) {
      setPresse(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...form } : p));
      toast('Entr\u00e9e presse mise \u00e0 jour');
    } else {
      const newItem = {
        id: Date.now(),
        ...form,
        date: form.date || new Date().toISOString().split('T')[0],
      };
      setPresse(prev => [newItem, ...prev]);
      toast('Entr\u00e9e presse cr\u00e9\u00e9e');
    }
    closeForm();
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setForm({
      type: item.type,
      title: item.title,
      auteur: item.auteur,
      date: item.date || '',
      media: item.media || '',
      urlExterne: item.urlExterne || '',
      urlInterne: item.urlInterne || '',
    });
    setShowForm(true);
  };

  const deleteItem = (id) => {
    setPresse(prev => prev.filter(p => p.id !== id));
    toast('Entr\u00e9e presse supprim\u00e9e');
  };

  const publishItem = async (item) => {
    setPublishingId(item.id);
    try {
      if (hasGitHub()) {
        const cardHtml = `
<article class="presse-item">
  <span class="media">${item.media}</span>
  <h3><a href="${item.urlExterne || '#'}" target="_blank">${item.title}</a></h3>
  <p class="auteur">${item.auteur || ''}</p>
  <time>${formatDateSite(item.date)}</time>
</article>`;
        await insertHtmlInPage('presse.html', cardHtml, `Ajout presse : ${item.title}`);
        toast('Article presse publi\u00e9 sur le site');
      } else {
        await new Promise(r => setTimeout(r, 1500));
        toast('Article presse publi\u00e9 (simulation)');
      }
    } catch (e) {
      toast(e.message || 'Erreur de publication', 'error');
    }
    setPublishingId(null);
  };

  // ─── Colonnes ─────────────────────────────────
  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (v) => <span className={`badge ${TYPE_BADGE[v] || 'badge-sky'}`}>{v}</span>,
    },
    {
      key: 'title',
      label: 'Titre',
      render: (v) => <span style={{ fontWeight: 500, maxWidth: 280, display: 'inline-block' }}>{v}</span>,
    },
    { key: 'auteur', label: 'Auteur(s)' },
    {
      key: 'media',
      label: 'M\u00e9dia',
      render: (v) => v ? <span className="badge badge-navy">{v}</span> : '\u2014',
    },
    {
      key: 'date',
      label: 'Date',
      render: (v) => formatDateFr(v),
    },
    {
      key: 'urlExterne',
      label: 'Lien',
      render: (v) => v ? (
        <a href={v} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()}>
          Voir
        </a>
      ) : '\u2014',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>\u00c9diter</button>
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); publishItem(row); }} disabled={publishingId === row.id}>
            {publishingId === row.id ? '\u2026' : 'Publier'}
          </button>
          <button className="btn btn-outline btn-sm" style={{ color: 'var(--terra)' }} onClick={(e) => { e.stopPropagation(); deleteItem(row.id); }}>Supprimer</button>
        </div>
      ),
    },
  ];

  // ─── Loading ──────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Presse</h1></div>
        <div className="page-body"><SkeletonTable /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Presse</h1>
          <p className="page-header-sub">
            {stats.total} entr\u00e9es \u2014 {stats.tribune} tribunes, {stats.entretien} entretiens, {stats.podcast} podcasts
          </p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          <button className="btn btn-sky" onClick={() => { closeForm(); setShowForm(true); }}>Ajouter</button>
        </div>
      </div>

      <div className="page-body">
        {/* Onglets */}
        <div className="tab-group mb-16">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`tab-item${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Recherche + filtre ann\u00e9e */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher titre, auteur, m\u00e9dia\u2026" />
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="all">Toutes les ann\u00e9es</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={filtered} pageSize={15} emptyMessage="Aucune entr\u00e9e presse trouv\u00e9e" />

        {/* Formulaire modal */}
        {showForm && (
          <Modal
            title={editingItem ? 'Modifier l\u2019entr\u00e9e presse' : 'Nouvelle entr\u00e9e presse'}
            onClose={closeForm}
            size="lg"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {PRESSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Titre</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Auteur(s)</label>
                <input value={form.auteur} onChange={e => setForm({ ...form, auteur: e.target.value })} />
              </div>
              <div>
                <label>M\u00e9dia source</label>
                <input value={form.media} onChange={e => setForm({ ...form, media: e.target.value })} placeholder="Le Monde, France Inter\u2026" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>URL externe</label>
                <input type="url" value={form.urlExterne} onChange={e => setForm({ ...form, urlExterne: e.target.value })} placeholder="https://\u2026" />
              </div>
              <div>
                <label>URL publication interne (optionnel)</label>
                <input type="url" value={form.urlInterne} onChange={e => setForm({ ...form, urlInterne: e.target.value })} placeholder="https://\u2026" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm}>Annuler</button>
              <button className="btn btn-sky" onClick={saveItem}>{editingItem ? 'Sauvegarder' : 'Cr\u00e9er'}</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
