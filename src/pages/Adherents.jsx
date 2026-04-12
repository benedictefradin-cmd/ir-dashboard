import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import ExportButton from '../components/shared/ExportButton';
import Modal from '../components/shared/Modal';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, formatMoney, calcVariation } from '../utils/formatters';
import { COLORS, ADHERENT_STATUSES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Adherents({ adherents, loading, error, onRefresh, toast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedAdherent, setSelectedAdherent] = useState(null);
  const debouncedSearch = useDebounce(search);

  // ─── Stats ────────────────────────────────────
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const stats = useMemo(() => {
    const actifs = adherents.filter(a => a.status === 'actif' || a.status === 'Pay\u00e9').length;
    const thisMo = adherents.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const lastMo = adherents.filter(a => {
      const d = new Date(a.date);
      const lm = thisMonth === 0 ? 11 : thisMonth - 1;
      const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
      return d.getMonth() === lm && d.getFullYear() === ly;
    }).length;
    const totalAmount = adherents.reduce((s, a) => s + (a.amount || 0), 0);
    const enAttente = adherents.filter(a => a.status === 'en_attente' || a.status === 'En attente').length;
    return { actifs, thisMo, lastMo, totalAmount, enAttente, variation: calcVariation(thisMo, lastMo) };
  }, [adherents, thisMonth, thisYear]);

  // ─── Filtrage ─────────────────────────────────
  const filtered = useMemo(() => {
    let list = adherents;
    if (statusFilter !== 'all') {
      list = list.filter(a => {
        if (statusFilter === 'actif') return a.status === 'actif' || a.status === 'Pay\u00e9';
        if (statusFilter === 'en_attente') return a.status === 'en_attente' || a.status === 'En attente';
        if (statusFilter === 'expire') return a.status === 'expire' || a.status === 'Expir\u00e9';
        return true;
      });
    }
    if (typeFilter !== 'all') {
      list = list.filter(a => a.type === typeFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [adherents, statusFilter, typeFilter, debouncedSearch]);

  // ─── \u00c0 traiter (7 derniers jours) ───────────────
  const recentUnprocessed = useMemo(() => {
    return adherents.filter(a => {
      const d = new Date(a.date);
      return (now - d) / (1000 * 60 * 60 * 24) <= 7;
    }).slice(0, 5);
  }, [adherents]);

  // ─── Colonnes ─────────────────────────────────
  const columns = [
    { key: 'name', label: 'Nom', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span style={{ color: 'var(--text-light)' }}>{v}</span> },
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
    { key: 'amount', label: 'Montant', render: (v) => <span style={{ fontWeight: 600 }}>{formatMoney(v)}</span> },
    { key: 'type', label: 'Type', render: (v) => (
      <span className={`badge ${v === 'Don' ? 'badge-sky' : 'badge-navy'}`}>{v || 'Adh\u00e9sion'}</span>
    )},
    { key: 'status', label: 'Statut', render: (v) => {
      const s = v === 'Pay\u00e9' || v === 'actif' ? 'actif' : v === 'En attente' || v === 'en_attente' ? 'en_attente' : 'expire';
      const cfg = ADHERENT_STATUSES[s] || ADHERENT_STATUSES.actif;
      return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
    }},
    { key: 'source', label: 'Source', render: (v) => <span className="badge badge-gray">{v || 'Manuel'}</span> },
  ];

  const exportColumns = [
    { key: 'name', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'date', label: 'Date d\'adh\u00e9sion' },
    { key: 'amount', label: 'Montant (\u20ac)' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut', exportValue: (r) => {
      if (r.status === 'actif' || r.status === 'Pay\u00e9') return 'Actif';
      if (r.status === 'en_attente' || r.status === 'En attente') return 'En attente';
      return 'Expir\u00e9';
    }},
    { key: 'source', label: 'Source' },
  ];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Adh\u00e9rents</h1></div>
        <div className="page-body"><SkeletonCard count={4} /><SkeletonTable /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Adh\u00e9rents</h1>
          <p className="page-header-sub">Adh\u00e9sions et dons via HelloAsso</p>
        </div>
        <div className="flex-center gap-8">
          <ExportButton data={filtered} columns={exportColumns} sheetName="Adh\u00e9rents" filename="adherents-IR.xlsx" />
          <button className="btn btn-outline" onClick={onRefresh}>Rafra\u00eechir</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert-banner alert-warning">{error}</div>}

        {/* Stats */}
        <div className="grid grid-4 mb-24">
          <StatsCard label="Adh\u00e9rents actifs" value={stats.actifs} accentColor={COLORS.green} sub={`${stats.thisMo} ce mois`} variation={stats.variation} />
          <StatsCard label="Nouvelles adh\u00e9sions" value={stats.thisMo} accentColor={COLORS.sky} sub="Ce mois-ci" />
          <StatsCard label="Montant collect\u00e9" value={`${stats.totalAmount.toLocaleString('fr-FR')}\u00a0\u20ac`} accentColor={COLORS.navy} sub="Adh\u00e9sions + dons" />
          <StatsCard label="En attente" value={stats.enAttente} accentColor={COLORS.ochre} sub="\u00c0 traiter" />
        </div>

        {/* \u00c0 traiter */}
        {recentUnprocessed.length > 0 && (
          <div className="card mb-20">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--navy)' }}>
              Adh\u00e9sions r\u00e9centes (7 derniers jours)
            </h3>
            {recentUnprocessed.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{a.name}</span>
                  <span style={{ color: 'var(--text-light)', fontSize: 12, marginLeft: 8 }}>{a.email}</span>
                  <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 13 }}>{formatMoney(a.amount)}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDateFr(a.date)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un adh\u00e9rent\u2026" />
          <div>
            {[['all', 'Tous'], ['actif', 'Actifs'], ['en_attente', 'En attente'], ['expire', 'Expir\u00e9s']].map(([k, l]) => (
              <span key={k} className={`pill${statusFilter === k ? ' active' : ''}`} onClick={() => setStatusFilter(k)}>{l}</span>
            ))}
          </div>
          <div>
            {[['all', 'Tous types'], ['Adh\u00e9sion', 'Adh\u00e9sions'], ['Don', 'Dons']].map(([k, l]) => (
              <span key={k} className={`pill${typeFilter === k ? ' active' : ''}`} onClick={() => setTypeFilter(k)}>{l}</span>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <DataTable
          columns={columns}
          data={filtered}
          pageSize={20}
          onRowClick={setSelectedAdherent}
          emptyMessage="Aucun adh\u00e9rent trouv\u00e9. Configurez HelloAsso dans les param\u00e8tres."
        />

        {/* Modal d\u00e9tail */}
        {selectedAdherent && (
          <Modal title="Fiche adh\u00e9rent" onClose={() => setSelectedAdherent(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label>Nom</label><p style={{ fontSize: 15, fontWeight: 500 }}>{selectedAdherent.name}</p></div>
              <div><label>Email</label><p style={{ fontSize: 15 }}>{selectedAdherent.email}</p></div>
              <div><label>Date</label><p>{formatDateFr(selectedAdherent.date)}</p></div>
              <div><label>Montant</label><p style={{ fontWeight: 600 }}>{formatMoney(selectedAdherent.amount)}</p></div>
              <div><label>Type</label><p>{selectedAdherent.type || 'Adh\u00e9sion'}</p></div>
              <div><label>Source</label><p>{selectedAdherent.source || 'Manuel'}</p></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(selectedAdherent.email); toast('Email copi\u00e9'); }}>
                Copier l&rsquo;email
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedAdherent(null)}>Fermer</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
