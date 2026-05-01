import { useState, useMemo } from 'react';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, escapeHtml as escAttr } from '../utils/formatters';
import { COLORS, PRESSE_TYPES } from '../utils/constants';
import { hasGitHub, insertHtmlInPage, formatDateSite } from '../services/github';
import useDebounce from '../hooks/useDebounce';
import { useConfirm } from '../components/shared/ConfirmDialog';
import { humanizeError } from '../utils/errors';
import ResultsCount from '../components/shared/ResultsCount';

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

export default function Presse({ presse, setPresse, sollicitations = [], loading, toast, saveToSite }) {
  const confirm = useConfirm();
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
    if (!form.auteur) return toast('L’auteur est requis', 'error');
    if (!form.media) return toast('Le média est requis', 'error');

    if (editingItem) {
      setPresse(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...form } : p));
      toast('Entrée presse mise à jour');
    } else {
      const newItem = {
        id: Date.now(),
        ...form,
        date: form.date || new Date().toISOString().split('T')[0],
      };
      setPresse(prev => [newItem, ...prev]);
      toast('Entrée presse créée');
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

  const deleteItem = async (id) => {
    const item = presse.find(p => p.id === id);
    const ok = await confirm({
      title: 'Supprimer cette entrée presse',
      message: `Voulez-vous vraiment supprimer ${item?.title ? `« ${item.title} »` : 'cette entrée'} ?`,
      details: item?.media ? `Média : ${item.media}` : null,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setPresse(prev => prev.filter(p => p.id !== id));
    toast('Entrée presse supprimée');
  };

  const publishItem = async (item) => {
    setPublishingId(item.id);
    try {
      if (hasGitHub()) {
        // Échappement des champs (cf. AUDIT §4.6) — un titre ou une URL malveillante
        // ne peuvent plus injecter de balises actives sur presse.html.
        const safeUrl = item.urlExterne && /^https?:/i.test(item.urlExterne) ? item.urlExterne : '#';
        const cardHtml = `
<article class="presse-item">
  <span class="media">${escAttr(item.media)}</span>
  <h3><a href="${escAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${escAttr(item.title)}</a></h3>
  <p class="auteur">${escAttr(item.auteur || '')}</p>
  <time>${escAttr(formatDateSite(item.date))}</time>
</article>`;
        await insertHtmlInPage('presse.html', cardHtml, `Ajout presse : ${item.title}`);
        toast('Article presse publié sur le site');
      } else {
        await new Promise(r => setTimeout(r, 1500));
        toast('Article presse publié (simulation)');
      }
    } catch (e) {
      toast(humanizeError(e, "La publication n'a pas pu être ajoutée au site"), 'error', {
        action: { label: 'Réessayer', onClick: () => publishItem(item) },
      });
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
      label: 'Média',
      render: (v) => v ? <span className="badge badge-navy">{v}</span> : '—',
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
      ) : '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>Éditer</button>
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); publishItem(row); }} disabled={publishingId === row.id}>
            {publishingId === row.id ? '…' : 'Publier'}
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
            {stats.total} entrées — {stats.tribune} tribunes, {stats.entretien} entretiens, {stats.podcast} podcasts
          </p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={() => saveToSite('presse', presse.map(({ id, type, title, auteur, media, date, urlExterne, urlInterne }) => ({ id, type, title, auteur, media, date, url: urlExterne || '', urlInterne: urlInterne || '' })))}>
              Publier tout sur le site
            </button>
          )}
          <button className="btn btn-sky" onClick={() => { closeForm(); setShowForm(true); }}>Ajouter</button>
        </div>
      </div>

      <div className="page-body">
        {/* Recherche + filtres */}
        <div className="filter-bar mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher titre, auteur, média…" />
          <select value={activeTab} onChange={e => setActiveTab(e.target.value)} className="filter-select">
            <option value="Tribunes">Tribunes ({stats.tribune})</option>
            <option value="Entretiens">Entretiens ({stats.entretien})</option>
            <option value="Podcast">Podcast ({stats.podcast})</option>
          </select>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="filter-select">
            <option value="all">Toutes les années</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <ResultsCount
          count={filtered.length}
          total={presse.filter(p => p.type === TAB_TO_TYPE[activeTab]).length}
          itemLabel={activeTab === 'Podcast' ? 'podcast' : activeTab === 'Tribunes' ? 'tribune' : 'entretien'}
          itemLabelPlural={activeTab.toLowerCase()}
          onReset={() => { setSearch(''); setYearFilter('all'); }}
        />

        <DataTable
          columns={columns}
          data={filtered}
          pageSize={15}
          totalCount={presse.length}
          emptyMessage={
            (search || yearFilter !== 'all')
              ? 'Aucune entrée presse ne correspond à vos filtres.'
              : `Aucune entrée pour ${activeTab.toLowerCase()}. Cliquez sur « Ajouter » pour commencer.`
          }
        />

        {/* Demandes de contact presse */}
        {(() => {
          const presseSolls = sollicitations.filter(s => s.subject === 'presse' && s.status !== 'archived');
          if (presseSolls.length === 0) return null;
          return (
            <div className="card mt-16 fade-in">
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Demandes de contact presse ({presseSolls.length})</h3>
              {presseSolls.map((s, i) => (
                <div
                  key={s.id || i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < presseSolls.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                    {s.organization && <span style={{ fontSize: 13, color: 'var(--text-light)', marginLeft: 8 }}>{s.organization}</span>}
                    <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.message}
                    </p>
                  </div>
                  <span className={`badge ${s.status === 'new' ? 'badge-sky' : s.status === 'in_progress' ? 'badge-ochre' : 'badge-green'}`}>
                    {s.status === 'new' ? 'Nouveau' : s.status === 'in_progress' ? 'En cours' : 'Résolu'}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Formulaire modal */}
        {showForm && (
          <Modal
            title={editingItem ? 'Modifier l’entrée presse' : 'Nouvelle entrée presse'}
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
                <label>Média source</label>
                <input value={form.media} onChange={e => setForm({ ...form, media: e.target.value })} placeholder="Le Monde, France Inter…" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>URL externe</label>
                <input type="url" value={form.urlExterne} onChange={e => setForm({ ...form, urlExterne: e.target.value })} placeholder="https://…" />
              </div>
              <div>
                <label>URL publication interne (optionnel)</label>
                <input type="url" value={form.urlInterne} onChange={e => setForm({ ...form, urlInterne: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeForm}>Annuler</button>
              <button className="btn btn-sky" onClick={saveItem}>{editingItem ? 'Sauvegarder' : 'Créer'}</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
