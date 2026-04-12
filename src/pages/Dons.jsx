import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatsCard from '../components/shared/StatsCard';
import DataTable from '../components/shared/DataTable';
import ExportButton from '../components/shared/ExportButton';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, formatMoney } from '../utils/formatters';
import { COLORS } from '../utils/constants';

export default function Dons({ dons, setDons, services, loading, onRefresh, toast }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const donsCeMois = useMemo(() => {
    return dons.filter((d) => {
      const date = new Date(d.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
  }, [dons, currentMonth, currentYear]);

  const totalCeMois = useMemo(() => {
    return donsCeMois.reduce((sum, d) => sum + (d.montant || 0), 0);
  }, [donsCeMois]);

  const nbDonateurs = useMemo(() => {
    const noms = new Set(donsCeMois.map((d) => d.nom || d.email || 'anonyme'));
    return noms.size;
  }, [donsCeMois]);

  const donMoyen = useMemo(() => {
    if (!donsCeMois.length) return 0;
    return totalCeMois / donsCeMois.length;
  }, [totalCeMois, donsCeMois]);

  const recurrents = useMemo(() => {
    return donsCeMois.filter((d) => d.type === 'recurrent').length;
  }, [donsCeMois]);

  const ponctuels = useMemo(() => {
    return donsCeMois.filter((d) => d.type === 'ponctuel').length;
  }, [donsCeMois]);

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const total = dons
        .filter((don) => {
          const dd = new Date(don.date);
          return dd.getMonth() === m && dd.getFullYear() === y;
        })
        .reduce((sum, don) => sum + (don.montant || 0), 0);
      months.push({ mois: label, total });
    }
    return months;
  }, [dons, currentMonth, currentYear]);

  const sorted = useMemo(() => {
    const copy = [...dons];
    copy.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'date') {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
      }
      if (sortKey === 'montant') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [dons, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const columns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (row) => formatDateFr(row.date),
    },
    {
      key: 'nom',
      label: 'Nom',
      sortable: true,
      render: (row) => row.nom || 'Anonyme',
    },
    {
      key: 'montant',
      label: 'Montant',
      sortable: true,
      render: (row) => <strong>{formatMoney(row.montant)}</strong>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <span className={`badge ${row.type === 'recurrent' ? 'badge-sky' : 'badge-ochre'}`}>
          {row.type === 'recurrent' ? 'Recurrent' : 'Ponctuel'}
        </span>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => (
        <span className={`pill ${row.statut === 'confirme' ? 'pill-green' : 'pill-terra'}`}>
          {row.statut || 'En attente'}
        </span>
      ),
    },
  ];

  const exportData = dons.map((d) => ({
    Date: formatDateFr(d.date),
    Nom: d.nom || 'Anonyme',
    Montant: d.montant,
    Type: d.type === 'recurrent' ? 'Recurrent' : 'Ponctuel',
    Statut: d.statut || 'En attente',
  }));

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dons</h1>
          <ServiceBadge service="helloasso" />
        </div>
        <div className="page-body">
          <div className="grid grid-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dons</h1>
          <ServiceBadge service="helloasso" />
        </div>
        <div className="page-header-actions">
          <ExportButton data={exportData} filename="dons-institut-rousseau" />
          <button className="btn btn-secondary" onClick={onRefresh}>
            Synchroniser HelloAsso
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="grid grid-4">
          <StatsCard
            label="Total ce mois"
            value={formatMoney(totalCeMois)}
            color="var(--color-navy)"
          />
          <StatsCard
            label="Donateurs"
            value={nbDonateurs}
            color="var(--color-sky)"
          />
          <StatsCard
            label="Don moyen"
            value={formatMoney(donMoyen)}
            color="var(--color-terra)"
          />
          <StatsCard
            label="Recurrents / Ponctuels"
            value={`${recurrents} / ${ponctuels}`}
            color="var(--color-ochre)"
          />
        </div>

        <div className="card chart-card">
          <h2>Evolution des dons (6 derniers mois)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e0e0e0)" />
              <XAxis dataKey="mois" tick={{ fontSize: 13 }} />
              <YAxis tickFormatter={(v) => `${v} \u20ac`} tick={{ fontSize: 13 }} />
              <Tooltip
                formatter={(value) => [`${formatMoney(value)}`, 'Total']}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="total" fill={COLORS.navy} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card table-card">
          <h2>Historique des dons</h2>
          <DataTable
            columns={columns}
            data={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      </div>
    </div>
  );
}
