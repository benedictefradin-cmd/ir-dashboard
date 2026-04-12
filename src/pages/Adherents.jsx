import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import ExportButton from '../components/shared/ExportButton';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, formatMoney, calcVariation } from '../utils/formatters';
import { COLORS, ADHERENT_STATUSES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Adherents({ adherents, loading, error, onRefresh, toast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formuleFilter, setFormuleFilter] = useState('all');
  const [selectedAdherent, setSelectedAdherent] = useState(null);
  const debouncedSearch = useDebounce(search);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const stats = useMemo(() => {
    const actifs = adherents.filter(a => a.status === 'actif' || a.status === 'Pay\u00e9').length;
    const expires = adherents.filter(a => a.status === 'expire' || a.status === 'Expir\u00e9').length;
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
    const normal = adherents.filter(a => a.formule === 'normal' || a.amount === 30).length;
    const reduit = adherents.filter(a => a.formule === 'reduit' || a.amount === 10).length;
    const renewalRate = actifs + expires > 0 ? Math.round((actifs / (actifs + expires)) * 100) : 0;
    return { actifs, expires, thisMo, lastMo, normal, reduit, renewalRate, variation: calcVariation(thisMo, lastMo) };
  }, [adherents, thisMonth, thisYear]);

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
    if (formuleFilter !== 'all') {
      list = list.filter(a => {
        if (formuleFilter === 'normal') return a.formule === 'normal' || a.amount === 30;
        if (formuleFilter === 'reduit') return a.formule === 'reduit' || a.amount === 10;
        return true;
      });
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [adherents, statusFilter, formuleFilter, debouncedSearch]);

  // Date d'expiration: 1 an apr\u00e8s la date d'adh\u00e9sion
  const getExpiration = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const columns = [
    { key: 'name', label: 'Nom', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span style={{ color: 'var(--text-light)', fontSize: 13 }}>{v}</span> },
    { key: 'date', label: 'Adh\u00e9sion', render: (v) => formatDateFr(v) },
    { key: 'expiration', label: 'Expiration', render: (_, row) => {
      const exp = getExpiration(row.date);
      const isExpired = new Date(exp) < now;
      return <span style={{ fontSize: 13, color: isExpired ? 'var(--danger)' : 'var(--text-light)' }}>{formatDateFr(exp)}</span>;
    }},
    { key: 'amount', label: 'Montant', render: (v) => <span style={{ fontWeight: 600 }}>{formatMoney(v)}</span> },
    { key: 'formule', label: 'Formule', render: (_, row) => {
      const isReduit = row.formule === 'reduit' || row.amount === 10;
      return <span className={`badge ${isReduit ? 'badge-ochre' : 'badge-sky'}`}>{isReduit ? 'R\u00e9duit' : 'Normal'}</span>;
    }},
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
          <p className="page-header-sub">Gestion des adh\u00e9sions via HelloAsso</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="helloasso" />
          <ExportButton data={filtered} columns={exportColumns} sheetName="Adh\u00e9rents" filename="adherents-IR.xlsx" />
          <button className="btn btn-outline" onClick={onRefresh}>Rafra\u00eechir</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert-banner alert-warning mb-16">{error}</div>}

        {/* KPI */}
        <div className="grid grid-4 mb-24">
          <StatsCard label="Adh\u00e9rents actifs" value={stats.actifs} accentColor={COLORS.green} sub={`${stats.thisMo} ce mois`} variation={stats.variation} />
          <StatsCard label="Taux de renouvellement" value={`${stats.renewalRate}\u00a0%`} accentColor={COLORS.sky} sub={`${stats.expires} expir\u00e9(s)`} />
          <StatsCard label="Tarif normal (30\u00a0\u20ac)" value={stats.normal} accentColor={COLORS.navy} sub={`${stats.reduit} tarif r\u00e9duit`} />
          <StatsCard label="Nouvelles adh\u00e9sions" value={stats.thisMo} accentColor={COLORS.ochre} sub="Ce mois-ci" />
        </div>

        {/* Filtres */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un adh\u00e9rent\u2026" />
          <div>
            {[['all', 'Tous'], ['actif', 'Actifs'], ['en_attente', 'En attente'], ['expire', 'Expir\u00e9s']].map(([k, l]) => (
              <span key={k} className={`pill${statusFilter === k ? ' active' : ''}`} onClick={() => setStatusFilter(k)}>{l}</span>
            ))}
          </div>
          <div>
            {[['all', 'Toutes formules'], ['normal', 'Normal (30\u00a0\u20ac)'], ['reduit', 'R\u00e9duit (10\u00a0\u20ac)']].map(([k, l]) => (
              <span key={k} className={`pill${formuleFilter === k ? ' active' : ''}`} onClick={() => setFormuleFilter(k)}>{l}</span>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          pageSize={20}
          onRowClick={setSelectedAdherent}
          emptyMessage="Aucun adh\u00e9rent trouv\u00e9. Configurez HelloAsso dans les param\u00e8tres."
        />

        {selectedAdherent && (
          <Modal title="Fiche adh\u00e9rent" onClose={() => setSelectedAdherent(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label>Nom</label><p style={{ fontSize: 15, fontWeight: 500 }}>{selectedAdherent.name}</p></div>
              <div><label>Email</label><p style={{ fontSize: 15 }}>{selectedAdherent.email}</p></div>
              <div><label>Date d&rsquo;adh\u00e9sion</label><p>{formatDateFr(selectedAdherent.date)}</p></div>
              <div><label>Date d&rsquo;expiration</label><p>{formatDateFr(getExpiration(selectedAdherent.date))}</p></div>
              <div><label>Montant</label><p style={{ fontWeight: 600 }}>{formatMoney(selectedAdherent.amount)}</p></div>
              <div><label>Formule</label><p>{selectedAdherent.formule === 'reduit' || selectedAdherent.amount === 10 ? 'Tarif r\u00e9duit' : 'Tarif normal'}</p></div>
              <div><label>Source</label><p>{selectedAdherent.source || 'Manuel'}</p></div>
              <div><label>Statut</label><p>{selectedAdherent.status}</p></div>
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
