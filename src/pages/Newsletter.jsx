import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import ExportButton from '../components/shared/ExportButton';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { COLORS, SUB_STATUSES, SOURCES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Newsletter({ subscribers, setSubscribers, campaigns, loading, connected, onRefresh, toast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newSub, setNewSub] = useState({ name: '', email: '', source: 'Site web' });
  const [subTab, setSubTab] = useState('contacts'); // contacts | campagnes
  const debouncedSearch = useDebounce(search);

  // ─── Stats ────────────────────────────────────
  const stats = useMemo(() => {
    const total = subscribers.length;
    const now = new Date();
    const thisMo = subscribers.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const added = subscribers.filter(s => s.status === 'added' || s.status === 'abonné').length;
    const pending = subscribers.filter(s => s.status === 'pending').length;
    return { total, thisMo, added, pending };
  }, [subscribers]);

  // ─── Filtrage ─────────────────────────────────
  const filtered = useMemo(() => {
    let list = subscribers;
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [subscribers, statusFilter, debouncedSearch]);

  // ─── Actions ──────────────────────────────────
  const changeStatus = (id, newStatus) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    const labels = { added: 'ajouté', rejected: 'refusé', pending: 'remis en attente' };
    toast(`Contact ${labels[newStatus] || newStatus}`);
  };

  const addSubscriber = () => {
    if (!newSub.name || !newSub.email) return toast('Remplissez tous les champs', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSub.email)) return toast('Email invalide', 'error');
    const entry = {
      id: Date.now(),
      name: newSub.name,
      email: newSub.email,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      source: newSub.source,
    };
    setSubscribers(prev => [entry, ...prev]);
    setNewSub({ name: '', email: '', source: 'Site web' });
    setShowAdd(false);
    toast('Contact ajouté');
  };

  // ─── Colonnes ─────────────────────────────────
  const columns = [
    { key: 'name', label: 'Nom', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span style={{ color: 'var(--text-light)' }}>{v}</span> },
    { key: 'source', label: 'Source', render: (v) => <span className="badge badge-gray">{v}</span> },
    { key: 'date', label: 'Inscription', render: (v) => formatDateFr(v) },
    { key: 'status', label: 'Statut', render: (v) => {
      const cfg = SUB_STATUSES[v] || { label: v, badgeClass: 'badge-gray' };
      return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
    }},
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
        {row.status === 'pending' && <>
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); changeStatus(row.id, 'added'); }}>Ajouter</button>
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); changeStatus(row.id, 'rejected'); }}>Refuser</button>
        </>}
        {row.status === 'added' && (
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); changeStatus(row.id, 'rejected'); }}>Retirer</button>
        )}
        {row.status === 'rejected' && (
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); changeStatus(row.id, 'added'); }}>Réintégrer</button>
        )}
      </div>
    )},
  ];

  const exportColumns = [
    { key: 'name', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'date', label: 'Date d\'inscription' },
    { key: 'status', label: 'Statut', exportValue: (r) => SUB_STATUSES[r.status]?.label || r.status },
    { key: 'source', label: 'Source' },
  ];

  // ─── Colonnes campagnes ───────────────────────
  const campaignColumns = [
    { key: 'name', label: 'Campagne', render: (v) => <span style={{ fontWeight: 500 }}>{v || 'Sans nom'}</span> },
    { key: 'subject', label: 'Objet' },
    { key: 'status', label: 'Statut', render: (v) => {
      const cls = v === 'sent' ? 'badge-green' : v === 'draft' ? 'badge-gray' : 'badge-ochre';
      const lbl = v === 'sent' ? 'Envoyée' : v === 'draft' ? 'Brouillon' : v;
      return <span className={`badge ${cls}`}>{lbl}</span>;
    }},
    { key: 'recipients', label: 'Destinataires' },
    { key: 'openRate', label: 'Ouverture', render: (v) => v != null ? `${v} %` : '—' },
    { key: 'clickRate', label: 'Clics', render: (v) => v != null ? `${v} %` : '—' },
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
  ];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Newsletter</h1></div>
        <div className="page-body"><SkeletonCard count={4} /><SkeletonTable /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Newsletter</h1>
          <p className="page-header-sub">Abonnés et campagnes Brevo</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="brevo" />
          <ExportButton data={filtered} columns={exportColumns} sheetName="Newsletter" filename="newsletter-IR.xlsx" />
          <button className="btn btn-outline" onClick={onRefresh}>Rafraîchir</button>
        </div>
      </div>

      <div className="page-body">
        {/* Bandeau connexion */}
        <div className={`alert-banner ${connected ? 'alert-success' : 'alert-warning'}`}>
          {connected
            ? 'Connecté à Brevo — les données sont synchronisées'
            : 'Mode démonstration — configurez le Worker dans Paramètres pour synchroniser avec Brevo'}
        </div>

        {/* Stats */}
        <div className="grid grid-4 mb-24">
          <StatsCard label="Total abonnés" value={stats.total} accentColor={COLORS.sky} />
          <StatsCard label="Nouveaux ce mois" value={stats.thisMo} accentColor={COLORS.green} />
          <StatsCard label="Validés" value={stats.added} accentColor={COLORS.navy} />
          <StatsCard
            label="En attente"
            value={stats.pending}
            accentColor={COLORS.ochre}
            onClick={() => { setSubTab('contacts'); setStatusFilter('pending'); }}
          />
        </div>

        {/* Bouton nouvelles inscriptions */}
        {stats.pending > 0 && (
          <div className="alert-banner alert-banner-amber mb-16 fade-in">
            <span className="alert-banner-icon"></span>
            <div style={{ flex: 1 }}>
              <strong>{stats.pending} nouvelle{stats.pending > 1 ? 's' : ''} inscription{stats.pending > 1 ? 's' : ''}</strong> en attente de validation
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => { setSubTab('contacts'); setStatusFilter('pending'); }}
            >
              Voir les nouvelles inscriptions
            </button>
          </div>
        )}

        {/* Sous-onglets */}
        <div className="flex-wrap mb-16">
          <span className={`pill${subTab === 'contacts' ? ' active' : ''}`} onClick={() => setSubTab('contacts')}>Contacts</span>
          <span className={`pill${subTab === 'campagnes' ? ' active' : ''}`} onClick={() => setSubTab('campagnes')}>Campagnes</span>
        </div>

        {subTab === 'contacts' && (
          <>
            {/* Recherche + filtres */}
            <div className="flex-wrap mb-16">
              <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un contact…" />
              <div>
                {[['all', 'Tous'], ['pending', 'En attente'], ['added', 'Ajoutés'], ['rejected', 'Refusés']].map(([k, l]) => (
                  <span key={k} className={`pill${statusFilter === k ? ' active' : ''}`} onClick={() => setStatusFilter(k)}>{l}</span>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sky" onClick={() => setShowAdd(!showAdd)}>Ajouter un contact</button>
            </div>

            {/* Formulaire ajout */}
            {showAdd && (
              <div className="card slide-down mb-16" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label>Nom</label>
                  <input value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label>Email</label>
                  <input type="email" value={newSub.email} onChange={e => setNewSub({ ...newSub, email: e.target.value })} />
                </div>
                <div style={{ minWidth: 140 }}>
                  <label>Source</label>
                  <select value={newSub.source} onChange={e => setNewSub({ ...newSub, source: e.target.value })}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Annuler</button>
                <button className="btn btn-sky" onClick={addSubscriber}>Ajouter</button>
              </div>
            )}

            <DataTable
              columns={columns}
              data={filtered}
              pageSize={20}
              emptyMessage="Aucun abonné trouvé"
              footer={
                <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-light)', display: 'flex', gap: 16 }}>
                  <span>Ajoutés : <strong style={{ color: 'var(--green)' }}>{stats.added}</strong></span>
                  <span>En attente : <strong style={{ color: 'var(--ochre)' }}>{stats.pending}</strong></span>
                  <span>Total : <strong style={{ color: 'var(--navy)' }}>{stats.total}</strong></span>
                </div>
              }
            />
          </>
        )}

        {subTab === 'campagnes' && (
          <DataTable
            columns={campaignColumns}
            data={campaigns || []}
            pageSize={10}
            emptyMessage="Aucune campagne. Les campagnes Brevo apparaîtront ici une fois le Worker connecté."
          />
        )}
      </div>
    </>
  );
}
