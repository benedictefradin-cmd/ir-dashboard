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
    return donsCeMois.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [donsCeMois]);

  const nbDonateurs = useMemo(() => {
    const noms = new Set(donsCeMois.map((d) => d.name || d.email || 'anonyme'));
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
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const total = dons
        .filter((don) => {
          const dd = new Date(don.date);
          return dd.getMonth() === m && dd.getFullYear() === y;
        })
        .reduce((sum, don) => sum + (don.amount || 0), 0);
      months.push({ mois: label, total });
    }
    return months;
  }, [dons, currentMonth, currentYear]);

  const sorted = useMemo(() => {
    return [...dons].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [dons]);

  const columns = [
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
    { key: 'name', label: 'Nom', render: (v) => <span style={{ fontWeight: 500 }}>{v || 'Anonyme'}</span> },
    { key: 'amount', label: 'Montant', render: (v) => <strong>{formatMoney(v)}</strong> },
    { key: 'type', label: 'Type', render: (v) => (
      <span className={`badge ${v === 'recurrent' ? 'badge-sky' : 'badge-ochre'}`}>
        {v === 'recurrent' ? 'Récurrent' : 'Ponctuel'}
      </span>
    )},
    { key: 'status', label: 'Statut', render: (v) => (
      <span className={`badge ${v === 'actif' ? 'badge-green' : 'badge-ochre'}`}>
        {v === 'actif' ? 'Confirmé' : v || 'En attente'}
      </span>
    )},
  ];

  const exportData = sorted.map((d) => ({
    Date: formatDateFr(d.date),
    Nom: d.name || 'Anonyme',
    Montant: d.amount,
    Type: d.type === 'recurrent' ? 'Récurrent' : 'Ponctuel',
    Statut: d.status || 'En attente',
  }));

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Dons</h1></div>
        <div className="page-body">
          <div className="grid grid-4 mb-24">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonTable />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dons</h1>
          <p className="page-header-sub">Suivi des dons via HelloAsso</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="helloasso" />
          <ExportButton data={exportData} filename="dons-institut-rousseau" />
          <button className="btn btn-outline" onClick={onRefresh}>Synchroniser HelloAsso</button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI */}
        <div className="grid grid-4 mb-24">
          <StatsCard label="Total ce mois" value={formatMoney(totalCeMois)} accentColor={COLORS.navy} />
          <StatsCard label="Donateurs" value={nbDonateurs} accentColor={COLORS.sky} />
          <StatsCard label="Don moyen" value={formatMoney(donMoyen)} accentColor={COLORS.terra} />
          <StatsCard label="Récurrents / Ponctuels" value={`${recurrents} / ${ponctuels}`} accentColor={COLORS.ochre} />
        </div>

        {/* Graphique */}
        <div className="card mb-24">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Évolution des dons (6 derniers mois)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: COLORS.textLight }} />
              <YAxis tickFormatter={(v) => `${v}\u00a0\u20ac`} tick={{ fontSize: 12, fill: COLORS.textLight }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
                formatter={(value) => [`${formatMoney(value)}`, 'Total']}
              />
              <Bar dataKey="total" fill={COLORS.terra} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tableau */}
        <DataTable
          columns={columns}
          data={sorted}
          pageSize={20}
          emptyMessage="Aucun don enregistré. Configurez HelloAsso dans les paramètres."
        />
      </div>
    </>
  );
}
